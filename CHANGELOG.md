# 版本记录

本文件记录扩展的每一个发布版本。版本号取自 `manifest.json` 的 `version` 字段，
**目录名不代表版本号**（历史上曾出现过目录名与版本号不一致的情况，见下文「关于版本号」）。

格式约定：`## [版本号] - 发布日期`，条目按「新增 / 变更 / 修复 / 移除」归类。

---

## [未发布] — 待办

以下问题已知但**尚未修复**，不属于 3.2.0：

| 级别 | 问题 | 说明 |
|---|---|---|
| P0 | 无深色模式 | 角标控件为「无底无描边」裸露在极光上，依赖墨色在浅色极光上的对比度，深色环境下不可读；深色用户还会在高频页面上看到白闪。需单独设计一套深色极光控制点 |
| P2 | 缺少 `icons/` | `manifest.json` 未声明 `icons`，扩展在工具栏与扩展列表中显示通用拼图图标；上架商店前需补齐 16/32/48/128 四种尺寸 |
| P1 | 快捷入口不可编辑、不可拖拽排序 | 目前只有删除，`drag` / `dataTransfer` 相关代码为 0 处 |
| P1 | 设置无导入导出 | 全部设置存在 `localStorage`，未使用 `chrome.storage`，换设备即丢失 |
| P2 | 仅 2 张内置背景，不支持自定义壁纸 | 天气仅支持定位，无手动城市兜底 |

---

## [3.2.0] - 2026-10-02

本版核心是**移除自建代理、改用各搜索引擎官方建议接口**，并修复由此暴露出的图标与失败态问题。

### 移除

- **彻底移除 Cloudflare Workers 代理机制**。删除 `PROXY_URL` 常量、`normalizeProxyUrl` / `resolveProxy` / `buildProxyUrl` / `originPatternFor` / `hasHostPermission` / `requestHostPermission` / `permissionsApi` 等函数、设置面板的代理分组、CORS 代理输入框与「代理绕过」开关、代理说明弹窗，以及 `useProxy` / `proxyUrl` 两个设置字段（旧值在加载时清理）。
- 移除 `manifest.json` 的 `optional_host_permissions`，不再需要任何动态域名授权。
- 移除对 `https://www.google.com/s2/favicons` 的图标请求。

### 变更

- **四家搜索引擎改为各调自己的官方建议接口**，不再经过任何中间层：

  | 引擎 | 官方接口 | 返回形状 |
  |---|---|---|
  | Google | `suggestqueries.google.com/complete/search?client=firefox&q=` | `["q",[建议…]]` |
  | Bing | `api.bing.com/osjson.aspx?query=&market=zh-CN` | `["q",[建议…]]` |
  | 百度 | `www.baidu.com/sugrec?prod=pc&wd=` | `{q, p, g:[{q}]}` |
  | DuckDuckGo | `duckduckgo.com/ac/?q=&type=list` | `["建议",…]` |

  代码结构收敛为一张 `SUGGEST_SOURCES` 表（`url` + `parse`）加一个 `resolveSuggestEngine()`，取代原先四个独立的 `fetchXxxSuggestions`。

- **默认搜索引擎由 Google 改为 Bing**。实测（中国大陆网络）Bing 与百度官方接口可直连，Google 与 DuckDuckGo 超时；这是**可达性**问题而非 CORS，扩展层无法绕过。
- **快捷入口图标改用 MV3 本地 Favicon API**：`chrome-extension://<扩展 ID>/_favicon/?pageUrl=<URL>&size=64`，由浏览器本地提供，零外部请求。`manifest.json` 新增 `"favicon"` 权限（不会新增用户可见的权限警告）。
- 建议失败态由纯文案改为**带动作的浮层**：给出「改用 Bing」与「重试」两个按钮；失败文案区分「网络不通」「网络超时」「接口异常」，用户才知道该换引擎还是该重试。
- 界面文案「版本 3.1.0」同步为 3.2.0。

### 修复

- **修复大陆网络下快捷入口图标全部为空**（原先依赖 Google 的 favicon 服务）。
- **修复搜索建议开关失效**：关闭建议后原先仍会对 Google 发远程请求，现在直接提前返回，不发任何请求。
- **修复建议结果张冠李戴**：原先为 Bing / 百度的建议结果保留了一条「回落 Google」的分支，会把 Google 的结果标成当前引擎的结果；四家都有官方接口后该分支已删除。
- **修复失败结果被写入缓存**：一次网络抖动会让该词条在本次会话中长期返回空建议；现在失败的请求不写缓存。
- **修复 `load()` 不合并默认值**：旧版本写入的 `localStorage` 设置对象若缺少后来新增的字段，会得到 `undefined` 而不是默认值（缺失的 `engine` 会静默回落 Google，缺失的开关会取到错误状态）。现在与默认值做一次浅合并，数组类型（`sites`、`history`）不受影响。
- **新增一次性引擎迁移**：旧版本会把「默认的 google」一并持久化，导致升级后换不过去。现在加载时若检测到 `engine === "google"` 且无迁移标记，则改为 `bing` 并落盘标记；用户之后在设置里手动选回 Google 不会被再次改掉。

### 新增

- `aurora.js`：极光背景引擎（mesh 渐变，8 个控制点，可开关动效）。
- 首字母兜底图标：图标未能加载时显示站点名首字母，不再出现裂图。
- 内置自托管字体，共 5 款（详见 README），字体分片 214 个 + `fonts.css`，合计约 10.9 MB；按 `unicode-range` 分片，运行时只加载实际用到的分片。
- `fonts/licenses/`：5 款字体的 SIL OFL 1.1 许可全文与 `NOTICE.md`。

### 关于版本号

仓库 `manifest.json` 的版本演进为 `3.0` → `3.1.0` → `3.2.0`。
其中 3.1.0 的开发目录曾命名为 `Atlassky-New-Tab-1.4.0`（该目录名指的是设计稿序号，不是版本号），
本仓库以 `manifest.json` 内的 `version` 为准，不再沿用目录名。旧目录名正在逐步统一。

---

## [3.1.0]

按「Atlassky 融合设计稿」重做视觉层。

### 新增

- `aurora.js` 极光背景引擎与天气胶囊。
- 自定义下拉组件（替代原生 `<select>`）、玻璃浮层抽屉 / 弹窗体系。
- 设计变量组「Atlassky 融合体系」（32 项）。

### 变更

- 时钟升级为艺术大字（Fraunces Light 96 / 行高 112），日期与中文标题改用 Noto Serif SC。
- 统一强调色为 `#2758d8`；废弃早期的 `#8e7a6c` 与 `#6a48b0`。危险色 `#c0392b`。
- 顶部角标控件（天气胶囊 / 设置 / 更多）定为**无底无描边**，直接裸露在极光上，仅 hover 变图标颜色。
- 阴影只用于浮层，卡片与控件不带阴影。

---

## [3.0]

仓库首个公开源码版本。

### 新增

- 新标签页：时钟、日期、搜索框、快捷入口（可增删）、天气、更多面板、设置面板。
- 搜索引擎支持 Google / Bing / 百度 / DuckDuckGo / 自定义。
- 搜索建议：直接调用 Google / Bing / DuckDuckGo 官方接口；百度走 `suggestion.baidu.com/su`（JSONP 文本，正则剥离）。
- 天气数据来自 `api.open-meteo.com`。

### 已知问题（后续版本修复）

- 快捷入口图标请求 `google.com/s2/favicons`，大陆网络下全部为空 → 3.2.0 修复。
- 缺少深色模式 → 仍未修复，见「未发布」。
