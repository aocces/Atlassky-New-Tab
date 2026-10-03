const STORAGE_SITES = "sites";
const STORAGE_HISTORY = "history";
const STORAGE_SETTINGS = "settings";
const STORAGE_WEATHER_PERMISSION = "weather_permission";

/* ====================== 搜索建议来源 ==============================
   直接调用各搜索引擎「自己」的公开建议接口，不经过任何第三方代理。
   跨域方面：扩展页面（本新标签页就是）对 manifest 里 host_permissions
   声明过的站点发 fetch，不受同源策略限制，所以只要把域名写进静态清单
   就不会有 CORS 问题，无需代理。
   注意：接口能否连通由网络环境决定，与跨域无关 —— 例如 Google 与
   DuckDuckGo 在部分网络下不可达，这属于可达性问题。
   =============================================================== */

const SUGGEST_SOURCES = {
  google: {
    url: (q) =>
        `https://suggestqueries.google.com/complete/search` +
        `?client=firefox&q=${encodeURIComponent(q)}`,
    // ["query", ["s1", "s2", ...]]
    parse: (data) => (Array.isArray(data?.[1]) ? data[1] : [])
  },
  bing: {
    url: (q) =>
        `https://api.bing.com/osjson.aspx` +
        `?query=${encodeURIComponent(q)}&market=zh-CN`,
    // ["query", ["s1", "s2", ...]]
    parse: (data) => (Array.isArray(data?.[1]) ? data[1] : [])
  },
  baidu: {
    url: (q) =>
        `https://www.baidu.com/sugrec` +
        `?prod=pc&wd=${encodeURIComponent(q)}`,
    // { q, p, g: [{ type, sa, q }, ...] }
    parse: (data) => (Array.isArray(data?.g) ? data.g.map((item) => item?.q) : [])
  },
  duckduckgo: {
    url: (q) => `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`,
    // type=list → ["s1", "s2", ...]；不带 type → [{ phrase }, ...]
    parse: (data) => (Array.isArray(data)
        ? data.map((item) => (typeof item === "string" ? item : item?.phrase))
        : [])
  }
};

const ENGINE_LABELS = {
  google: "Google",
  bing: "Bing",
  baidu: "百度",
  duckduckgo: "DuckDuckGo"
};

/**
 * 建议取不到时该换到哪个引擎。
 * Google 与 DuckDuckGo 的建议接口在部分网络下不可达，Bing / 百度可直连。
 * 没有对应项（Bing / 百度 自己失败）时只给「重试」。
 */
const SUGGEST_FALLBACK_HINT = {
  google: "bing",
  duckduckgo: "bing"
};

/**
 * 当前生效的建议来源引擎。
 * 自定义搜索引擎没有公开的建议接口，回落到 Google。
 */
function resolveSuggestEngine() {
  if (settings.engine === "custom") return "google";
  return SEARCH_ENGINES[settings.engine] ? settings.engine : "google";
}

const center = document.querySelector(".center");

