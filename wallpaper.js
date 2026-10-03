/**
 * 自定义壁纸 —— **图片只存在本机，不上传到任何服务器**。
 *
 * 为什么不用 localStorage：它只有约 5MB 上限、且是同步 API，
 * 一张壁纸的 data URL 塞进去会卡住主线程。这里用 chrome.storage.local
 * （manifest 已有 "storage" 权限），它是异步的、按字节配额。
 *
 * 为什么要压缩：手机随手一张 4000×3000 的照片，原图 base64 后轻松上 MB。
 * 这里统一压到最长边 2560，并逐档降质 / 降尺寸，直到落进体积上限。
 * 压完的图铺满全屏看不出差别，但存储与解码都轻得多。
 */

const WALLPAPER_STORAGE_KEY = "customWallpaper";

/** 压缩后的最长边。够铺 4K 屏，再大只是浪费存储。 */
const WALLPAPER_MAX_EDGE = 2560;
/** 压缩后 data URL 的字节上限。留一点余量给 chrome.storage.local 的其它开销。 */
const WALLPAPER_MAX_BYTES = 4 * 1024 * 1024;
/** 逐档尝试的质量。WebP 优先，实在拿不到再退 JPEG。 */
const WALLPAPER_QUALITIES = [0.86, 0.72, 0.58];
const WALLPAPER_MIME_PREFERENCE = ["image/webp", "image/jpeg"];
/** 最多再缩 3 轮（2560 → 1920 → 1440 → 1080），还超就报错而不是无限压。 */
const WALLPAPER_MAX_SHRINK_ROUNDS = 3;

const WALLPAPER_ACCEPTED = /^image\/(png|jpeg|webp|gif|bmp|x-icon|avif)$/i;

/* ---------------------------------------------------------------- 存储层 */

/**
 * 统一的存储接口。chrome.storage 不可用时（例如 jsdom 环境）退化为内存实现，
 * 这样单测能跑，运行时也不会因为 API 缺失就整个功能瘫掉。
 */
const memoryStore = new Map();

const store = (() => {
  const area = typeof chrome !== "undefined" && chrome.storage
    && chrome.storage.local
    ? chrome.storage.local
    : null;

  if (!area) {
    return {
      backend: "memory",
      get: () => Promise.resolve(memoryStore.get(WALLPAPER_STORAGE_KEY) || null),
      set: (value) => {
        memoryStore.set(WALLPAPER_STORAGE_KEY, value);
        return Promise.resolve();
      },
      remove: () => {
        memoryStore.delete(WALLPAPER_STORAGE_KEY);
        return Promise.resolve();
      },
    };
  }

  // chrome.storage 的回调版在部分版本上仍可用，包一层 Promise 统一用法
  const call = (method, arg) => new Promise((resolve, reject) => {
    try {
      const maybe = area[method](arg, (result) => {
        const err = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve(result);
      });
      // 新版 MV3 返回 Promise，不走回调
      if (maybe && typeof maybe.then === "function") maybe.then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });

  return {
    backend: "chrome.storage.local",
    get: () => call("get", WALLPAPER_STORAGE_KEY).then((r) => r?.[WALLPAPER_STORAGE_KEY] || null),
    set: (value) => call("set", { [WALLPAPER_STORAGE_KEY]: value }),
    remove: () => call("remove", WALLPAPER_STORAGE_KEY),
  };
})();

/* ------------------------------------------------------------ 图片压缩层 */

function loadBitmap(file) {
  // createImageBitmap 最省事，但并非所有环境都有（jsdom 就没有），
  // 所以留一条 <img> + objectURL 的退路。
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadViaImgElement(file));
  }
  return loadViaImgElement(file);
}

function loadViaImgElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败"));
    };
    img.src = url;
  });
}

function fitWithin(bitmap, maxEdge) {
  const bw = bitmap.width || bitmap.naturalWidth;
  const bh = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, maxEdge / Math.max(bw, bh));
  return {
    w: Math.max(1, Math.round(bw * scale)),
    h: Math.max(1, Math.round(bh * scale)),
    scaled: scale < 1,
  };
}

function canvasToDataUrl(canvas, type, quality) {
  // toDataURL 是**同步**的：直接返回字符串，没有回调形式。
  // （按异步的写法传个回调进去，Promise 永远不会 settle，await 直接挂死——
  //   这个坑是端到端测试逼出来的，别改回去。）
  try {
    if (typeof canvas.toDataURL !== "function") return Promise.resolve("");
    const dataUrl = canvas.toDataURL(type, quality);
    return Promise.resolve(typeof dataUrl === "string" ? dataUrl : "");
  } catch (error) {
    // 某些环境对未知类型会抛，直接当成「这个类型不行」交给上层换下一个
    return Promise.resolve("");
  }
}

