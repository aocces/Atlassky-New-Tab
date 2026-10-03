# flower new tab

极简风格的浏览器新标签页扩展（Chrome MV3）。当前版本 **2.3.0**。

> 前身名为 *Soft New Tab* → *Soft New Tab Pro*，2026-10-03 起更名为 **flower new tab**。
> 版本变更见 [CHANGELOG.md](CHANGELOG.md)。

![图标](assets/icons/icon-128.png)

---

## 功能特点

- 🕐 **时钟与日期** — 艺术大字时钟（Fraunces）+ 中文日期，随时间自然刷新
- 🔍 **搜索建议** — 集成 Google / Bing / 百度 / DuckDuckGo，亦可自定义搜索引擎
- ⚡ **快捷入口** — 图标自动获取（本地 Favicon API），支持增删
- 🌤️ **天气胶囊** — 基于 `api.open-meteo.com`，无需 API Key，拿不到定位也有三级兜底
- 🖼️ **自定义壁纸** — 选图后压缩存在本机（`chrome.storage.local`），**不上传任何服务器**；深色壁纸自动切暗色界面
- 💬 **一言** — 每次开新标签换一句，点一下换下一句，取不到就整块隐藏
- 🎨 **极光背景** — mesh 渐变极光，可开关动效
- 🔤 **字体自托管** — 五款开源字体随扩展内置，离线可用、无第三方字体请求
- 🪶 **权限克制** — 只在需要时申请，不注入内容脚本、不读取浏览记录

## 安装

### 开发 / 本地加载

1. 下载或克隆本仓库
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择**本仓库根目录**（含 `manifest.json` 的那一层）
4. 打开新标签页即可看到效果

> 仓库采用**扁平结构**，根目录即可直接加载，无需任何构建步骤。

### Release 安装

1. 在 Releases 下载 `.zip` 或 `.crx` 文件
2. `.zip`：解压后按上面的方式加载；`.crx`：在扩展管理页直接拖入
3. 若 Chrome 拒绝加载 `.crx`，请改用 `.zip` 解压加载

> 目前尚未上架 Chrome 应用商店，`.crx` 可能被浏览器拦截，属正常现象。

## 目录结构

```
.
├── manifest.json          # MV3 清单，版本号以此为准
├── newtab.html            # 新标签页结构
├── style.css              # 全部样式
├── script.js              # 主逻辑（设置、建议、快捷入口、弹窗）
├── aurora.js              # 极光背景引擎（mesh 渐变）
├── weather.js             # 天气模块
├── hitokoto.js            # 一言模块
├── wallpaper.js           # 自定义壁纸（压缩 + 本机存储）
├── assets/
│   ├── logo.svg           # 扩展图标源文件
│   ├── icons/             # 各尺寸 PNG（manifest 的 icons 用这份）
│   └── wordmark.svg       # 页面左下角的品牌字标
├── fonts/                 # 内置自托管字体（214 个分片 + fonts.css）
│   └── licenses/          # 第三方字体许可全文（OFL 1.1）
├── CHANGELOG.md           # 版本记录
├── LICENSE                # AGPL-3.0
└── README.md
```

## 搜索引擎与搜索建议

建议接口**直接调用各引擎的官方接口**，不经过任何自建代理：

| 引擎 | 接口 |
|---|---|
| Google | `suggestqueries.google.com/complete/search` |
| Bing | `api.bing.com/osjson.aspx` |
| 百度 | `www.baidu.com/sugrec` |
| DuckDuckGo | `duckduckgo.com/ac/` |

- **默认引擎为 Bing**：在中国大陆网络下，Bing 与百度官方接口可直连，Google 与 DuckDuckGo 会超时。
- 这是**网络可达性**问题，不是跨域（CORS）问题。扩展页面与 Service Worker 对 `host_permissions` 内站点发请求本就豁免同源策略，因此既不需要 Service Worker 也不需要代理——把域名写进 `manifest.json` 的 `host_permissions` 即可。
- 若某家引擎取不到建议，浮层会给出「改用 Bing」与「重试」按钮，并区分「网络不通 / 网络超时 / 接口异常」。


## 字体

内置自托管字体，全部为 **SIL Open Font License 1.1**，字体文件与扩展一同分发：

| 用途 | 字体 |
|---|---|
| 时钟大字 | Fraunces |
| 中文标题 / 日期 | Noto Serif SC |
| 拉丁正文 · 标签 · 数值 | Space Grotesk |
| 中文正文 · 标签 | Noto Sans SC |
| 域名 · URL | JetBrains Mono |

许可全文见 [`fonts/licenses/`](fonts/licenses/)，来源与版本见 [`fonts/licenses/NOTICE.md](fonts/licenses/NOTICE.md)。

字体按 `unicode-range` 分片，运行时浏览器只加载页面实际用到的分片，因此 10.9 MB 的体积不是运行时开销。

## 许可证

[GNU Affero General Public License v3.0](LICENSE)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/I3I21Y17OW)