const searchArea = document.querySelector(".search-area");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const suggestPanel = document.getElementById("suggestPanel");
const suggestList = document.getElementById("suggestList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const shortcutBar = document.getElementById("shortcutBar");
const shortcutSection = document.getElementById("shortcutSection");
const addSiteBtn = document.getElementById("addSiteBtn");

const modalOverlay = document.getElementById("modalOverlay");
const addSiteModal = document.getElementById("addSiteModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelAddBtn = document.getElementById("cancelAddBtn");
const confirmAddBtn = document.getElementById("confirmAddBtn");
const siteNameInput = document.getElementById("siteNameInput");
const siteUrlInput = document.getElementById("siteUrlInput");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");

const moreBtn = document.getElementById("moreBtn");
const morePanel = document.getElementById("morePanel");
const privacyInfoBtn = document.getElementById("privacyInfoBtn");

const bgSelector = document.getElementById("bgSelector");
const engineSelector = document.getElementById("engineSelector");
const weatherCitySelector = document.getElementById("weatherCitySelector");
const weatherCitySummary = document.getElementById("weatherCitySummary");
const weatherCitySearch = document.getElementById("weatherCitySearch");
const weatherCityList = document.getElementById("weatherCityList");
const weatherCityEmpty = document.getElementById("weatherCityEmpty");
const toggleShortcuts = document.getElementById("toggleShortcuts");
const toggleWallpaperAnim = document.getElementById("toggleWallpaperAnim");
const toggleSuggestions = document.getElementById("toggleSuggestions");
const toggleHitokoto = document.getElementById("toggleHitokoto");
const toggleWordmark = document.getElementById("toggleWordmark");

const customWallpaperImg = document.getElementById("customWallpaper");
const wallpaperPicker = document.getElementById("wallpaperPicker");
const wallpaperThumb = document.getElementById("wallpaperThumb");
const chooseWallpaperBtn = document.getElementById("chooseWallpaperBtn");
const clearWallpaperBtn = document.getElementById("clearWallpaperBtn");
const wallpaperFile = document.getElementById("wallpaperFile");

const hitokotoBar = document.getElementById("hitokotoBar");
const hitokotoBtn = document.getElementById("hitokotoBtn");
const hitokotoText = document.getElementById("hitokotoText");
const hitokotoSource = document.getElementById("hitokotoSource");

const toggleWeather = document.getElementById("toggleWeather");
const openCustomEngineBtn = document.getElementById("openCustomEngineBtn");
const customEngineSummary = document.getElementById("customEngineSummary");

const customEngineOverlay = document.getElementById("customEngineOverlay");
const customEngineModal = document.getElementById("customEngineModal");
const closeCustomEngineBtn = document.getElementById("closeCustomEngineBtn");
const saveCustomEngineBtn = document.getElementById("saveCustomEngineBtn");
const clearCustomEngineBtn = document.getElementById("clearCustomEngineBtn");
const customEngineNameInput = document.getElementById("customEngineNameInput");
const customEngineUrlInput = document.getElementById("customEngineUrlInput");

/* 这个按钮需要你在 settings 面板里加出来 */
const openWeatherRevokeBtn = document.getElementById("openWeatherRevokeBtn");

const weatherBox = document.getElementById("weatherBox");
const weatherText = document.getElementById("weatherText");

const toast = document.getElementById("toast");

/* 天气授权弹窗 */
const weatherPermissionOverlay = document.getElementById("weatherPermissionOverlay");
const weatherPermissionModal = document.getElementById("weatherPermissionModal");
const closeWeatherPermissionBtn = document.getElementById("closeWeatherPermissionBtn");
const confirmWeatherPermissionBtn = document.getElementById("confirmWeatherPermissionBtn");
const denyWeatherPermissionBtn = document.getElementById("denyWeatherPermissionBtn");

/* 撤回授权确认弹窗 */
const weatherRevokeOverlay = document.getElementById("weatherRevokeOverlay");
const weatherRevokeModal = document.getElementById("weatherRevokeModal");
const closeWeatherRevokeBtn = document.getElementById("closeWeatherRevokeBtn");
const confirmWeatherRevokeBtn = document.getElementById("confirmWeatherRevokeBtn");
const cancelWeatherRevokeBtn = document.getElementById("cancelWeatherRevokeBtn");

const DEFAULT_SUGGESTIONS = [];

const SEARCH_ENGINES = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  baidu: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
  duckduckgo: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
};

const THEME_PRESETS = {
  gradient: {
    primary: "#8e7a6c",
    primaryStrong: "#6f5d52",
    surface: "rgba(255,255,255,0.18)",
    surfaceStrong: "rgba(255,255,255,0.28)",
    border: "rgba(255,255,255,0.55)",
    ring: "rgba(143, 121, 107, 0.14)",
    shadow: "rgba(120, 92, 68, 0.14)",
    toastBg: "rgba(255,255,255,0.68)",
    toastBorder: "rgba(255,255,255,0.72)"
  },
  warm: {
    primary: "#b8876f",
    primaryStrong: "#8e6452",
    surface: "rgba(255, 248, 242, 0.2)",
    surfaceStrong: "rgba(255, 244, 235, 0.32)",
    border: "rgba(255, 244, 237, 0.62)",
    ring: "rgba(184, 135, 111, 0.16)",
    shadow: "rgba(159, 110, 85, 0.16)",
    toastBg: "rgba(255, 247, 240, 0.72)",
    toastBorder: "rgba(255, 241, 234, 0.78)"
  },
  cool: {
    primary: "#87929c",
    primaryStrong: "#67717a",
    surface: "rgba(250, 251, 252, 0.18)",
    surfaceStrong: "rgba(243, 246, 248, 0.3)",
    border: "rgba(248, 250, 251, 0.62)",
    ring: "rgba(135, 146, 156, 0.15)",
    shadow: "rgba(108, 117, 125, 0.15)",
    toastBg: "rgba(248, 250, 251, 0.72)",
    toastBorder: "rgba(244, 247, 249, 0.78)"
  },
  image1: {
    primary: "#8c7b73",
    primaryStrong: "#6f625c",
    surface: "rgba(255, 245, 241, 0.18)",
    surfaceStrong: "rgba(247, 229, 223, 0.32)",
    border: "rgba(255, 240, 235, 0.6)",
    ring: "rgba(140, 123, 115, 0.16)",
    shadow: "rgba(132, 104, 95, 0.15)",
    toastBg: "rgba(255, 244, 240, 0.72)",
    toastBorder: "rgba(252, 235, 229, 0.78)"
  },
  image2: {
    primary: "#7d8f97",
    primaryStrong: "#61737a",
    surface: "rgba(244, 248, 250, 0.2)",
    surfaceStrong: "rgba(229, 238, 242, 0.32)",
    border: "rgba(241, 247, 249, 0.64)",
    ring: "rgba(125, 143, 151, 0.16)",
    shadow: "rgba(103, 120, 128, 0.15)",
    toastBg: "rgba(244, 248, 250, 0.72)",
    toastBorder: "rgba(236, 243, 246, 0.78)"
  }
};

let settings = load(STORAGE_SETTINGS, {
  bg: "gradient",
  // 默认 Bing：Google 的建议接口在大陆网络不可达，Bing 可直连，开箱即用
  engine: "bing",
  shortcuts: true,
  wallpaperAnim: true,
  weather: false,
  // 空字符串 = 自动（定位优先，拿不到时按系统时区推断）；否则是 WEATHER_CITIES 里的城市 id
  weatherCity: "",
  suggestions: true,
  // 一言页脚。取数与文案格式在 hitokoto.js，这里只管显隐
  hitokoto: true,
  // 左下角品牌标识
  wordmark: true,
  customEngine: {
    name: "",
    urlTemplate: ""
  }
});

if (!settings.customEngine || typeof settings.customEngine !== "object") {
  settings.customEngine = {
    name: "",
    urlTemplate: ""
  };
}
if ("homepageFav" in settings) {
  delete settings.homepageFav;
}
// 3.2.0 起移除代理机制，清掉旧版本可能残留的字段
if ("useProxy" in settings) {
  delete settings.useProxy;
}
if ("proxyUrl" in settings) {
  delete settings.proxyUrl;
}

// 3.2.0 起默认搜索引擎由 Google 换成 Bing（Google 建议接口在大陆网络不可达）。
// 旧版本会把「默认的 google」一并持久化，导致老用户升级后换不过去，这里做一次性迁移；
// 迁移过后打上标记，用户之后在设置里手动选回 Google 不会被再次改掉。
let engineMigratedToBing = false;
if (settings.engine === "google" && settings.engineMigrated !== "bing@3.2.0") {
  settings.engine = "bing";
  settings.engineMigrated = "bing@3.2.0";
  engineMigratedToBing = true;
}

let currentSuggestions = [];
let activeSuggestionIndex = -1;
let toastTimer = null;
let suggestRequestId = 0;
let suggestDebounceTimer = null;
let lastSuggestError = "";

const suggestionCache = new Map();

function load(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;

    const parsed = JSON.parse(raw);

    // 与默认值做一次浅合并：旧版本存下的设置对象可能缺少后来新增的字段，
    // 直接返回会让新字段变成 undefined（例如缺失的 engine 会静默回落 Google）。
    const isPlainObject = (value) =>
        value !== null && typeof value === "object" && !Array.isArray(value);

    if (isPlainObject(parsed) && isPlainObject(defaultValue)) {
      return Object.assign({}, defaultValue, parsed);
    }

    return parsed;
  } catch (error) {
    return defaultValue;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function showToast(text) {
  if (!toast) return;

  toast.textContent = text;
  toast.classList.add("show");

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function applyDynamicTheme(bgKey) {
  const theme = THEME_PRESETS[bgKey] || THEME_PRESETS.gradient;
  const root = document.documentElement;

  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-primary-strong", theme.primaryStrong);
  root.style.setProperty("--theme-surface", theme.surface);
  root.style.setProperty("--theme-surface-strong", theme.surfaceStrong);
  root.style.setProperty("--theme-border", theme.border);
  root.style.setProperty("--theme-ring", theme.ring);
  root.style.setProperty("--theme-shadow", theme.shadow);
  root.style.setProperty("--theme-toast-bg", theme.toastBg);
  root.style.setProperty("--theme-toast-border", theme.toastBorder);
}

function normalizeUrl(url) {
  const value = url.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return "https://" + value;
}

function isValidUrl(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    return Boolean(parsed.hostname);
  } catch (error) {
    return false;
  }
}

/**
 * 快捷入口图标地址。
 * 用 MV3 官方的 Favicon API（chrome-extension://<id>/_favicon/）——图标由浏览器
 * 本地提供、不发任何外部请求，因此不受网络可达性影响。
 * 旧实现走 www.google.com/s2/favicons，在大陆网络下会全部空白。
 * 需要在 manifest 里声明 "favicon" 权限。
 */
function getFaviconUrl(url) {
  const runtime =
      (typeof chrome !== "undefined" && chrome.runtime) ? chrome.runtime : null;

  if (!runtime || typeof runtime.getURL !== "function") {
    return "";   // 非扩展环境（本地预览 / 校验脚本）没有这个 API
  }

  try {
    const target = new URL(url);
    const favicon = new URL(runtime.getURL("/_favicon/"));
    favicon.searchParams.set("pageUrl", target.href);
    favicon.searchParams.set("size", "64");
    return favicon.toString();
  } catch (error) {
    return "";
  }
}

/**
 * 快捷入口图标元素：底层是一个首字母色块，图标取到后再淡入盖上。
 * 这样「没有 favicon 的站点」和「非扩展环境」都不会出现裂图。
 */
function createShortcutIcon(url, title) {
  const wrap = document.createElement("span");
  wrap.className = "shortcut-icon";

  const letter = document.createElement("span");
  letter.className = "shortcut-icon-letter";
  letter.textContent =
      String(title || url || "?").trim().charAt(0).toUpperCase() || "?";
  wrap.appendChild(letter);

  const src = getFaviconUrl(url);
  if (src) {
    const img = document.createElement("img");
    img.className = "shortcut-favicon";
    img.alt = "";
    img.src = src;
    img.addEventListener("load", () => wrap.classList.add("has-favicon"));
    wrap.appendChild(img);
  }

  return wrap;
}

function setSearchActive(isActive) {
  if (!center) return;
  center.classList.toggle("search-active", isActive);
}

function escapeHtml(text) {
  return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
}

function debounce(fn, delay = 180) {
  return (...args) => {
    clearTimeout(suggestDebounceTimer);
    suggestDebounceTimer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/* 自定义下拉 */

/**
 * 特殊菜单展开时的钩子（目前只有城市检索型用），
 * 免得把天气那套逻辑写进下面的通用函数里。
 */
let onCustomSelectOpen = null;

function getCustomEngineDisplayName() {
  return settings.customEngine?.name?.trim() || "自定义";
}

function syncCustomSelect(selectRoot, value) {
  if (!selectRoot) return;

  const textNode = selectRoot.querySelector(".custom-select-text");
  const options = selectRoot.querySelectorAll(".custom-select-option");

  options.forEach((option) => {
    const active = option.dataset.value === value;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", active ? "true" : "false");

    if (active && textNode) {
      textNode.textContent = option.textContent.trim();
    }
  });

  if (selectRoot === engineSelector) {
    const customOption = selectRoot.querySelector('.custom-select-option[data-value="custom"]');
    if (customOption) {
      customOption.textContent = getCustomEngineDisplayName();
    }

    if (value === "custom" && textNode) {
      textNode.textContent = getCustomEngineDisplayName();
    }
  }
}

function closeCustomSelect(selectRoot) {
  if (!selectRoot) return;
  selectRoot.classList.remove("open");
  selectRoot.setAttribute("aria-expanded", "false");
}

function closeAllCustomSelects(except) {
  [bgSelector, engineSelector, weatherCitySelector].forEach((selectRoot) => {
    if (selectRoot && selectRoot !== except) {
      closeCustomSelect(selectRoot);
    }
  });
}

/** 菜单能压到的最小高度：再挤也要露出检索框 + 几个候选，否则不如不展开 */
const CUSTOM_SELECT_MIN_HEIGHT = 180;

/**
 * 高菜单（城市检索型，最高 320px）默认向下展开，但设置面板本身是个滚动容器、
 * 会把超出可视区的部分裁掉，所以空间不够时改成向上展开。
 */
function positionCustomSelectMenu(selectRoot) {
  if (!selectRoot) return;

  const menu = selectRoot.querySelector(".custom-select-menu");
  const scroller = selectRoot.closest(".settings-body");
  const trigger = selectRoot.querySelector(".custom-select-trigger");

  selectRoot.classList.remove("drop-up");

  if (!menu || !scroller || !trigger) return;
  if (!menu.classList.contains("is-searchable")) return;

  // 先清掉上一次算出的限制，这时量到的才是自然高度
  menu.style.maxHeight = "";

  const boundary = scroller.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();

  // 开着菜单继续滚面板，会把触发器带出可视区。菜单是贴着触发器定位的，
  // 触发器不在区内，菜单无论往上还是往下展开都必然被裁掉一截。
  // 这里直接收起 —— 与其显示半截菜单，不如让用户重新点开。
  // （实测：面板滚到顶时触发器在可视区下方 56px，菜单下沿会溢出 48px。）
  if (triggerRect.top < boundary.top || triggerRect.bottom > boundary.bottom) {
    closeCustomSelect(selectRoot);
    return;
  }

  const naturalHeight = menu.offsetHeight;

  const spaceBelow = boundary.bottom - triggerRect.bottom - 8;
  const spaceAbove = triggerRect.top - boundary.top - 8;

  const dropUp = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
  if (dropUp) selectRoot.classList.add("drop-up");

  // 光翻转还不够：设置面板可视区就这么高，触发器落在中间时两边都放不下，
  // 超出的部分会被 .settings-body 直接裁掉（实测能裁掉 85px，近四分之一）。
  // 这里把菜单压到可用高度，让滚动发生在菜单内部，而不是让选项凭空消失。
  const available = Math.max(dropUp ? spaceAbove : spaceBelow, CUSTOM_SELECT_MIN_HEIGHT);

  if (naturalHeight > available) {
    menu.style.maxHeight = Math.round(available) + "px";
  }
}

function openCustomSelect(selectRoot) {
  if (!selectRoot) return;
  closeAllCustomSelects(selectRoot);
  selectRoot.classList.add("open");
  selectRoot.setAttribute("aria-expanded", "true");
  positionCustomSelectMenu(selectRoot);
  if (typeof onCustomSelectOpen === "function") onCustomSelectOpen(selectRoot);
}

function toggleCustomSelect(selectRoot) {
  if (!selectRoot) return;

  if (selectRoot.classList.contains("open")) {
    closeCustomSelect(selectRoot);
  } else {
    openCustomSelect(selectRoot);
  }
}

function setupCustomSelect(selectRoot, onChange) {
  if (!selectRoot) return;

  const trigger = selectRoot.querySelector(".custom-select-trigger");

  if (trigger) {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCustomSelect(selectRoot);
    });
  }

  // 用事件委托而不是逐个绑定：城市候选会随检索词整批重建，
  // 逐个 bind 的监听器会跟着旧节点一起被丢掉。
  selectRoot.addEventListener("click", (event) => {
    const option = event.target.closest ? event.target.closest(".custom-select-option") : null;
    if (!option || !selectRoot.contains(option)) return;

    event.stopPropagation();
    const value = option.dataset.value;
    syncCustomSelect(selectRoot, value);
    closeCustomSelect(selectRoot);
    if (typeof onChange === "function") {
      onChange(value);
    }
  });

  selectRoot.addEventListener("keydown", (event) => {
    // 菜单顶部的检索框自己处理按键（回车选第一条、Esc 清空），
    // 不参与下面这套「回车 / 空格开关菜单」
    if (event.target.closest && event.target.closest(".custom-select-search")) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCustomSelect(selectRoot);
    }

    if (event.key === "Escape") {
      closeCustomSelect(selectRoot);
    }
  });
}

/* 自定义搜索引擎 */

function normalizeCustomEngineTemplate(value) {
  return String(value || "").trim();
}

function isValidCustomEngineTemplate(value) {
  const template = normalizeCustomEngineTemplate(value);
  if (!template || !template.includes("{q}")) return false;

  try {
    const testUrl = template.replace("{q}", "test");
    const parsed = new URL(testUrl);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function buildCustomSearchUrl(keyword) {
  const template = normalizeCustomEngineTemplate(settings.customEngine?.urlTemplate);
  if (!isValidCustomEngineTemplate(template)) return null;
  return template.replaceAll("{q}", encodeURIComponent(keyword));
}

function renderCustomEngineSummary() {
  if (!customEngineSummary) return;

  const name = settings.customEngine?.name?.trim();
  const template = settings.customEngine?.urlTemplate?.trim();

  if (!name || !template) {
    customEngineSummary.textContent = "未配置";
    return;
  }

  customEngineSummary.textContent = `${name} · ${template}`;
}

function updateCustomEngineButtonState() {
  if (!saveCustomEngineBtn) return;

  const valid =
      customEngineNameInput?.value.trim() &&
      isValidCustomEngineTemplate(customEngineUrlInput?.value);

  saveCustomEngineBtn.disabled = !valid;
  saveCustomEngineBtn.classList.toggle("enabled", Boolean(valid));
}

function openCustomEngineModal() {
  if (!customEngineOverlay) return;

  customEngineNameInput.value = settings.customEngine?.name || "";
  customEngineUrlInput.value = settings.customEngine?.urlTemplate || "";
  updateCustomEngineButtonState();

  customEngineOverlay.classList.add("active");

  setTimeout(() => {
    customEngineNameInput?.focus();
  }, 0);
}

function closeCustomEngineModal() {
  if (!customEngineOverlay) return;
  customEngineOverlay.classList.remove("active");
}

function saveCustomEngine() {
  const name = customEngineNameInput.value.trim();
  const urlTemplate = normalizeCustomEngineTemplate(customEngineUrlInput.value);

  if (!name || !isValidCustomEngineTemplate(urlTemplate)) return;

  settings.customEngine = {
    name,
    urlTemplate
  };

  persistSettings();
  applySettings();
  closeCustomEngineModal();
  showToast("自定义搜索引擎已保存");
}

function clearCustomEngine() {
  settings.customEngine = {
    name: "",
    urlTemplate: ""
  };

  if (settings.engine === "custom") {
    settings.engine = "google";
  }

  persistSettings();
  applySettings();
  closeCustomEngineModal();
  showToast("自定义搜索引擎已清空");
}

/* 天气权限逻辑 */

function getWeatherPermissionStatus() {
  return localStorage.getItem(STORAGE_WEATHER_PERMISSION) || "unknown";
}

function setWeatherPermissionStatus(status) {
  localStorage.setItem(STORAGE_WEATHER_PERMISSION, status);
}

function openWeatherPermissionModal() {
  if (!weatherPermissionOverlay) return;
  weatherPermissionOverlay.classList.add("active");
}

function closeWeatherPermissionModal() {
  if (!weatherPermissionOverlay) return;
  weatherPermissionOverlay.classList.remove("active");
}

function openWeatherRevokeModal() {
  if (!weatherRevokeOverlay) return;
  weatherRevokeOverlay.classList.add("active");
}

function closeWeatherRevokeModal() {
  if (!weatherRevokeOverlay) return;
  weatherRevokeOverlay.classList.remove("active");
}

function renderWeatherUnavailable(message = "天气信息暂不可用") {
  if (!weatherBox || !weatherText) return;
  weatherBox.classList.remove("hidden");
  weatherText.textContent = message;
}

const WEATHER_CITY_AUTO_LABEL = "自动（定位优先）";

/** 城市 id → 显示名；空值代表「自动」。 */
function getWeatherCityLabel(value) {
  if (!value) return WEATHER_CITY_AUTO_LABEL;
  const city = (window.WEATHER_CITIES || []).find((item) => item.id === value);
  return city ? city.name : WEATHER_CITY_AUTO_LABEL;
}

function createWeatherCityOption(value, label) {
  const option = document.createElement("button");
  option.type = "button";
  option.className = "custom-select-option";
  option.dataset.value = value;
  option.textContent = label;

  const active = (settings.weatherCity || "auto") === value;
  option.classList.toggle("active", active);
  option.setAttribute("aria-selected", active ? "true" : "false");

  return option;
}

/**
 * 渲染城市候选。清单只维护在 weather.js 一处，这里只负责按检索词过滤。
 * 检索为空时把「自动（定位优先）」放在首位；一旦开始检索就只留城市，
 * 免得这个固定项挤占本来就不多的结果。
 */
function renderWeatherCityList(query = "") {
  if (!weatherCityList) return;

  const matcher = window.matchWeatherCities;
  const cities = typeof matcher === "function"
          ? matcher(query)
          : (window.WEATHER_CITIES || []).slice();

  const fragment = document.createDocumentFragment();

  if (!String(query || "").trim()) {
    fragment.appendChild(createWeatherCityOption("auto", WEATHER_CITY_AUTO_LABEL));
  }

  cities.forEach((city) => {
    fragment.appendChild(createWeatherCityOption(city.id, city.name));
  });

  weatherCityList.textContent = "";
  weatherCityList.appendChild(fragment);

  if (weatherCityEmpty) {
    weatherCityEmpty.classList.toggle("hidden", cities.length > 0);
  }

  // 过滤后触发器上原来那个选项可能已经不在列表里了，
  // 这里按设置值直接回写标签，保证触发器始终显示当前选择。
  const textNode = weatherCitySelector?.querySelector(".custom-select-text");
  if (textNode) textNode.textContent = getWeatherCityLabel(settings.weatherCity);
}

/** 收起后复原检索状态，下次展开仍是完整清单。 */
function resetWeatherCitySearch() {
  if (weatherCitySearch) weatherCitySearch.value = "";
  renderWeatherCityList("");
}

/** 告诉用户「现在显示的是哪儿的天气、为什么是这儿」——兜底城市必须让人看得见。 */
function renderWeatherCitySummary() {
  if (!weatherCitySummary) return;

  if (!settings.weather) {
    weatherCitySummary.textContent = "未启用天气";
    return;
  }

  if (settings.weatherCity) {
    const city = (window.WEATHER_CITIES || []).find((item) => item.id === settings.weatherCity);
    weatherCitySummary.textContent = city ? `固定使用 ${city.name}，不使用定位` : "未启用天气";
    return;
  }

  const source = weatherBox?.dataset.citySource;
  const cityName = weatherBox?.dataset.city;

  if (source === "geo") {
    weatherCitySummary.textContent = "当前：定位位置";
  } else if (source === "timezone" && cityName) {
    weatherCitySummary.textContent = `当前：${cityName}（按系统时区推断，可手动指定）`;
  } else {
    weatherCitySummary.textContent = "定位优先；拿不到定位时按系统时区推断";
  }
}

function handleWeatherPermissionApproved() {
  setWeatherPermissionStatus("granted");
  settings.weather = true;
  persistSettings();
  applySettings();
  closeWeatherPermissionModal();
  refreshWeatherView(true);
}

function handleWeatherPermissionDenied() {
  settings.weather = false;
  persistSettings();
  applySettings();
  closeWeatherPermissionModal();
  showToast("天气信息暂不可用");
}

function handleWeatherPermissionRevoked() {
  setWeatherPermissionStatus("unknown");

  // 手动指定城市时不依赖定位，撤回授权不该顺手把天气一起关掉
  if (!settings.weatherCity) {
    settings.weather = false;
  }

  persistSettings();
  applySettings();
  closeWeatherRevokeModal();

  if (settings.weather) {
    refreshWeatherView(true);
    showToast("天气定位授权已撤回，继续按所选城市显示");
    return;
  }

  showToast("天气定位授权已撤回");
}

/* ==========================================================================
   一言（hitokoto）
   取数与文案格式都在 hitokoto.js，这里只管「什么时候显示、显示在哪」。
   和天气同一个原则：拿不到就整块隐藏，不留「暂无一言」这种死文案。
   ========================================================================== */

/**
 * 左下角品牌标识的显隐。
 * 显隐挂 body.has-wordmark，CSS 那边据此 display —— 不用 style.display，
 * 这样用户自己写在开发者工具里的样式也不会被我们的逻辑反复覆盖。
 */
function applyWordmark() {
  const on = settings.wordmark !== false;
  document.body.classList.toggle("has-wordmark", on);
  return on;
}

let hitokotoLoading = false;

function showHitokotoBar() {
  if (hitokotoBar) hitokotoBar.hidden = false;
}

function hideHitokotoBar() {
  if (hitokotoBar) hitokotoBar.hidden = true;
}

/**
 * 拉一句并填进页脚。
 * @param {boolean} force 点「换一句」时传 true，强制重新请求
 */
async function loadHitokoto(force) {
  if (typeof window.fetchHitokoto !== "function") {
    hideHitokotoBar();
    return;
  }
  // 屏上已经有句子时不重复请求 —— applySettings 在别的设置变动时也会被调到
  if (!force && hitokotoBar && !hitokotoBar.hidden
      && hitokotoText && hitokotoText.textContent) {
    return;
  }
  if (hitokotoLoading) return;
  hitokotoLoading = true;

  try {
    const item = await window.fetchHitokoto();
    // 请求在飞行中时用户可能已经把开关关了。这句不能省 ——
    // 少了它，一次慢响应就会把刚隐藏的页脚又显示出来。
    if (settings.hitokoto === false) {
      hideHitokotoBar();
      return;
    }
    if (hitokotoText) hitokotoText.textContent = item.text;
    if (hitokotoSource) {
      const source = window.formatHitokotoSource(item);
      hitokotoSource.textContent = source;
      // 有些句子没有出处，别留一段空白的尾巴
      hitokotoSource.hidden = !source;
    }
    showHitokotoBar();
  } catch (error) {
    // 网络不通、超时、返回体异常都走这里。页脚直接消失，不显示任何提示。
    hideHitokotoBar();
  } finally {
    hitokotoLoading = false;
  }
}

/** 跟随设置：关掉就收起，打开才去取。 */
function syncHitokoto() {
  if (settings.hitokoto === false) {
    hideHitokotoBar();
    return;
  }
  loadHitokoto(false);
}

/* 全局设置 */

function applySettings() {
  // 背景：自定义壁纸时 data-bg 仍要是一个真实的极光主题（图没存好前背景保持原样），
  // 位图图层的显隐、极光的停机、动效开关的置灰，都在 applyWallpaperBackground 里。
  applyWallpaperBackground();
  applyDynamicTheme(document.body.dataset.bg);

  syncCustomSelect(bgSelector, settings.bg);
  syncCustomSelect(engineSelector, settings.engine);
  syncCustomSelect(weatherCitySelector, settings.weatherCity || "auto");

  if (toggleShortcuts) toggleShortcuts.checked = settings.shortcuts;

  if (toggleWallpaperAnim) toggleWallpaperAnim.checked = settings.wallpaperAnim !== false;

  // 壁纸动效开关：applyWallpaperBackground 里已按「是否自定义壁纸」置灰并停机，
  // 这里只需把开关的勾选状态同步上（它被禁用时用户也看不到变化）

  if (toggleWeather) toggleWeather.checked = settings.weather;

  // 搜索建议开关
  if (toggleSuggestions) toggleSuggestions.checked = settings.suggestions !== false;

  // 一言页脚
  if (toggleHitokoto) toggleHitokoto.checked = settings.hitokoto !== false;
  syncHitokoto();

  // 左下角品牌标识
  if (toggleWordmark) toggleWordmark.checked = settings.wordmark !== false;
  applyWordmark();

  // 自定义壁纸（图层 + 选图区 + 缩略图）
  syncWallpaperUi();

  if (shortcutSection) {
    shortcutSection.classList.toggle("hidden-shortcuts", !settings.shortcuts);
  }

  if (weatherBox) {
    weatherBox.classList.toggle("hidden", !settings.weather);
  }

  if (addSiteBtn) {
    addSiteBtn.style.display = settings.shortcuts ? "inline-flex" : "none";
  }

  if (openWeatherRevokeBtn) {
    openWeatherRevokeBtn.disabled = getWeatherPermissionStatus() !== "granted";
    openWeatherRevokeBtn.classList.toggle(
        "is-disabled",
        getWeatherPermissionStatus() !== "granted"
    );
  }

  renderCustomEngineSummary();
  renderWeatherCitySummary();
}

function persistSettings() {
  save(STORAGE_SETTINGS, settings);
}

/* 搜索历史 */

function getHistory() {
  return load(STORAGE_HISTORY, []);
}

function addHistory(keyword) {
  const value = keyword.trim();
  if (!value) return;

  let history = getHistory();
  history = history.filter((item) => item !== value);
  history.unshift(value);

  save(STORAGE_HISTORY, history.slice(0, 20));
}

function clearHistory() {
  localStorage.removeItem(STORAGE_HISTORY);
}

function removeHistoryItem(keyword) {
  const history = getHistory().filter((item) => item !== keyword);
  save(STORAGE_HISTORY, history);
}

/* 搜索建议 */

function getSuggestionCacheKey(engine, keyword) {
  return `${engine}::${keyword.trim().toLowerCase()}`;
}

async function fetchJson(url, { timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // 区分「超时」和「跨域/网络被拦」，便于上层给出可行动的提示
    if (error?.name === "AbortError") {
      throw new Error("请求超时");
    }
    if (error instanceof TypeError) {
      throw new Error("网络或跨域被拦截");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchEngineSuggestions(keyword) {
  const query = keyword.trim();
  if (!query) return [];

  const engine = resolveSuggestEngine();
  const source = SUGGEST_SOURCES[engine];
  const label = ENGINE_LABELS[engine] || engine;
  const cacheKey = getSuggestionCacheKey(engine, query);

  if (suggestionCache.has(cacheKey)) {
    lastSuggestError = "";
    return suggestionCache.get(cacheKey);
  }

  let list = [];
  let failed = false;

  try {
    const data = await fetchJson(source.url(query));
    list = source.parse(data);
    lastSuggestError = "";
  } catch (error) {
    failed = true;
    console.error(`获取 ${engine} 搜索建议失败：`, error);
    // 把「不通」和「接口异常」分开，用户才知道该换引擎还是该重试
    const reason = /超时/.test(error.message) ? "网络超时"
        : (/网络或跨域/.test(error.message) ? "网络不通" : "");
    lastSuggestError = reason
        ? `${label} 搜索建议暂不可用（${reason}）`
        : `${label} 搜索建议暂不可用`;
  }

  const normalized = [...new Set(
      (list || [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
  )].slice(0, 8);

  // 失败的请求不写缓存，否则一次网络抖动会让该词条在本次会话里长期无建议
  if (!failed) suggestionCache.set(cacheKey, normalized);
  return normalized;
}

async function getSuggestions(keyword) {
  const value = keyword.trim();
  const valueLower = value.toLowerCase();
  const history = getHistory();

  if (!value) {
    lastSuggestError = "";
    return history.slice(0, 8);
  }

  const matchedHistory = history.filter((item) =>
      item.toLowerCase().includes(valueLower)
  );

  const matchedDefaults = DEFAULT_SUGGESTIONS.filter((item) =>
      item.toLowerCase().includes(valueLower)
  );

  // 搜索建议开关关闭时：只用本地记录，不发任何远程请求
  if (settings.suggestions === false) {
    return [...new Set([...matchedHistory, ...matchedDefaults])].slice(0, 8);
  }

  const remoteSuggestions = await fetchEngineSuggestions(value);

  return [...new Set([
    ...matchedHistory,
    ...matchedDefaults,
    ...remoteSuggestions
  ])].slice(0, 8);
}

/** 建议取不到时的一键补救：换到另一个可直连的引擎 */
function switchEngine(value) {
  if (!SEARCH_ENGINES[value]) return;

  settings.engine = value;
  persistSettings();
  syncCustomSelect(engineSelector, value);
  suggestionCache.clear();
  updateSuggestPanel();
  showToast(`已切换搜索引擎：${ENGINE_LABELS[value]}`);
}

function renderSuggestions(list) {
  if (!suggestList) return;

  suggestList.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "suggest-empty";

    const message = document.createElement("div");
    message.className = "suggest-empty-text";
    message.textContent = lastSuggestError || (
        searchInput?.value?.trim() ? "暂无搜索建议" : "暂无搜索记录"
    );
    empty.appendChild(message);

    // 失败态要给出下一步动作，而不是只报一句「不可用」
    const actions = [];
    if (lastSuggestError) {
      const better = SUGGEST_FALLBACK_HINT[resolveSuggestEngine()];
      if (better) {
        actions.push({
          label: `改用 ${ENGINE_LABELS[better]}`,
          run: () => switchEngine(better)
        });
      }
      actions.push({ label: "重试", run: () => updateSuggestPanel() });
    }

    if (actions.length) {
      const row = document.createElement("div");
      row.className = "suggest-empty-actions";

      actions.forEach(({ label, run }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "suggest-empty-btn";
        btn.textContent = label;
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          run();
        });
        row.appendChild(btn);
      });

      empty.appendChild(row);
    }

    suggestList.appendChild(empty);
    return;
  }

  const historySet = new Set(getHistory());

  list.forEach((text, index) => {
    const row = document.createElement("div");
    row.className = "suggest-item-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggest-item";
    btn.dataset.index = String(index);

    btn.innerHTML = `
      <span class="suggest-item-icon">⌕</span>
      <span class="suggest-item-text">${escapeHtml(text)}</span>
    `;

    btn.addEventListener("mouseenter", () => {
      activeSuggestionIndex = index;
      refreshSuggestionActiveState();
    });

    btn.addEventListener("click", () => {
      searchInput.value = text;
      closeSuggestPanel();

      setTimeout(() => {
        submitSearch(text);
      }, 180);
    });

    row.appendChild(btn);

    if (historySet.has(text)) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "suggest-delete-btn";
      deleteBtn.setAttribute("aria-label", `删除 ${text}`);
      deleteBtn.textContent = "×";

      deleteBtn.addEventListener("click", async (event) => {
        event.stopPropagation();
        removeHistoryItem(text);

        currentSuggestions = await getSuggestions(searchInput.value);
        activeSuggestionIndex = -1;
        renderSuggestions(currentSuggestions);

        showToast("该条记录已移除");
      });

      row.appendChild(deleteBtn);
    }

    suggestList.appendChild(row);
  });
}

function refreshSuggestionActiveState() {
  if (!suggestList) return;

  const items = suggestList.querySelectorAll(".suggest-item");
  items.forEach((item, index) => {
    item.classList.toggle("active", index === activeSuggestionIndex);
  });
}

async function openSuggestPanel() {
  const requestId = ++suggestRequestId;

  const suggestions = await getSuggestions(searchInput.value);
  if (requestId !== suggestRequestId) return;

  currentSuggestions = suggestions;
  activeSuggestionIndex = -1;
  renderSuggestions(currentSuggestions);
  setSearchActive(true);

  if (suggestPanel) {
    requestAnimationFrame(() => {
      suggestPanel.classList.add("active");
    });
  }
}

function closeSuggestPanel() {
  if (suggestPanel) {
    suggestPanel.classList.remove("active");
  }

  activeSuggestionIndex = -1;
  currentSuggestions = [];
  lastSuggestError = "";

  if (center) {
    center.classList.remove("search-active");
  }
}

async function updateSuggestPanel() {
  const requestId = ++suggestRequestId;

  const suggestions = await getSuggestions(searchInput.value);
  if (requestId !== suggestRequestId) return;

  currentSuggestions = suggestions;
  activeSuggestionIndex = -1;
  renderSuggestions(currentSuggestions);
  setSearchActive(true);

  if (suggestPanel && !suggestPanel.classList.contains("active")) {
    requestAnimationFrame(() => {
      suggestPanel.classList.add("active");
    });
  }
}

const debouncedUpdateSuggestPanel = debounce(updateSuggestPanel, 180);

function submitSearch(keyword) {
  const q = keyword.trim();
  if (!q) return;

  addHistory(q);
  closeSuggestPanel();

  // 主动 blur，确保 search-active 已被清除，防止 bfcache 恢复后位置错误
  if (searchInput) searchInput.blur();

  let url = "";

  if (settings.engine === "custom") {
    url = buildCustomSearchUrl(q) || SEARCH_ENGINES.google(q);
  } else {
    const engine = SEARCH_ENGINES[settings.engine] ? settings.engine : "google";
    url = SEARCH_ENGINES[engine](q);
  }

  setTimeout(() => {
    location.href = url;
  }, 120);
}

/* 快捷入口 */

function getSites() {
  return load(STORAGE_SITES, []);
}

function saveSites(data) {
  save(STORAGE_SITES, data);
}

function renderSites() {
  if (!shortcutBar) return;

  shortcutBar.innerHTML = "";
  const sites = getSites();

  sites.forEach((site, index) => {
    const link = document.createElement("a");
    link.href = site.url;
    link.className = "shortcut-item";
    link.title = site.title;
    link.target = "_self";

    link.innerHTML = `
      <span class="shortcut-title">${escapeHtml(site.title)}</span>
      <button class="shortcut-delete" type="button" aria-label="删除 ${escapeHtml(site.title)}">×</button>
    `;
    link.insertBefore(createShortcutIcon(site.url, site.title), link.firstChild);

    const deleteBtn = link.querySelector(".shortcut-delete");
    deleteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteSite(index, link);
    });

    shortcutBar.appendChild(link);
  });
}

function deleteSite(index, element) {
  if (element) {
    element.classList.add("removing");
    setTimeout(() => {
      const sites = getSites();
      sites.splice(index, 1);
      saveSites(sites);
      renderSites();
      showToast("网站已移除");
    }, 220);
    return;
  }

  const sites = getSites();
  sites.splice(index, 1);
  saveSites(sites);
  renderSites();
  showToast("网站已移除");
}

function updateAddButtonState() {
  const valid =
      siteNameInput &&
      siteUrlInput &&
      siteNameInput.value.trim() &&
      isValidUrl(siteUrlInput.value);

  if (!confirmAddBtn) return;

  confirmAddBtn.disabled = !valid;
  confirmAddBtn.classList.toggle("enabled", Boolean(valid));
}

function openModal() {
  if (!modalOverlay) return;

  modalOverlay.classList.add("active");

  if (siteNameInput) siteNameInput.value = "";
  if (siteUrlInput) siteUrlInput.value = "";

  updateAddButtonState();

  setTimeout(() => {
    if (siteNameInput) siteNameInput.focus();
  }, 0);
}

function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove("active");
}

function addSite() {
  const title = siteNameInput.value.trim();
  const url = normalizeUrl(siteUrlInput.value);

  if (!title || !isValidUrl(url)) return;

  const sites = getSites();
  sites.push({ title, url });
  saveSites(sites);
  renderSites();
  closeModal();
  showToast("网站已添加");
}

/* 设置面板 / 更多面板 */

function closeSettingsPanel() {
  if (settingsPanel) {
    settingsPanel.classList.remove("active");
  }
}

function toggleSettingsPanel() {
  if (settingsPanel) {
    settingsPanel.classList.toggle("active");
    if (settingsPanel.classList.contains("active") && morePanel) {
      morePanel.classList.remove("active");
    }
  }
}

function closeMorePanel() {
  if (morePanel) {
    morePanel.classList.remove("active");
  }
}

function toggleMorePanel() {
  if (morePanel) {
    morePanel.classList.toggle("active");
    if (morePanel.classList.contains("active") && settingsPanel) {
      settingsPanel.classList.remove("active");
    }
  }
}

/* 天气 */

function refreshWeatherView(forceRequest = false) {
  if (!weatherBox) return;

  weatherBox.classList.toggle("hidden", !settings.weather);

  if (!settings.weather) return;

  // 手动指定城市时压根不用定位，自然也不需要定位授权
  if (!settings.weatherCity && getWeatherPermissionStatus() !== "granted") {
    settings.weather = false;
    persistSettings();
    applySettings();
    return;
  }

  if (typeof initWeather === "function") {
    initWeather(forceRequest);
  } else if (weatherText) {
    weatherText.textContent = "天气加载中...";
  }

  renderWeatherCitySummary();
}

/* ==========================================================================
   自定义壁纸（图片只存在本机，压缩与存储在 wallpaper.js）
   与天气同一个原则：**不留死状态**。选了自定义壁纸但没选图时，背景保持原样，
   选图框直接推到面前；存不下、压不动、非图片，都有明确提示且不留下半成品。
   ========================================================================== */

/** 当前生效的壁纸记录（来自 chrome.storage.local），null = 本机没有图 */
let wallpaperRecord = null;
/** 压缩 / 写盘进行中，挡住重复点击 */
let wallpaperBusy = false;
/**
 * data-bg 要保持一个真实的极光主题 key，不能是 "custom"（aurora.js 不认它，
 * 会默默回落到 image1）。所以单独记住「切到自定义之前的那个主题」，
 * 选图期间背景才不会莫名变样。
 */
let lastMeshBg = "gradient";

function hasWallpaperImage() {
  return !!(wallpaperRecord && wallpaperRecord.dataUrl);
}

/**
 * 把背景状态落到 DOM 上。启动（initWallpaper）与用户改动设置（applySettings）都要走这里，
 * 否则会出现「用户改了才生效、重开页面就不对」的不一致。
 * @returns {boolean} 自定义壁纸是否真的在显示
 */
function applyWallpaperBackground() {
  const on = settings.bg === "custom" && hasWallpaperImage();
  // data-bg 必须是真实的极光主题 key（aurora.js 不认 "custom"，会默默回落到 image1）
  document.body.dataset.bg = settings.bg === "custom" ? lastMeshBg : settings.bg;
  document.body.classList.toggle("has-custom-wallpaper", on);

  // 深色壁纸时整套 UI 翻成暗色（只翻转文字与玻璃两类 token）。
  // 阈值是算出来的交叉点，见 wallpaper.js 的 WALLPAPER_DARK_LUMA 注释。
  const luma = wallpaperRecord ? wallpaperRecord.luma : null;
  document.body.classList.toggle("dark-wallpaper", on && typeof luma === "number"
    && luma < window.WALLPAPER_DARK_LUMA);

  // 位图没法动效：切到自定义壁纸就把极光停掉，切回来再按用户开关恢复。
  // 「壁纸动态效果」开关同时置灰（.setting-row:has(input:disabled) 已有样式）
  if (toggleWallpaperAnim) toggleWallpaperAnim.disabled = on;
  if (window.auroraEngine) {
    window.auroraEngine.setAnimated(!on && settings.wallpaperAnim !== false);
  }
  return on;
}

function applyWallpaperLayer() {
  if (!customWallpaperImg) return;
  const next = hasWallpaperImage() ? wallpaperRecord.dataUrl : "";
  if (customWallpaperImg.getAttribute("src") === next) return;
  if (next) customWallpaperImg.setAttribute("src", next);
  else customWallpaperImg.removeAttribute("src");
}

function syncWallpaperUi() {
  const custom = settings.bg === "custom";
  const showPicker = custom || hasWallpaperImage();

  if (wallpaperPicker) wallpaperPicker.classList.toggle("hidden", !showPicker);

  if (wallpaperThumb) {
    if (hasWallpaperImage()) {
      wallpaperThumb.style.backgroundImage = `url("${wallpaperRecord.dataUrl}")`;
      wallpaperThumb.classList.add("has-image");
    } else {
      wallpaperThumb.style.backgroundImage = "";
      wallpaperThumb.classList.remove("has-image");
    }
  }

  if (chooseWallpaperBtn) chooseWallpaperBtn.disabled = wallpaperBusy;
  if (clearWallpaperBtn) clearWallpaperBtn.disabled = !hasWallpaperImage() || wallpaperBusy;

  applyWallpaperLayer();
}

/** 打开系统选图框。file input 必须是真在 DOM 里（用 .visually-hidden 藏起来）。 */
function openWallpaperPicker() {
  if (!wallpaperFile) return;
  if (wallpaperFile.value) wallpaperFile.value = "";
  wallpaperFile.click();
}

/**
 * 压缩 → 存本机 → 立刻生效。任何一步失败都明确提示，并保证不留下「半张壁纸」。
 * @returns {Promise<boolean>} 是否成功
 */
async function pickWallpaperFile(file) {
  if (!file || wallpaperBusy) return false;
  wallpaperBusy = true;
  syncWallpaperUi();
  try {
    const record = await window.compressWallpaper(file);
    // 顺手测一下平均亮度，决定要不要切暗色变体（阈值见 wallpaper.js）
    record.luma = await window.analyzeWallpaperLuminance(record.dataUrl);
    await window.wallpaperStore.set(record);
    wallpaperRecord = record;
    settings.bg = "custom";
    persistSettings();
    applySettings();
    const size = window.formatWallpaperBytes(record.bytes);
    showToast(`壁纸已存在本机 · ${record.w}×${record.h} · ${size}`
      + (record.scaled ? "（已按屏幕压缩）" : ""));
    return true;
  } catch (error) {
    // 压不动 / 配额不足 / 不是图片 —— 背景保持原样，只给一句人话
    showToast(`壁纸没设成：${error && error.message ? error.message : "图片处理失败"}`);
    return false;
  } finally {
    wallpaperBusy = false;
    syncWallpaperUi();
  }
}

/** 移除本机存的图，并回到极光主题。 */
async function clearWallpaper() {
  try {
    await window.wallpaperStore.remove();
  } catch (error) {
    showToast("移除失败，本地存储没响应");
    return;
  }
  wallpaperRecord = null;
  if (settings.bg === "custom") {
    settings.bg = lastMeshBg || "gradient";
    persistSettings();
  }
  applySettings();
  showToast("已移除自定义壁纸");
}

/** 启动时把本机存的图读回来。找不到图就退回极光，绝不留空白背景。 */
async function initWallpaper() {
  if (settings.bg !== "custom") lastMeshBg = settings.bg;
  try {
    wallpaperRecord = await window.wallpaperStore.get();
  } catch (error) {
    wallpaperRecord = null;
  }
  // 早于「深色变体」存下的记录没有 luma 字段，补测一次再落状态
  if (wallpaperRecord && typeof wallpaperRecord.luma !== "number") {
    wallpaperRecord.luma = await window.analyzeWallpaperLuminance(wallpaperRecord.dataUrl);
    try { await window.wallpaperStore.set(wallpaperRecord); } catch (error) { /* 补测失败不影响显示 */ }
  }
  if (settings.bg === "custom" && !hasWallpaperImage()) {
    settings.bg = lastMeshBg || "gradient";
    persistSettings();
    showToast("没找到已保存的壁纸，已切回原来的背景");
  }
  // 启动路径不走 applySettings（它一直是用户改动时才调），所以这里自己落一次背景状态
  applyWallpaperBackground();
  syncWallpaperUi();
}

/* 绑定事件 */

renderWeatherCityList("");

// 城市菜单是检索型的：展开即清空上次的检索词，并把光标交给检索框
onCustomSelectOpen = (selectRoot) => {
  if (selectRoot !== weatherCitySelector) return;
  resetWeatherCitySearch();
  if (weatherCitySearch) {
    window.setTimeout(() => weatherCitySearch.focus({ preventScroll: true }), 0);
  }
};

if (weatherCitySearch) {
  weatherCitySearch.addEventListener("input", () => {
    renderWeatherCityList(weatherCitySearch.value);
  });

  weatherCitySearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      // 交给检索框自己处理：先清空，再关菜单
      event.stopPropagation();
      if (weatherCitySearch.value) {
        weatherCitySearch.value = "";
        renderWeatherCityList("");
      } else {
        closeCustomSelect(weatherCitySelector);
      }
      return;
    }

    // 回车直接选中第一条候选，12306 也是这个手感
    if (event.key === "Enter") {
      event.preventDefault();
      weatherCityList?.querySelector(".custom-select-option")?.click();
    }
  });
}

