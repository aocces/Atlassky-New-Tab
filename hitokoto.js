/**
 * 一言（hitokoto.cn）—— 每次开新标签换一句。
 *
 * 接口：https://v1.hitokoto.cn/?c=<分类>&encode=json
 * 实测（本机扩展页面内 fetch）：HTTP 200 / 约 1.6s，返回
 *   { hitokoto: "君子不器。", from: "论语·为政篇", from_who: null, type: "i", … }
 *
 * 和天气同一个原则：**拿不到就不给内容**，不写「暂无一言」这种占位。
 * 取数与文案格式都收在这里，script.js 只决定「什么时候显示、显示在哪」。
 */

/**
 * 分类只维护这一处。c=i 取的是诗词、典故一类，和本项目的墨色宋体气质合得来；
 * 换成 a 动画 / c 哲学 / d 诗词 / e 影视 / j 脑筋急转弯都只改这一行。
 * 设置里不给用户选类型 —— 只留一个显隐开关。
 */
const HITOKOTO_CATEGORY = "i";
const HITOKOTO_ENDPOINT = "https://v1.hitokoto.cn/";
const HITOKOTO_TIMEOUT_MS = 8000;

/**
 * 只取需要的字段。接口字段挺多，不裁一遍的话
 * 后端改一次结构就会连带影响渲染。
 * @returns {{text: string, from: string, fromWho: string}|null} 没有正文时返回 null
 */
function pickHitokoto(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = typeof raw.hitokoto === "string" ? raw.hitokoto.trim() : "";
  if (!text) return null;
  const trim = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    text,
    from: trim(raw.from),
    fromWho: trim(raw.from_who),
  };
}

/**
 * 出处拼装。作者与出处都有才用书名号，只有一项就直接写。
 * @returns {string} 没有出处时返回空串，调用方据此隐藏那一段
 */
function formatHitokotoSource(item) {
  if (!item) return "";
  const { fromWho, from } = item;
  if (fromWho && from) return `—— ${fromWho}《${from}》`;
  if (fromWho) return `—— ${fromWho}`;
  if (from) return `—— 《${from}》`;
  return "";
}

/**
 * 取一句。
 * 失败一律 throw，**不在这里吞错误** —— 吞了上层会拿到 undefined 还以为成功了，
 * 结果就是页脚既没句子也没隐藏。
 * @returns {Promise<{text: string, from: string, fromWho: string}>}
 */
async function fetchHitokoto() {
  const url = `${HITOKOTO_ENDPOINT}?c=${encodeURIComponent(HITOKOTO_CATEGORY)}&encode=json`;

  // 用 AbortController 而不是 AbortSignal.timeout：后者在 jsdom 里没有，
  // 单测环境会直接抛 ReferenceError。
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HITOKOTO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const item = pickHitokoto(await res.json());
    if (!item) throw new Error("返回体里没有正文");
    return item;
  } finally {
    clearTimeout(timer);
  }
}

window.HITOKOTO_CATEGORY = HITOKOTO_CATEGORY;
window.pickHitokoto = pickHitokoto;
window.formatHitokotoSource = formatHitokotoSource;
window.fetchHitokoto = fetchHitokoto;