/**
 * 把用户选的文件压成能存下的 data URL。
 * @returns {Promise<{dataUrl:string,name:string,w:number,h:number,type:string,bytes:number,originalBytes:number,originalW:number,originalH:number}>}
 * @throws {Error} 压到最小仍超上限时抛错，调用方负责提示与回滚
 */
async function compressWallpaper(file) {
  if (!file) throw new Error("没有拿到文件");
  if (file.type && !WALLPAPER_ACCEPTED.test(file.type)) {
    throw new Error("只能选图片文件");
  }

  const bitmap = await loadBitmap(file);
  const sourceW = bitmap.width || bitmap.naturalWidth;
  const sourceH = bitmap.height || bitmap.naturalHeight;
  if (!sourceW || !sourceH) throw new Error("图片尺寸读不出来");

  let edge = WALLPAPER_MAX_EDGE;
  let lastBytes = 0;
  let producedAny = false;

  for (let round = 0; round <= WALLPAPER_MAX_SHRINK_ROUNDS; round++) {
    const { w, h, scaled } = fitWithin(bitmap, edge);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("这个环境不支持图片压缩");
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === "function") bitmap.close();

    for (const quality of WALLPAPER_QUALITIES) {
      for (const type of WALLPAPER_MIME_PREFERENCE) {
        const dataUrl = await canvasToDataUrl(canvas, type, quality);
        if (!dataUrl) continue;
        // 只认真格式：浏览器不支持该类型时会退回 PNG，体积往往更大
        if (!dataUrl.startsWith(`data:${type}`)) continue;
        producedAny = true;
        const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
        lastBytes = bytes;
        if (bytes <= WALLPAPER_MAX_BYTES) {
          return {
            dataUrl,
            name: file.name || "自定义壁纸",
            type,
            w,
            h,
            bytes,
            scaled,
            originalW: sourceW,
            originalH: sourceH,
            originalBytes: file.size || 0,
          };
        }
      }
    }
    if (round < WALLPAPER_MAX_SHRINK_ROUNDS) {
      edge = Math.max(640, Math.round(edge * 0.75));
    }
  }

  // 一张都没转出来 = 环境不支持，而不是「太大了」。这两种原因要给不同的话。
  if (!producedAny) throw new Error("这个浏览器没法把这张图转成可用格式");

  const mb = (lastBytes / 1024 / 1024).toFixed(1);
  throw new Error(`图片压到最小仍有 ${mb}MB，超过上限`);
}

function formatWallpaperBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* --------------------------------------------------------- 深色壁纸判定 */

/**
 * 亮度低于这个值就切暗色变体。
 *
 * 不是拍的，是算的。设壁纸相对亮度为 L：
 *   浅色 UI（墨 #3a3532，Y≈0.036）对比度 = (L+0.05) / 0.086
 *   暗色 UI（浅字 #f2ede8，Y≈0.83）  对比度 = 0.88 / (L+0.05)
 * 两者相等时解得 **L = 0.225** —— 这就是交叉点，比它暗则暗色变体对比度更高。
 * （实测：深色壁纸 #0d1220 下墨字只有 1.48:1，加白色蒙版也只到 1.73:1，
 *   离 AA 的 4.5:1 差得远；而让墨字达标需要底色接近纯白，那会很难看。）
 */
const WALLPAPER_DARK_LUMA = 0.225;

/** 把图片缩到很小的画布上求平均亮度。32×32 足够代表整张图的调子，又快。 */
async function analyzeWallpaperLuminance(dataUrl) {
  if (!dataUrl) return null;
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("壁纸读不出来"));
      i.src = dataUrl;
    });
    const N = 32;
    const canvas = document.createElement("canvas");
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, N, N);
    const d = ctx.getImageData(0, 0, N, N).data;
    const f = (v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]);
    }
    return sum / (d.length / 4);
  } catch (error) {
    return null;
  }
}

window.WALLPAPER_STORAGE_KEY = WALLPAPER_STORAGE_KEY;
window.WALLPAPER_MAX_BYTES = WALLPAPER_MAX_BYTES;
window.WALLPAPER_DARK_LUMA = WALLPAPER_DARK_LUMA;
window.wallpaperStore = store;
window.compressWallpaper = compressWallpaper;
window.analyzeWallpaperLuminance = analyzeWallpaperLuminance;
window.formatWallpaperBytes = formatWallpaperBytes;