/* --------------------------------------------------------------------------
   滑动条自动隐藏
   静止时滑动条是全透明的（写在 CSS 里），滚动时才现身，停手一会儿再收回去。
   「正在滚」这件事 CSS 判断不了，只能脚本给正在滚的那个元素挂个标记。
   scroll 事件不冒泡，所以在 document 上用捕获阶段听 —— 一处管全部滚动容器，
   以后再新增容器不用回来补监听。
   -------------------------------------------------------------------------- */

const SCROLLBAR_IDLE_MS = 700;
let scrollbarTimer = 0;
let scrollbarTarget = null;

function flashScrollbar(el) {
  if (!el || !el.classList) return;

  // 同一时刻只让一个容器亮着：换容器了就把上一个的标记摘掉
  if (scrollbarTarget && scrollbarTarget !== el) {
    scrollbarTarget.classList.remove("is-scrolling");
  }
  scrollbarTarget = el;
  el.classList.add("is-scrolling");

  window.clearTimeout(scrollbarTimer);
  scrollbarTimer = window.setTimeout(() => {
    if (scrollbarTarget) scrollbarTarget.classList.remove("is-scrolling");
    scrollbarTarget = null;
  }, SCROLLBAR_IDLE_MS);
}

document.addEventListener("scroll", (event) => {
  flashScrollbar(event.target);
}, true);

