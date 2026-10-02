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
const toggleShortcuts = document.getElementById("toggleShortcuts");
const toggleWallpaperAnim = document.getElementById("toggleWallpaperAnim");
const toggleSuggestions = document.getElementById("toggleSuggestions");

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
  suggestions: true,
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
  [bgSelector, engineSelector].forEach((selectRoot) => {
    if (selectRoot && selectRoot !== except) {
      closeCustomSelect(selectRoot);
    }
  });
}

function openCustomSelect(selectRoot) {
  if (!selectRoot) return;
  closeAllCustomSelects(selectRoot);
  selectRoot.classList.add("open");
  selectRoot.setAttribute("aria-expanded", "true");
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
  const options = selectRoot.querySelectorAll(".custom-select-option");

  if (trigger) {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCustomSelect(selectRoot);
    });
  }

  options.forEach((option) => {
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      const value = option.dataset.value;
      syncCustomSelect(selectRoot, value);
      closeCustomSelect(selectRoot);
      if (typeof onChange === "function") {
        onChange(value);
      }
    });
  });

  selectRoot.addEventListener("keydown", (event) => {
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
  settings.weather = false;
  persistSettings();
  applySettings();
  closeWeatherRevokeModal();
  showToast("天气定位授权已撤回");
}

/* 全局设置 */

function applySettings() {
  document.body.dataset.bg = settings.bg;
  applyDynamicTheme(settings.bg);

  syncCustomSelect(bgSelector, settings.bg);
  syncCustomSelect(engineSelector, settings.engine);

  if (toggleShortcuts) toggleShortcuts.checked = settings.shortcuts;

  if (toggleWallpaperAnim) toggleWallpaperAnim.checked = settings.wallpaperAnim !== false;

  // 壁纸动效开关：通知 aurora 引擎
  if (window.auroraEngine) {
    window.auroraEngine.setAnimated(settings.wallpaperAnim !== false);
  }

  if (toggleWeather) toggleWeather.checked = settings.weather;

  // 搜索建议开关
  if (toggleSuggestions) toggleSuggestions.checked = settings.suggestions !== false;

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

  if (getWeatherPermissionStatus() !== "granted") {
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
}

/* 绑定事件 */

setupCustomSelect(bgSelector, (value) => {
  settings.bg = value;
  persistSettings();
  applySettings();
});

setupCustomSelect(engineSelector, (value) => {
  settings.engine = value;
  persistSettings();
  applySettings();

  if (searchInput && document.activeElement === searchInput && searchInput.value.trim()) {
    updateSuggestPanel();
  }
});

if (toggleSuggestions) {
  toggleSuggestions.addEventListener("change", () => {
    settings.suggestions = toggleSuggestions.checked;
    persistSettings();
  });
}

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

    if (getWeatherPermissionStatus() === "granted") {
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

  if (!clickedInsideSettings && !clickedOnSettingsBtn) {
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
      (engineSelector && engineSelector.contains(event.target));

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