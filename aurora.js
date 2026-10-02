/**
 * aurora.js — Mesh Gradient 流体渐变壁纸引擎 v3
 *
 * v3 改动：
 *   - 运动速度提升 5x，让流动肉眼可见（约 6~10s 一个周期）
 *   - 颜色控制点对比度大幅拉开，产生明显的色区流动感
 *   - IDW 指数从 4 降到 2，色块更大、扩散更广
 *   - 降采样比例 SCALE 从 5 降到 4，细节更清晰
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────────────────
     主题配色表  —  颜色差异故意拉大，让流动肉眼可见
  ───────────────────────────────────────────────────────── */
  const MESH_THEMES = {

    /**
     * image1 — 暮色绯雾
     * 玫绯色系（Rose-Crimson Family）：
     *   深枣红  →  玫绯  →  橙粉  →  暖紫  →  绯白
     * 傍晚天空感：深处压枣红，亮处透橙粉，
     * 中间带暖紫过渡，制造日落余晖的层次。
     * R 普遍偏高，G 中等，B 在暗部偏低、亮部微升，
     * 与青色系形成最大对比。
     */
    image1: {
      accent:       "#b04060",
      accentStrong: "#8a2a44",
      accentShadow: "rgba(160, 55, 85, 0.20)",
      accentRing:   "rgba(176, 64, 96, 0.18)",
      points: [
        { r: 155, g:  55, b:  72 },   // 深枣红（暗锚点）
        { r: 218, g: 105, b: 118 },   // 玫绯（主色）
        { r: 248, g: 188, b: 172 },   // 橙粉（最亮）
        { r: 185, g:  80, b: 108 },   // 暗玫红
        { r: 235, g: 145, b: 128 },   // 珊瑚橘（偏橙）
        { r: 175, g:  88, b: 130 },   // 暖紫红（偏紫）
        { r: 245, g: 210, b: 200 },   // 绯白（亮角）
        { r: 128, g:  48, b:  75 },   // 深枣紫（暗角）
      ]
    },

    /**
     * image2 — 云岚青影
     * 青色系（Cyan Family）全新设计：
     *   深墨青  →  亮青  →  薄荷白  →  青绿  →  冰青蓝
     * 青色本质是 绿+蓝 的混合，R 值偏低，G/B 均高。
     * 刻意在深青(暗)与薄荷白(亮)之间制造明暗落差，
     * 在青绿(偏G)与冰青蓝(偏B)之间制造冷暖偏色，
     * 流动时能看到从翠绿到海蓝的色区漂移。
     */
    image2: {
      accent:       "#2e9494",
      accentStrong: "#1c6e6e",
      accentShadow: "rgba(30, 140, 140, 0.20)",
      accentRing:   "rgba(46, 148, 148, 0.18)",
      points: [
        { r:  32, g: 140, b: 138 },   // 深墨青（暗锚点）
        { r: 110, g: 210, b: 200 },   // 亮青绿（中间调）
        { r: 210, g: 240, b: 238 },   // 薄荷白（最亮）
        { r:  55, g: 170, b: 165 },   // 中青（主色）
        { r: 145, g: 220, b: 195 },   // 青绿（偏绿）
        { r:  75, g: 190, b: 210 },   // 冰青蓝（偏蓝）
        { r: 180, g: 235, b: 230 },   // 浅薄荷
        { r:  42, g: 115, b: 128 },   // 深青蓝（暗角）
      ]
    },

    /**
     * gradient — 暖奶茶系
     * accent: 从壁纸中最深的暖棕色调中提取
     */
    gradient: {
      // 强调色：暖棕玫 → 深暖棕（仿 Material You tonal 提取）
      accent:       "#9c7b6e",
      accentStrong: "#7a5d52",
      accentShadow: "rgba(140, 100, 80, 0.18)",
      accentRing:   "rgba(156, 123, 110, 0.16)",
      points: [
        { r: 255, g: 220, b: 190 },
        { r: 240, g: 200, b: 210 },
        { r: 255, g: 245, b: 228 },
        { r: 220, g: 195, b: 185 },
        { r: 250, g: 225, b: 200 },
        { r: 235, g: 210, b: 218 },
        { r: 255, g: 235, b: 215 },
        { r: 225, g: 205, b: 200 },
      ]
    },

    /**
     * warm — 焦糖蜂蜜系
     * accent: 从焦糖橘调中提取
     */
    warm: {
      accent:       "#b07840",
      accentStrong: "#8a5c2c",
      accentShadow: "rgba(160, 110, 50, 0.18)",
      accentRing:   "rgba(176, 120, 64, 0.16)",
      points: [
        { r: 255, g: 210, b: 140 },
        { r: 235, g: 170, b: 110 },
        { r: 255, g: 245, b: 210 },
        { r: 215, g: 175, b: 140 },
        { r: 255, g: 225, b: 170 },
        { r: 240, g: 190, b: 150 },
        { r: 255, g: 235, b: 195 },
        { r: 220, g: 165, b: 125 },
      ]
    },

    /**
     * cool — 薄雾冰川系
     * accent: 从最深的钢蓝色中提取
     */
    cool: {
      accent:       "#6a87a0",
      accentStrong: "#4e6a80",
      accentShadow: "rgba(80, 110, 140, 0.18)",
      accentRing:   "rgba(106, 135, 160, 0.16)",
      points: [
        { r: 195, g: 210, b: 228 },
        { r: 225, g: 235, b: 245 },
        { r: 245, g: 246, b: 248 },
        { r: 200, g: 215, b: 225 },
        { r: 210, g: 225, b: 235 },
        { r: 185, g: 205, b: 220 },
        { r: 230, g: 238, b: 242 },
        { r: 205, g: 218, b: 230 },
      ]
    }
  };

  /* ─────────────────────────────────────────────────────────
     ORB_THEMES 已全部迁移至 MESH_THEMES，保留空对象作兼容占位
  ───────────────────────────────────────────────────────── */
  const ORB_THEMES = {};



  /* ─────────────────────────────────────────────────────────
     工具
  ───────────────────────────────────────────────────────── */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /* ─────────────────────────────────────────────────────────
     MeshPoint — 颜色控制点
  ───────────────────────────────────────────────────────── */
  class MeshPoint {
    constructor(color, index, total) {
      this.r = color.r;
      this.g = color.g;
      this.b = color.b;

      // 黄金角均匀分布
      const angle  = (index / total) * Math.PI * 2 * 1.618;
      const radius = 0.15 + (index / total) * 0.38;
      this.baseX = 0.5 + Math.cos(angle) * radius;
      this.baseY = 0.5 + Math.sin(angle) * radius;

      // 随机相位
      this.phaseX = Math.random() * Math.PI * 2;
      this.phaseY = Math.random() * Math.PI * 2;

      // ★ 速度比 v2 快 5 倍，约 6~10s 一个周期
      this.speedX = 0.00028 + Math.random() * 0.00018;
      this.speedY = 0.00024 + Math.random() * 0.00016;

      // ★ 漂移幅度加大，运动范围更大
      this.ampX = 0.22 + Math.random() * 0.16;
      this.ampY = 0.18 + Math.random() * 0.14;
    }

    pos(t) {
      return {
        x: this.baseX + Math.sin(t * this.speedX + this.phaseX) * this.ampX,
        y: this.baseY + Math.sin(t * this.speedY + this.phaseY) * this.ampY,
      };
    }
  }

  /* ─────────────────────────────────────────────────────────
     MeshRenderer
  ───────────────────────────────────────────────────────── */
  class MeshRenderer {
    constructor() {
      this.SCALE = 4;         // 降采样比，越小细节越清晰但越耗性能
      this.off   = document.createElement("canvas");
      this.offCtx = this.off.getContext("2d");
      this.points = [];
      this.W = 0;
      this.H = 0;
    }

    resize(w, h) {
      this.W = Math.ceil(w / this.SCALE);
      this.H = Math.ceil(h / this.SCALE);
      this.off.width  = this.W;
      this.off.height = this.H;
    }

    setPoints(pts) { this.points = pts; }

    render(t) {
      const pts  = this.points;
      const nPts = pts.length;
      if (!nPts) return;

      const W = this.W, H = this.H;

      // 预计算各点当前像素坐标
      const px = new Float32Array(nPts);
      const py = new Float32Array(nPts);
      for (let i = 0; i < nPts; i++) {
        const p = pts[i].pos(t);
        px[i] = p.x * W;
        py[i] = p.y * H;
      }

      const img  = this.offCtx.createImageData(W, H);
      const data = img.data;

      for (let row = 0; row < H; row++) {
        for (let col = 0; col < W; col++) {
          let sumW = 0, sumR = 0, sumG = 0, sumB = 0;

          for (let i = 0; i < nPts; i++) {
            const dx = col - px[i];
            const dy = row - py[i];
            const d2 = dx * dx + dy * dy;

            if (d2 < 0.01) {
              sumR = pts[i].r; sumG = pts[i].g; sumB = pts[i].b;
              sumW = 1;
              break;
            }

            // ★ IDW 指数用 d^2（原来是 d^4），色块更大更柔和
            const w = 1 / d2;
            sumW += w;
            sumR += pts[i].r * w;
            sumG += pts[i].g * w;
            sumB += pts[i].b * w;
          }

          const base = (row * W + col) * 4;
          data[base]     = sumR / sumW;
          data[base + 1] = sumG / sumW;
          data[base + 2] = sumB / sumW;
          data[base + 3] = 255;
        }
      }

      this.offCtx.putImageData(img, 0, 0);
    }

    drawTo(ctx, W, H) {
      // imageSmoothingQuality = high 确保放大时双线性插值最优质
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(this.off, 0, 0, W, H);
    }
  }

  /* ─────────────────────────────────────────────────────────
     OrbRenderer（兼容 image1 暮色绯雾）
  ───────────────────────────────────────────────────────── */
  class OrbRenderer {
    constructor(canvas, palette) {
      this.canvas = canvas;
      this.base   = [...palette.base];
      this.orbs   = palette.orbs.map((o, i) => ({
        colorStr: o.color,
        relSize:  o.size,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        phaseA: Math.random() * Math.PI * 2,
        speedX: 0.00018 + Math.random() * 0.00012,
        speedY: 0.00015 + Math.random() * 0.00012,
        speedA: 0.00025 + Math.random() * 0.00015,
        ampX:   0.15 + Math.random() * 0.12,
        ampY:   0.12 + Math.random() * 0.10,
        baseX:  ((i % 2) + 0.5) / 2,
        baseY:  (Math.floor(i / 2) + 0.5) / 2,
        aMin: 0.32, aMax: 0.68
      }));
    }

    draw(ctx, t) {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.width  / dpr;
      const h = this.canvas.height / dpr;
      ctx.fillStyle = `rgb(${this.base.map(Math.round).join(",")})`;
      ctx.fillRect(0, 0, w, h);
      this.orbs.forEach(orb => {
        const x = (orb.baseX + Math.sin(t * orb.speedX + orb.phaseX) * orb.ampX) * w;
        const y = (orb.baseY + Math.sin(t * orb.speedY + orb.phaseY) * orb.ampY) * h;
        const r = orb.relSize * Math.max(w, h);
        const a = lerp(orb.aMin, orb.aMax, (Math.sin(t * orb.speedA + orb.phaseA) + 1) / 2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0,   `rgba(${orb.colorStr},${a.toFixed(3)})`);
        g.addColorStop(0.5, `rgba(${orb.colorStr},${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1,   `rgba(${orb.colorStr},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  /* ─────────────────────────────────────────────────────────
     AuroraEngine — 主引擎
  ───────────────────────────────────────────────────────── */
  class AuroraEngine {
    constructor() {
      this.canvas = document.getElementById("auroraCanvas");
      this.ctx    = this.canvas?.getContext("2d");
      if (!this.canvas || !this.ctx) return;

      this.mesh       = new MeshRenderer();
      this.renderer   = null;
      this.isMesh     = false;
      this.currentKey = null;

      // 动态/静态控制
      this.animated   = true;   // 默认动态，由外部 setAnimated() 修改
      this._rafId     = null;
      this._timeOffset = 0;      // 暂停期间累积的时间偏移，避免恢复时跳帧
      this._pausedAt   = null;   // 暂停时刻（performance.now()），null=未暂停

      // 过渡快照
      this.snapping    = false;
      this.snapCanvas  = null;
      this.snapStart   = 0;
      this.snapDur     = 700;

      this._resize();
      window.addEventListener("resize", () => this._resize(), { passive: true });
      new MutationObserver(() => this._onThemeChange())
        .observe(document.body, { attributes: true, attributeFilter: ["data-bg"] });

      this._onThemeChange();
      this._rafId = requestAnimationFrame(t => this._loop(t));
    }

    /**
     * 设置动态/静态模式
     * animated=true  → 正常跑 rAF 循环，从原位置继续（不跳帧）
     * animated=false → 停止循环，渲染一帧静态画面后冻结
     */
    setAnimated(animated) {
      if (this.animated === animated) return;
      this.animated = animated;

      if (animated) {
        // 补偿暂停期间流逝的时间，让动画从原位置继续而不跳帧
        if (this._pausedAt !== null) {
          this._timeOffset += performance.now() - this._pausedAt;
          this._pausedAt = null;
        }
        // 重新启动循环
        if (!this._rafId) {
          this._rafId = requestAnimationFrame(t => this._loop(t));
        }
      } else {
        // 记录暂停时刻，供恢复时计算偏移
        this._pausedAt = performance.now();
        // 先渲染最后一帧再停止（用修正时间，保证和循环时一致）
        this._draw(performance.now() - this._timeOffset);
        if (this._rafId) {
          cancelAnimationFrame(this._rafId);
          this._rafId = null;
        }
      }
    }

    _resize() {
      const dpr = window.devicePixelRatio || 1;
      const W = window.innerWidth, H = window.innerHeight;
      this.canvas.width  = W * dpr;
      this.canvas.height = H * dpr;
      this.canvas.style.width  = W + "px";
      this.canvas.style.height = H + "px";
      this.ctx.scale(dpr, dpr);
      this.mesh.resize(W, H);
    }

    _onThemeChange() {
      const key = document.body.dataset.bg || "gradient";
      if (key === this.currentKey) return;

      // 拍快照
      const W = window.innerWidth, H = window.innerHeight;
      const snap = document.createElement("canvas");
      snap.width = W; snap.height = H;
      snap.getContext("2d").drawImage(this.canvas, 0, 0, W, H);
      this.snapCanvas = snap;
      this.snapping   = true;
      this.snapStart  = performance.now();

      this.currentKey = key;

      const theme = MESH_THEMES[key] || ORB_THEMES[key];
      if (theme) this._applyAccent(theme);

      if (MESH_THEMES[key]) {
        this.isMesh = true;
        const pts = MESH_THEMES[key].points;
        const meshPts = pts.map((c, i) => new MeshPoint(c, i, pts.length));
        this.mesh.setPoints(meshPts);
      } else {
        this.isMesh = false;
        const pal = ORB_THEMES[key] || ORB_THEMES.image1;
        this.renderer = new OrbRenderer(this.canvas, pal);
      }

      // 动效关闭时，rAF 循环已停止，需要手动驱动快照渐变过渡
      // 否则画面会永远冻在旧壁纸快照上，看起来"切换没反应"
      if (!this.animated) {
        this._runSnapTransition();
      }
    }

    /**
     * 静态模式下手动驱动快照渐变过渡（约 snapDur ms）
     * 过渡结束后在新壁纸位置渲染一帧并冻结
     */
    _runSnapTransition() {
      const drive = (t) => {
        // 静态模式下暂停计时器已在运行，用修正时间保持壁纸帧一致
        this._draw(t - this._timeOffset);
        if (this.snapping) {
          // 过渡还没结束，继续驱动（不依赖 this.animated）
          requestAnimationFrame(drive);
        }
        // 过渡完成后 snapping 被 _draw 置为 false，自然停止
      };
      requestAnimationFrame(drive);
    }

    /**
     * 将主题强调色写入 CSS 变量
     * 覆盖 :root 里的 --theme-primary / --theme-primary-strong 等
     * 所有用到这些变量的按钮/开关/阴影自动跟随变色
     */
    _applyAccent(theme) {
      const root = document.documentElement.style;
      const dur  = "0.5s";   // 颜色过渡时长

      // 先确保有 transition（只加一次）
      if (!this._accentTransitionSet) {
        const existing = root.getPropertyValue("transition") || "";
        // 通过 body style 注入一段全局 transition（不影响其他元素）
        // 实际通过 CSS 变量 transition 实现：在 :root 上设置 transition
        document.documentElement.style.setProperty(
          "--accent-transition", dur
        );
        this._accentTransitionSet = true;
      }

      root.setProperty("--theme-primary",        theme.accent);
      root.setProperty("--theme-primary-strong",  theme.accentStrong);
      root.setProperty("--theme-shadow",          theme.accentShadow);
      root.setProperty("--theme-ring",            theme.accentRing);
    }

    _loop(t) {
      // 减去暂停期间累积的时间偏移，让动画时钟不跳帧
      this._draw(t - this._timeOffset);
      if (this.animated) {
        this._rafId = requestAnimationFrame(ts => this._loop(ts));
      } else {
        this._rafId = null;
      }
    }

    _draw(t) {
      const dpr = window.devicePixelRatio || 1;
      const W   = this.canvas.width  / dpr;
      const H   = this.canvas.height / dpr;
      const ctx = this.ctx;

      ctx.clearRect(0, 0, W, H);

      if (this.isMesh) {
        this.mesh.render(t);
        this.mesh.drawTo(ctx, W, H);
      } else {
        this.renderer?.draw(ctx, t);
      }

      // 主题切换淡出快照
      if (this.snapping && this.snapCanvas) {
        const prog  = Math.min((t - this.snapStart) / this.snapDur, 1);
        const alpha = 1 - easeOutCubic(prog);
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.snapCanvas, 0, 0, W, H);
        ctx.globalAlpha = 1;
        if (prog >= 1) { this.snapping = false; this.snapCanvas = null; }
      }
    }
  }

  /* ── 启动 ─────────────────────────────────────────────── */
  function boot() {
    const engine = new AuroraEngine();
    window.auroraEngine = engine;

    // 从 localStorage 读取 wallpaperAnim 初始状态
    // 避免 script.js 先于引擎挂载时调用 setAnimated 被忽略
    try {
      const saved = JSON.parse(localStorage.getItem("settings") || "{}");
      if (saved.wallpaperAnim === false) {
        // 等一帧让首屏先渲染出来再冻结
        requestAnimationFrame(() => engine.setAnimated(false));
      }
    } catch (_) { /* 解析失败则保持动态 */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