setupCustomSelect(bgSelector, (value) => {
  // 记住切走之前的极光主题：自定义壁纸没配好时，背景要停在原样而不是空白
  if (value !== "custom") lastMeshBg = value;
  settings.bg = value;
  persistSettings();
  applySettings();

  // 选了「自定义壁纸」但本机还没图 —— 把选图框推到面前，并说明背景暂时不变。
  // 不用「先切过去再等图」：那一瞬背景会变成一块空白，是这个功能最糟的状态。
  if (value === "custom" && !hasWallpaperImage()) {
    openWallpaperPicker();
    showToast("先选一张图片，背景暂时保持原样");
  }
});

setupCustomSelect(weatherCitySelector, (value) => {
  settings.weatherCity = value === "auto" ? "" : value;
  persistSettings();
  applySettings();
  refreshWeatherView(true);
});

setupCustomSelect(engineSelector, (value) => {
  settings.engine = value;
  persistSettings();
  applySettings();

  if (searchInput && document.activeElement === searchInput && searchInput.value.trim()) {
    updateSuggestPanel();
  }
});

// 面板一滚动，菜单就偏离了原来算好的位置，重算一次，
// 免得它被裁在半路（下拉是 absolute 定位，不跟着滚动走）
{
  const scroller = settingsPanel?.querySelector(".settings-body");
  if (scroller) {
    scroller.addEventListener("scroll", () => {
      const opened = [bgSelector, engineSelector, weatherCitySelector]
              .find((selectRoot) => selectRoot?.classList.contains("open"));
      if (opened) positionCustomSelectMenu(opened);
    }, { passive: true });
  }
}

