# Haystack 个人主页设计规格

- 日期：2026-09-05
- 状态：设计已确认，等待进入实现计划
- 产品形态：独立开发者个人品牌主页 + 笔记发布系统
- 技术栈：Go、SQLite、React、TypeScript、Vite、shadcn/ui

## 1. 产品定位

Haystack 是一个面向混合访客的独立开发者个人主页。它不把自己做成传统简历，也不把个人表达全部让位给博客，而是通过有记忆点的交互首屏建立人格，再用稳定、易读的笔记内容建立信任。

访客首次进入页面时应先记住三件事：

1. Haystack 是一个正在持续构建东西的人。
2. 他的审美和工程表达有明确辨识度。
3. 可以通过 Notes 继续了解他的思考与作品。

### 目标

- 建立高级、年轻、克制但有态度的个人品牌形象。
- 让首页首屏在 5 秒内形成视觉记忆点。
- 让笔记内容具备良好的阅读、分享和搜索基础。
- 通过单用户管理端完成笔记的草稿、预览、发布和下线。
- 保持部署简单：一个 Go 服务、一个 SQLite 文件和一份前端构建产物。

### 非目标

第一版不做项目管理平台、社交评论、点赞、多用户协作、复杂 CMS、文件上传、订阅系统或实时聊天。

## 2. 品牌与视觉系统

### 品牌身份

- 名称：Haystack
- 身份：Independent Developer
- 文案语气：克制有力，短句优先，少用空泛形容词。
- 内容重点：正在构建什么、如何思考、哪些想法值得留下。

首屏宣言先使用可配置文案，初始方向为 `MAKE USEFUL THINGS.`。最终文案在实现阶段根据 Haystack 的真实表达进行替换，不改变版式结构。

### 色彩

| 用途 | 色值 | 说明 |
| --- | --- | --- |
| 页面底色 | `#0C0E0D` | 近黑绿，避免纯黑的廉价感 |
| 主文字 | `#EFFFF1` | 暖白，用于标题和核心内容 |
| 次级文字 | `#98A895` | 灰绿，用于说明、日期和辅助信息 |
| 主强调色 | `#B8FF3D` | 荧光绿，用于链接、状态和主要动作 |
| 异常强调色 | `#FF6542` | 珊瑚橙，用于新内容点和少量视觉打断 |
| 分隔线 | `#273328` | 低对比度，保持空间层次 |

### 字体与排版

- 大标题使用现代无衬线字体，推荐 Geist Sans；没有该字体时回退到 `Inter Tight`、`Arial`。
- 标签、编号、时间、状态使用等宽字体，推荐 Geist Mono；没有该字体时回退到系统等宽字体。
- 首屏标题采用紧字距、超大字号和较短行高，形成海报感。
- 笔记正文不沿用首屏大字，使用舒适的阅读宽度和 1.75 左右的行高。
- 桌面端使用宽幅 12 列网格；移动端改为单列，不强行保持桌面空间关系。

### 动效原则

- 动效只表达状态、空间和反馈，不用连续粒子或无意义的装饰动画。
- 交互响应控制在 180–400ms；首屏循环动效保持低频、低对比度。
- 鼠标跟随、轨道偏移使用 CSS 变量和 `requestAnimationFrame`，不引入 WebGL。
- 所有交互内容必须有静态可读状态；不能依赖 hover 才能发现或访问内容。
- 检测 `prefers-reduced-motion` 后关闭视差、跟随和循环动画。
- 移动端使用静态网格、节点展开和明确按钮，避免触摸设备上的过度动画。

## 3. 公开页面与信息架构

### 首页 `/`

页面顺序如下：

1. **Signal Poster 首屏**
   - Haystack 标识、编号和轻量导航。
   - 巨型宣言，例如 `MAKE USEFUL THINGS.`。
   - 背景轨道和一个可交互的 Signal 节点。
   - 节点分别引导到 `NOW`、`NOTES`、`LINKS`。
   - 页面底部始终存在明确的滚动提示。
2. **Now 模块**
   - 用一两句话说明当前正在做什么或研究什么。
   - 作为内容入口，不做复杂时间线。
