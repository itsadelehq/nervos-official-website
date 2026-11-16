# 2026-11-10 上线后审计跟进

来源：Dele 更新的交接表 `20_Post_Launch_Audit_2` 及 2026-11-16 补充文档。本轮已实现 B3、B4、B5、B7、B8、B9，B6 完成旧重定向删除；代码验证与正式环境验收分别记录，不能以本地通过代替上线完成。

## 当前进度（2026-11-16 更新 B9）

交付记录：本轮实现已提交为 `18b79c8`，分支为 `codex/post-launch-b3-b4-b5-b8`，尚未合入 main 或发布。以下表格及验证记录保留验收时点的状态；push 情况以该远程分支记录为准。

B7、B8 已按 Dele 原文完成；B9 已完成两条英文首页地址的 Markdown 协商，并通过本地生产 HTTP 及 Chrome 浏览器抽样验收。全部尚未提交、push 或发布，其他验证时间见各项说明。

B6 增量验证（2026-11-12）：30 项相关路由测试通过，覆盖已退役地址的语言前缀和查询参数，以及既有 KB、CKB、roadmap 跳转。Journey 文件无改动；代码尚未提交、push 或发布。

| 编号 | 事项                          | 负责人             | 当前状态与下一步                                                                                                                                                                                                                     |
| ---- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1   | Godwoken 文章链接             | Dele / Jacky       | 已合入并上线。[PR #347](https://github.com/NervosEducationHub/EducationHubArticles/pull/347) 已合并；五个线上语言页面已使用 godwoken.com，不再引用旧 /godwoken。后续提交归 B13。                                                     |
| B2   | 旧文档链接                    | Dele / Jacky       | 已合入并上线。[PR #349](https://github.com/NervosEducationHub/EducationHubArticles/pull/349) 已合并；ckbuilders、what_is_fiber 的 EN/ZH 四个线上页面已使用当前 /docs/ckb-fundamentals/cell-model。交接表仍写旧建议路径，需同步记录。 |
| B3   | Twitter 分享标签              | Sonny              | 代码与本地验证完成；未提交、未 push、未上线。                                                                                                                                                                                        |
| B4   | 中文列表与页脚通用文字        | Sonny              | 代码、单测、本地 HTTP 及 Chrome 中文列表/页脚桌面与手机抽样验收通过；手机下一页正常。中文文章页脚仍待单独抽验。未上线。                                                                                                             |
| B5   | KB 集合页结构化数据           | Sonny              | 八个页面的代码与本地验证完成；未上线。                                                                                                                                                                                               |
| B6   | 已退役 archive 域名           | Sonny              | 旧重定向已删除，10 个本地生产 HTTP 请求确认返回真实 404、无 Location。待发布；Journey 按 Dele 最新回复继续暂停，待确认是否保留及有效目标。B6 整项未完成。                                                                            |
| B7   | llms.txt 使用指引             | Sonny              | 本地完成：Dele 提供的 When to use this site、Topics、In-depth guides 三节已原样加入，14 个新资源地址均规范且已发布；8 项相关检查通过。未提交、未 push、未上线。                                                                      |
| B8   | Markdown 404                  | Sonny              | 本地完成：指定正文及四个链接已对齐，6 项相关单测及本轮 54 项本地生产 HTTP 检查通过。保留真实 404、HEAD、HTML 错误页与原协议。未上线。                                                                                                |
| B9   | 页面 Markdown 表示            | Sonny              | 本地完成：55 项主页 HTTP 检查、全量 635 项测试和生产构建通过；Chrome 两个首页、站内文章往返及手机显示抽验通过。普通 HTML、页面 JS/CSS、非英文地址和文章行为保留。未 push、未上线；预览/正式 CDN 验收待补。                          |
| B10  | About / Contact / Privacy     | Foundation → Sonny | 待 Foundation 文案和决策；尚未实施。                                                                                                                                                                                                 |
| B11  | 组织联系信息与地址 schema     | Foundation → Sonny | 待官方邮箱、联系类型和组织地址；未实现。                                                                                                                                                                                             |
| B12  | 防火墙阻挡 AI / 非浏览器访问  | 运维 / Sonny       | 运维已将 Bot Protection 改为 Log；线上首页、KB、抽样文章和四个公开文件均 200，KB 的 ChatGPT-User / OAI-SearchBot 模拟请求亦 200，无 checkpoint。当前出口抽样验收通过；Dele 原审计复测归 B14。                                        |
| B13  | Godwoken 修复页 IndexNow 提交 | Dele               | 交接表仍为待办，未收到提交结果；不能仅凭 key 文件可访问标完成。                                                                                                                                                                      |
| B14  | 重新运行 Is Agentic           | Dele               | B12 的前置阻塞已解除，可重新扫描并记录结果；B7–B9 发布后再复扫。尚无新的评分结果。                                                                                                                                                   |
| B15  | llms-full.txt                 | Sonny              | 可选，暂未实施；按交接表在 B7–B9 后安排。                                                                                                                                                                                            |

2026-11-10 整体验证：612 项测试、TypeScript 检查、生产构建通过；本地 54 项 Markdown 404 HTTP 检查、72 条旧列表请求、29 个真实列表分页、638 个 SEO HTTP 响应检查通过。HTTP 检查未进行旧版页面视觉基线比较，完整浏览器与手机验收仍待完成。

数据版本说明：开发环境使用固定的旧文章快照；其源文件仍可能保留 B1/B2 的旧链接。上述 B1/B2 状态以已合并 PR 和实际线上页面为依据，不能把本地旧快照当作线上尚未修复的证据。

## 本轮范围

- **B7 — llms.txt 使用指引（2026-11-16）**：从 Dele 提供的 `llms-txt-additions-for-Sonny_副本.md` 原样接入三个区块，保留原有站点简介及资源。已逐字比对附件；新增六个 Topic、八篇文章均为已发布规范地址。8 项 llms / 路由检查通过。仅修改静态文件、相关检查和本进度记录，未修改页面 UI、Journey 或文章正文。
- **B3 — Twitter 分享标签**：统一输出 `name="twitter:*"`，沿用已有 `summary_large_image` 配置；OG 和 Article 标签继续使用 `property`，不重复输出标签。
- **B4 — 中文文章列表和页脚**：中文列表的标题、说明、面包屑、搜索、排序和分页辅助文字使用中文；中文 KB 页脚的通用导航和订阅文字使用中文。品牌与社区名称保留英文。不修改 CSS、布局、Header 品牌或新增语言入口。列表描述包含页码；hreflang 仅连接实际文章集合相同的分页，不能仅凭页码猜测翻译关系。
- **B5 — KB 集合页结构化数据**：KB 首页、Start Here 和六个规范 Topic 页增加 `CollectionPage` 与 `BreadcrumbList`。保留官网首页和文章已有的 schema；无效路径、预览和重定向不输出伪造集合数据。
- **B8 — Markdown 404（2026-11-16）**：正文逐字采用 Dele 附件 `B8-Markdown-404-for-Sonny.md` 的 Markdown 代码块，包含 llms.txt、sitemap、KB、开发文档四个链接。6 项相关单测及本轮 54 项生产构建的本地 HTTP 检查通过。真实 404、Content-Type、Vary、缓存、Accept 协商、HEAD、普通浏览器错误页及 API / Next 数据协议保留。

## B9 实现与验收（2026-11-16）

- 只支持规范英文 `/`、`/knowledge-base` 及等价的默认英文别名；本轮不增加文章 Markdown 或翻译页面 Markdown。浏览器默认 Accept、`*/*`、Markdown q=0 和 HTML 同权重继续得到原 HTML。
- 先执行现有 Hub、旧分页、文章和资源迁移，再处理精确主页 GET / HEAD；原始 `/_next/` 及 `x-nextjs-data` 请求始终保留 JSON 协议。
- 两个固定只读 API 入口分别绑定两种页面，不依赖重写查询参数，也不将任意来路路径、语言或追踪参数用于内容选择。KB 仍保留静态生成，普通页面组件与样式未改。
- Markdown 复用现有首页文案、真实专题/推荐文章/阅读排名/数量和资源链接；不输出装饰、动画、loading、表单或文章全文。主站的软连字符仅作文本规范化，CTA 目标保持现有值。
- HTML 与 Markdown 均携带 `Vary: Accept`；Markdown 设浏览器及 CDN `no-store`，HEAD 正文为空，长度按 UTF-8 计算。共享纯函数处理 Accept 权重，B8 行为保留。
- 本地最终生产构建及全量 635 项测试通过。55 项主页 HTTP 检查通过，覆盖交替请求、HTML ETag 不污染 Markdown、HEAD、查询参数、英文别名、其他语言、真实 Next 数据地址及旧跳转；54 项 B8 HTTP 检查和原分页 HTTP 检查亦通过。
- 与 2026-11-10 本地基线比较，`/`、`/home`、`/knowledge-base` 的页面 JS 与 CSS 资源哈希一致，相关 11 份资源逐字节一致。2026-11-16 已通过原生 Chrome 完成本地页面可视与交互抽验，未作全站或逐像素视觉比较。
- Chrome 桌面实测：官网首页正常 HTML；点击站内 Knowledge Base 链接进入 KB，点击文章后再点击文章 Header 品牌返回 KB，始终为正常页面，没有误显示 Markdown 或 Next JSON。
- Chrome 手机模拟实测：KB 首页在 390×844、官网首页在 320×844 正常显示；中文 All Articles 在 390×844 排序菜单完整可见，并能点击下一页加载不同文章、保持 `/zh/` 和 `?page=2`；英文 All Articles 在 320×844 排序菜单也完整可见。未测试真实手机或其他浏览器。
- B4 中文列表页脚的桌面和 390px 手机截图中，导航、订阅及版权中文无明显溢出，品牌名称保留英文。中文文章页脚仍需单独抽验。浏览器扩展产生的 MetaMask 警告不计为站点报错；官网桌面的 Live Metrics 本地仍显示 loading，本轮未修改该数据接口或相关页面资源，不据此宣称其已验收通过。
- 本轮复查再次通过 55 项主页、54 项 404、638 个 SEO 实际 HTTP 响应，以及八个集合页实际 HTML 的单一 Twitter 大卡标签和 CollectionPage/BreadcrumbList 检查。日志保存在 `/private/tmp/kb-b9-homepages-recheck-20261116.log`、`/private/tmp/kb-b9-404-recheck-20261116.log`、`/private/tmp/kb-b9-seo-recheck-20261116.log`。

## B8 / B9 维护及发布验收

Next Pages Router 的静态 `404` 页面不能按请求头协商内容，因此使用请求级 `_error.getInitialProps`。这会关闭 404 的静态优化；正常页面的静态生成不受影响。不要新增 `404.page.tsx` 绕过该处理。

两种页面 404 表示都设置 `Vary: Accept` 和 `private, no-store`，避免缓存混淆。`HEAD` 保留状态和响应头，但没有正文。`text/markdown;q=0`、未明确请求 Markdown、Markdown 与 HTML 权重相同的情况继续返回 HTML。

上线后在正式域名复验，而不是只检查构建成功：

```sh
node scripts/check-markdown-404-http.mjs https://www.nervos.org
node scripts/check-markdown-homepages-http.mjs https://www.nervos.org
node scripts/check-kb-query-redirects-http.mjs https://www.nervos.org
node scripts/check-page-seo-http.mjs https://www.nervos.org
```

本地已检查英文默认首页、文章往返、中文列表首页及后续分页、中文列表页脚、手机排序菜单和分页。中文文章页脚仍需单独抽验；发布后还需在 Preview / 正式域名复验，保留原有交互与布局。

发布前先在 Preview、发布后在正式域名交替请求相同 URL 的 HTML / Markdown，验证 `Vary`、缓存头、内容和状态不串用。上述 HTTP 结果来自本地 `next start`，不能代替 Vercel CDN 层的复验。

## 仍有外部依赖

- **B6**：五组旧跳转已从代码删除，待发布；Journey 有效替代链接待 Dele 确认。Journey、其他页面 UI 和文章内容本次均未改动，不能把 B6 整项标记完成。
- **B12 / B14**：运维修改及当前出口的线上抽样检查已完成；待 Dele 重跑原审计验证其访问路径和评分。
- **B10、B11**：需要提供或确认 Foundation 的页面文案、正式联系方式及组织地址。
- **B15**：可选项，在 B7–B9 的内容和范围确认后再安排。