if (toggleSuggestions) {
  toggleSuggestions.addEventListener("change", () => {
    settings.suggestions = toggleSuggestions.checked;
    persistSettings();
  });
}

if (toggleHitokoto) {
  toggleHitokoto.addEventListener("change", () => {
    settings.hitokoto = toggleHitokoto.checked;
    persistSettings();
    applySettings();
  });
}

if (toggleWordmark) {
  toggleWordmark.addEventListener("change", () => {
    settings.wordmark = toggleWordmark.checked;
    persistSettings();
    applyWordmark();
  });
}

if (hitokotoBtn) {
  hitokotoBtn.addEventListener("click", () => {
    loadHitokoto(true);
  });
}

if (chooseWallpaperBtn) {
  chooseWallpaperBtn.addEventListener("click", () => openWallpaperPicker());
}

if (clearWallpaperBtn) {
  clearWallpaperBtn.addEventListener("click", () => clearWallpaper());
}

if (wallpaperFile) {
  wallpaperFile.addEventListener("change", () => {
    const file = wallpaperFile.files && wallpaperFile.files[0];
    // 处理完就把 input 清空，否则重选同一张文件不会再触发 change
    wallpaperFile.value = "";
    if (file) pickWallpaperFile(file);
  });
}

// 启动时把本机存的壁纸读回来（异步，不阻塞首屏；图没到位前背景是极光，不会空白）
initWallpaper();