3. **Notes 模块**
   - 展示最新 3 篇已发布笔记。
   - 每项包含标题、摘要、标签、日期和阅读时长。
   - 提供进入 `/notes` 的明确入口。
4. **About 模块**
   - 一段短介绍，说明 Haystack 的工作方式和关注方向。
   - 不在首版复制完整简历。
5. **Links 模块**
   - 邮箱、GitHub 和其他外部链接。
   - 外部链接统一使用安全的 `noopener noreferrer` 策略。
6. **页脚**
   - Haystack、当前年份、Notes 入口和状态信息。

### 笔记列表 `/notes`

- 公开接口只返回已发布内容。
- 默认按发布时间倒序。
- 第一版支持标签筛选，不做全文搜索和复杂分页；列表超过 12 条后使用简单分页参数。
- 列表页降低动效密度，把视觉重点交给标题和摘要。
- 无内容时显示有态度但清晰的空状态，不渲染空白区域。

### 笔记详情 `/notes/:slug`

- 展示标题、摘要、标签、发布时间和预计阅读时长。
- 正文限制最大宽度，保证长文阅读体验。
- 使用 Markdown 作为存储格式，公开侧关闭原始 HTML，避免内容注入。
- 页面提供返回 Notes 的入口和上一篇/下一篇导航（存在时显示）。
- React 页面动态更新 title、description 和 canonical；Go 在 `/notes/:slug` 返回入口 HTML 时，根据已发布笔记注入 Open Graph 等分享元信息，保证社交平台抓取到正确内容。

## 4. 管理端

### 路由

- `/admin/login`：单用户登录。
- `/admin/notes`：按草稿、已发布、已下线筛选笔记。
- `/admin/notes/new`：新建笔记。
- `/admin/notes/:id/edit`：编辑笔记。

### 编辑流程

`登录 → 新建/编辑 → Markdown 预览 → 保存草稿 → 预览公开页面 → 发布或下线`

编辑字段：

- 标题
- slug
- 摘要
- 标签
- Markdown 正文
- 发布状态
- 发布时间

“保存草稿”和“发布”必须是两个明确动作。发布前显示标题、slug 和公开时间，避免误发布。

### 管理端边界

- 单管理员，不做用户注册和多角色权限。
- 管理端使用 shadcn/ui 的表单、Tabs、Dialog、Toast、表格和状态徽章。
- 首版不包含图片上传；正文可使用外部图片 URL，但渲染时限制协议为 HTTPS。
- 首屏宣言、Now 文案和外部链接先作为前端配置，避免为少量静态信息引入过早的设置 CMS。

## 5. 技术架构

### 前端

- React + TypeScript + Vite。
- React Router 管理公开页面和管理端路由。
- 公开页面使用自定义 CSS/Tailwind token 实现 Signal 视觉，不直接套用 shadcn 默认外观。
- 管理端使用 shadcn/ui，并复用统一的颜色、间距和表单状态。
- 公开内容使用原生 `fetch` 或轻量请求封装；管理端表单使用 React Hook Form 和 Zod 做边界校验。
- 管理端采用路由级懒加载，公开首页不加载编辑器代码。

### 后端

- Go 1.22+，使用标准库 `net/http` 和 `database/sql`。
- SQLite 使用 `modernc.org/sqlite`，避免 Windows/生产环境对 CGO 的依赖。
- SQL migration 使用 Go `embed` 嵌入二进制，服务启动时按序执行。
- 代码边界为 `handler → service → repository`：
  - handler 负责 HTTP 解析、鉴权和响应。
  - service 负责 slug 唯一性、发布状态和公开过滤规则。
  - repository 负责查询、事务和 SQLite 细节。
- Go 服务构建后托管前端 `dist`，公开的 `/notes/:slug` 路由先查询已发布笔记并注入分享元信息，再返回 React 入口；其他未知公开路由返回 React 入口，API 路由始终返回 JSON。

### 数据模型

`notes`：

- `id`
- `slug`（唯一）
- `title`
- `excerpt`
- `content_markdown`
- `status`（draft / published / archived）
- `published_at`
- `created_at`
- `updated_at`