// 标识显隐也要在启动时落一次：applySettings 只在用户改动设置时才调，
// 少了这一句，用户关掉标识后刷新页面又会冒出来
applyWordmark();

if (toggleShortcuts) {
  toggleShortcuts.addEventListener("change", () => {
    settings.shortcuts = toggleShortcuts.checked;
    persistSettings();
    applySettings();
  });
}

if (toggleWallpaperAnim) {
  toggleWallpaperAnim.addEventListener("change", () => {
    const anim = toggleWallpaperAnim.checked;
    settings.wallpaperAnim = anim;
    persistSettings();
    // 直接通知引擎，即按即动、即关即停，不经过 applySettings 延迟
    if (window.auroraEngine) {
      window.auroraEngine.setAnimated(anim);
    }
  });
}

if (toggleWeather) {
  toggleWeather.addEventListener("change", () => {
    if (!toggleWeather.checked) {
      settings.weather = false;
      persistSettings();
      applySettings();
      refreshWeatherView();
      return;
    }

    // 已手动指定城市时不需要定位授权，直接开
    if (settings.weatherCity || getWeatherPermissionStatus() === "granted") {
      settings.weather = true;
      persistSettings();
      applySettings();
      refreshWeatherView(true);
      return;
    }

    toggleWeather.checked = false;
    settings.weather = false;
    persistSettings();
    applySettings();
    openWeatherPermissionModal();
  });
}

if (openWeatherRevokeBtn) {
  openWeatherRevokeBtn.addEventListener("click", () => {
    if (getWeatherPermissionStatus() !== "granted") return;
    openWeatherRevokeModal();
  });
}

if (confirmWeatherPermissionBtn) {
  confirmWeatherPermissionBtn.addEventListener("click", () => {
    handleWeatherPermissionApproved();
  });
}

if (denyWeatherPermissionBtn) {
  denyWeatherPermissionBtn.addEventListener("click", () => {
    handleWeatherPermissionDenied();
  });
}

if (closeWeatherPermissionBtn) {
  closeWeatherPermissionBtn.addEventListener("click", () => {
    handleWeatherPermissionDenied();
  });
}

if (confirmWeatherRevokeBtn) {
  confirmWeatherRevokeBtn.addEventListener("click", () => {
    handleWeatherPermissionRevoked();
  });
}

if (cancelWeatherRevokeBtn) {
  cancelWeatherRevokeBtn.addEventListener("click", () => {
    closeWeatherRevokeModal();
  });
}

// weather.js 取到数据（或改用了兜底城市）后回调，刷新设置面板里的说明文字
window.addEventListener("weatherresolved", () => {
  renderWeatherCitySummary();
});

if (closeWeatherRevokeBtn) {
  closeWeatherRevokeBtn.addEventListener("click", () => {
    closeWeatherRevokeModal();
  });
}