`tags`：

- `id`
- `name`
- `slug`

`note_tags`：

- `note_id`
- `tag_id`

`admin_sessions`：

- `id`
- `token_hash`
- `expires_at`
- `created_at`

管理员密码哈希通过环境变量配置，不以明文存入数据库。session 只存不可逆 token 哈希，并设置过期时间。

### API 轮廓

公开接口：

- `GET /api/notes?tag=&page=`：返回已发布笔记列表。
- `GET /api/notes/:slug`：返回单篇已发布笔记。

管理接口：

- `POST /api/admin/session`：登录并设置 HttpOnly session cookie。
- `DELETE /api/admin/session`：注销当前 session。
- `GET /api/admin/notes?status=`：按状态读取管理端笔记。
- `POST /api/admin/notes`：创建草稿。
- `PUT /api/admin/notes/:id`：更新笔记。
- `POST /api/admin/notes/:id/publish`：发布笔记。
- `POST /api/admin/notes/:id/archive`：下线笔记。

错误统一返回 `{ "error": { "code": "...", "message": "..." } }`。公开接口不泄露草稿是否存在，管理接口在权限失败时统一返回未授权响应。

## 6. 安全、错误与可恢复性

- 管理端 session 使用 HttpOnly、Secure（生产环境）和 SameSite cookie。
- 所有写操作校验同源 Origin 和 CSRF token。
- 登录失败返回通用错误文案，不暴露账号或密码的具体错误。
- Markdown 禁止原始 HTML；链接只允许安全协议，渲染时设置安全的外链属性。
- slug 冲突、无效状态转换和过期 session 返回可识别的错误码，前端以 Toast 或字段错误展示。
- SQLite 写操作使用事务；发布操作同时更新状态和发布时间。
- 数据目录与前端静态目录分离，部署时定期备份 SQLite 文件。
- 前端网络失败时保留页面结构，显示可重试的错误状态，不将异常堆栈直接展示给访客。

## 7. 测试与验收标准

### 后端

- migration 可在空数据库重复启动并保持幂等。
- repository 使用临时 SQLite 数据验证查询和事务。
- service 覆盖 slug 冲突、草稿不可公开、发布/下线状态转换。
- handler 覆盖未登录写操作、过期 session、CSRF 失败和统一错误响应。

### 前端

- 覆盖首页节点展开、Notes 列表、空状态、加载失败和文章详情。
- 管理端覆盖表单必填校验、草稿保存、预览、发布和下线。
- 检查 TypeScript 类型、路由刷新和 API 错误状态。

### 浏览器验收

- 桌面端宽屏和常见笔记本尺寸下首屏层次清晰。
- 移动端不出现横向滚动，节点和按钮可触摸操作。
- 全流程可通过键盘完成，焦点状态清晰。
- 开启减少动效后内容和导航仍然完整可用。
- 发布一篇笔记后，首页、Notes 列表、详情页和分享元信息一致。
- 公开首页不加载管理端编辑器资源。

## 8. 部署形态

生产环境输出：

- `haystack` Go 可执行文件
- 前端静态构建目录
- `data/haystack.db`
- 管理员密码哈希和 session 配置环境变量

Go 服务可放在 Caddy 或 Nginx 后面处理 HTTPS。SQLite 文件纳入定期备份，部署更新先执行 migration，再切换服务版本。第一版不依赖 Redis、对象存储或常驻 Node 服务。

## 9. 实现顺序

1. 创建 Go 服务、React/Vite 工程和基础构建流程。
2. 完成 SQLite migration、公开 Notes API 和 Markdown 渲染。
3. 先实现首页静态 Signal Playground，再接入 Now、Notes 和 Links 数据。
4. 实现 Notes 列表、详情页和动态元信息。
5. 实现 session 鉴权、管理端列表和 Markdown 编辑预览。
6. 加入发布/下线流程、错误状态和安全边界。
7. 完成响应式、键盘、减少动效和浏览器验收。

该设计的核心取舍是：让 Playground 负责第一印象，让 Notes 负责长期价值，让 Go + SQLite 保持个人站点所需的低运维复杂度。