if (openCustomEngineBtn) {
  openCustomEngineBtn.addEventListener("click", () => {
    openCustomEngineModal();
  });
}

if (closeCustomEngineBtn) {
  closeCustomEngineBtn.addEventListener("click", () => {
    closeCustomEngineModal();
  });
}

if (saveCustomEngineBtn) {
  saveCustomEngineBtn.addEventListener("click", () => {
    saveCustomEngine();
  });
}

if (clearCustomEngineBtn) {
  clearCustomEngineBtn.addEventListener("click", () => {
    closeCustomEngineModal();
  });
}

if (customEngineNameInput) {
  customEngineNameInput.addEventListener("input", updateCustomEngineButtonState);
}

if (customEngineUrlInput) {
  customEngineUrlInput.addEventListener("input", updateCustomEngineButtonState);
}

if (privacyInfoBtn) {
  privacyInfoBtn.addEventListener("click", () => {
    showToast("定位仅用于天气展示，数据仅保存在本地");
    closeMorePanel();
  });
}

if (searchForm) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitSearch(searchInput.value);
  });
}

// bfcache 恢复时（用户按返回键）强制复位搜索框位置
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    closeSuggestPanel();
    if (searchInput) {
      searchInput.value = "";
      searchInput.blur();
    }
  }
});

if (searchInput) {
  searchInput.addEventListener("focus", () => {
    openSuggestPanel();
  });

  searchInput.addEventListener("input", () => {
    debouncedUpdateSuggestPanel();
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      const stillInsideSearch =
          searchArea && activeEl && searchArea.contains(activeEl);

      if (!stillInsideSearch) {
        closeSuggestPanel();
      }
    }, 80);
  });

  searchInput.addEventListener("keydown", (event) => {
    if (!suggestPanel || !suggestPanel.classList.contains("active")) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!currentSuggestions.length) return;

      activeSuggestionIndex =
          (activeSuggestionIndex + 1) % currentSuggestions.length;

      refreshSuggestionActiveState();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!currentSuggestions.length) return;

      activeSuggestionIndex =
          activeSuggestionIndex <= 0
              ? currentSuggestions.length - 1
              : activeSuggestionIndex - 1;

      refreshSuggestionActiveState();
    }

    if (
        event.key === "Enter" &&
        activeSuggestionIndex >= 0 &&
        currentSuggestions[activeSuggestionIndex]
    ) {
      event.preventDefault();

      const selected = currentSuggestions[activeSuggestionIndex];
      searchInput.value = selected;
      closeSuggestPanel();

      setTimeout(() => {
        submitSearch(selected);
      }, 180);
    }

    if (event.key === "Escape") {
      closeSuggestPanel();
      searchInput.blur();
    }
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    clearHistory();
    currentSuggestions = [];
    activeSuggestionIndex = -1;
    lastSuggestError = "";
    if (searchInput) searchInput.value = "";
    renderSuggestions([]);
    showToast("搜索记录已清空");
  });
}

if (addSiteBtn) addSiteBtn.addEventListener("click", openModal);
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelAddBtn) cancelAddBtn.addEventListener("click", closeModal);
if (siteNameInput) siteNameInput.addEventListener("input", updateAddButtonState);
if (siteUrlInput) siteUrlInput.addEventListener("input", updateAddButtonState);
if (confirmAddBtn) confirmAddBtn.addEventListener("click", addSite);

if (settingsBtn) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });
}

if (moreBtn) {
  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMorePanel();
  });
}

document.addEventListener("click", (event) => {
  const clickedInsideSearch =
      searchArea && searchArea.contains(event.target);

  if (!clickedInsideSearch) {
    closeSuggestPanel();
  }

  const clickedInsideSettings =
      settingsPanel && settingsPanel.contains(event.target);
  const clickedOnSettingsBtn =
      settingsBtn && settingsBtn.contains(event.target);

  // 天气授权 / 撤回弹窗是从设置面板里点出来的，属于同一条流程，
  // 不该顺手把面板关掉 —— 否则「开天气 → 同意 → 设城市」会被打断。
  const clickedInsideWeatherModal =
      (weatherPermissionOverlay && weatherPermissionOverlay.contains(event.target)) ||
      (weatherRevokeOverlay && weatherRevokeOverlay.contains(event.target));

  if (!clickedInsideSettings && !clickedOnSettingsBtn && !clickedInsideWeatherModal) {
    closeSettingsPanel();
  }

  const clickedInsideMore =
      morePanel && morePanel.contains(event.target);
  const clickedOnMoreBtn =
      moreBtn && moreBtn.contains(event.target);

  if (!clickedInsideMore && !clickedOnMoreBtn) {
    closeMorePanel();
  }

  const clickedInsideCustomSelect =
      (bgSelector && bgSelector.contains(event.target)) ||
      (engineSelector && engineSelector.contains(event.target)) ||
      (weatherCitySelector && weatherCitySelector.contains(event.target));

  if (!clickedInsideCustomSelect) {
    closeAllCustomSelects();
  }

  if (modalOverlay && modalOverlay.classList.contains("active")) {
    const clickedInsideModal =
        addSiteModal && addSiteModal.contains(event.target);

    if (!clickedInsideModal && event.target === modalOverlay) {
      closeModal();
    }
  }

  if (customEngineOverlay && customEngineOverlay.classList.contains("active")) {
    const clickedInsideCustomEngineModal =
        customEngineModal && customEngineModal.contains(event.target);

    if (!clickedInsideCustomEngineModal && event.target === customEngineOverlay) {
      closeCustomEngineModal();
    }
  }

  if (weatherRevokeOverlay && weatherRevokeOverlay.classList.contains("active")) {
    // 撤回授权弹窗：点击遮罩不关闭，用户必须主动点按钮
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (modalOverlay && modalOverlay.classList.contains("active")) {
    closeModal();
  }

  if (customEngineOverlay && customEngineOverlay.classList.contains("active")) {
    closeCustomEngineModal();
  }

  // 授权弹窗（weatherPermission / weatherRevoke）不响应 Escape 关闭

  closeAllCustomSelects();
  closeSettingsPanel();
  closeMorePanel();
  closeSuggestPanel();
});

function init() {
  // 一次性引擎迁移需要落盘，否则下次打开又会被重新迁移一遍
  if (engineMigratedToBing) persistSettings();

  applySettings();
  closeAllCustomSelects();
  renderSites();
  refreshWeatherView();
}

init();

/* ==========================================================================
   时钟块（v1.4 新增）
   时间用 Fraunces 艺术衬线、日期用 Noto Serif SC，均为 SIL OFL 开源字库。
   策略：先对齐到下一个整分钟，之后每分钟跳动一次，避免每秒唤醒计时器。
   ========================================================================== */

const clockTimeEl = document.getElementById("clockTime");
const clockDateEl = document.getElementById("clockDate");

const WEEKDAYS_CN = [
  "星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function renderClock() {
  const now = new Date();
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

  if (clockTimeEl) {
    clockTimeEl.textContent = hhmm;
    clockTimeEl.setAttribute("datetime", hhmm);
  }

  if (clockDateEl) {
    clockDateEl.textContent =
        `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS_CN[now.getDay()]}`;
  }
}

function startClock() {
  if (!clockTimeEl && !clockDateEl) return;

  renderClock();

  const now = new Date();
  const msToNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  setTimeout(() => {
    renderClock();
    setInterval(renderClock, 60 * 1000);
  }, Math.max(msToNextMinute, 0));

  // bfcache 恢复 / 切回前台时立即校正，避免显示离开前的时间
  window.addEventListener("pageshow", renderClock);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderClock();
  });
}

startClock();