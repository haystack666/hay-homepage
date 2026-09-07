# Haystack

> MAKE USEFUL THINGS.

Haystack 是一个面向独立开发者的个人主页与 Markdown Notes 发布系统。它将 Signal / Playground 视觉方向与轻量、可部署的内容工作流结合起来：一个 Go 服务、一个 SQLite 数据库文件和一个前端构建目录即可运行。

项目的目标是让个人主页不仅能够介绍开发者，也能够持续发布值得长期保留的技术文章，并将编辑、发布、归档流程集中在一个小型系统中。

## 功能概览

- Signal 风格的个人主页，包含响应式布局和交互式 3D 信号场。
- 支持 `prefers-reduced-motion`、键盘导航、可见焦点状态和移动端无横向溢出。
- 公开 Notes 归档，支持分页、标签筛选、阅读时长和新旧文章导航。
- 支持 GitHub Flavored Markdown 的文章渲染。
- 单用户管理员工作区，用于创建和编辑文章。
- Draft、Published、Archived 三种文章状态。
- 发布、重新发布、归档，以及仅允许对归档文章执行的删除操作。
- SQLite 持久化和自动数据库迁移。
- 使用 bcrypt 校验管理员密码。
- 基于 Session 的管理员认证，并提供 CSRF 和同源请求保护。
- 为文章详情动态生成 description、canonical URL 和 Open Graph 元数据。
- 公开端与管理端流程均有浏览器自动化测试。

## 页面与入口

### 公开页面

| 路由 | 用途 |
| --- | --- |
| `/` | Signal 首页和最新 Notes 预览 |
| `/notes` | 已发布 Notes 归档 |
| `/notes/:slug` | 已发布文章详情页 |

Draft 和 Archived 文章不会通过公开 API 或公开 HTML 路由返回。

### 管理工作区

| 路由 | 用途 |
| --- | --- |
| `/admin/login` | 管理员密码登录 |
| `/admin/notes` | 按状态浏览 Notes |
| `/admin/notes/new` | 创建草稿 |
| `/admin/notes/:id/edit` | 编辑、发布、重新发布或归档文章 |

管理工作区是有意设计成单用户系统，不包含多租户或多用户权限管理。

## 架构

```text
浏览器
  │
  ├── React 应用（web/dist）
  │       ├── 公开首页和 Notes 路由
  │       └── 懒加载的管理员工作区
  │
  └── Go HTTP 服务
          ├── 静态文件和文章元数据注入
          ├── 公开 Notes API
          ├── 管理员认证和管理端 Notes API
          └── SQLite 数据库
```

后端采用简洁的 Handler → Service → Repository 分层：

- HTTP Handler 负责请求解析和响应转换。
- Notes Service 负责输入校验、状态转换和阅读时长计算。
- SQLite Repository 负责持久化；数据库迁移位于 `internal/db`。
- Auth Manager 负责密码校验、Session、Cookie、CSRF 和 Origin 校验。

## 技术栈

### 后端

- Go 1.22+
- `net/http`
- `modernc.org/sqlite`
- `golang.org/x/crypto/bcrypt`

### 前端

- React 19
- TypeScript
- Vite
- React Router
- Motion
- React Three Fiber 和 Three.js
- React Hook Form 和 Zod
- React Markdown 和 `remark-gfm`
- Vitest、Testing Library 和 Playwright

## 项目结构

```text
.
├── cmd/haystack/              # Go 应用入口
├── internal/
│   ├── auth/                  # 密码、Session、CSRF、Origin 校验
│   ├── config/                # 基于环境变量的配置
│   ├── db/                    # SQLite 连接和数据库迁移
│   ├── httpapi/               # 公开、管理、认证和静态文件 Handler
│   └── notes/                 # Note 模型、Repository 和 Service
├── docs/
│   └── superpowers/           # 产品和设计规划文档
├── web/
│   ├── e2e/                   # Playwright 浏览器验收测试
│   ├── src/components/ui/     # UI 基础组件
│   ├── src/features/admin/    # 管理员登录和 Notes 工作区
│   ├── src/features/home/     # Signal 首页和 3D 场景
│   ├── src/features/notes/    # 公开 Notes 归档和详情页
│   └── src/styles/             # 全局、管理端、Notes 和 Signal 样式
├── .env.example               # 环境变量模板
├── go.mod                     # Go 模块定义
├── LICENSE                    # MIT 许可证
└── README.md
```

## 环境要求

- Go 1.22 或更高版本。
- Node.js 和 npm。开发和浏览器验证使用 Node.js 22。
- 一个本地 bcrypt 密码哈希工具，用于生成管理员密码哈希。
- 支持现代 JavaScript 的浏览器；运行 E2E 测试时需要 Playwright 安装的 Chromium。

## 快速开始

### 1. 安装前端依赖

```bash
npm --prefix web install
```

### 2. 构建前端

Go 服务默认从 `web/dist` 提供编译后的前端文件。

```bash
npm --prefix web run build
```

### 3. 准备管理员密码哈希

服务只接受 bcrypt 哈希，不接受明文管理员密码。如果本机安装了 Apache `htpasswd`，可以使用它生成 bcrypt 哈希：

```bash
htpasswd -bnBC 12 "" 'replace-with-a-strong-password' | tr -d ':\n'
```

将输出结果设置为 `HAYSTACK_ADMIN_PASSWORD_HASH`。PowerShell 等价写法：

```powershell
$hash = htpasswd.exe -bnBC 12 "" "replace-with-a-strong-password"
$env:HAYSTACK_ADMIN_PASSWORD_HASH = $hash.Substring($hash.IndexOf(':') + 1).Trim()
```

如果没有安装 `htpasswd`，请使用其他可信的本地 bcrypt 工具。不要将哈希、明文密码、`.env` 文件或数据库文件提交到 Git。

### 4. 配置进程环境变量

复制模板作为配置参考：

```bash
cp .env.example .env
```

应用程序直接读取进程环境变量，不会自动加载 `.env` 文件。请通过 Shell、IDE、服务管理器或部署平台导出变量。Unix-like Shell 示例：

```bash
export HAYSTACK_ADDR=127.0.0.1:8080
export HAYSTACK_DB_PATH=data/haystack.db
export HAYSTACK_WEB_DIST=web/dist
export HAYSTACK_BASE_URL=http://localhost:8080
export HAYSTACK_ADMIN_PASSWORD_HASH='your-bcrypt-hash'
export HAYSTACK_SESSION_TTL=12h
```

PowerShell 示例：

```powershell
$env:HAYSTACK_ADDR = '127.0.0.1:8080'
$env:HAYSTACK_DB_PATH = 'data/haystack.db'
$env:HAYSTACK_WEB_DIST = 'web/dist'
$env:HAYSTACK_BASE_URL = 'http://localhost:8080'
$env:HAYSTACK_ADMIN_PASSWORD_HASH = 'your-bcrypt-hash'
$env:HAYSTACK_SESSION_TTL = '12h'
```

### 5. 启动 Haystack

```bash
go run ./cmd/haystack
```

打开 [http://localhost:8080](http://localhost:8080)。首次启动会自动创建 SQLite 数据库父目录、打开数据库并执行未完成的迁移。

检查服务健康状态：

```bash
curl http://localhost:8080/healthz
```

预期响应：

```json
{"status":"ok"}
```

## 前端开发模式

前端快速开发时，可以让 Go 服务继续运行在 `8080` 端口，并在另一个终端启动 Vite：

```bash
npm --prefix web run dev
```

Vite 默认运行在 `5173` 端口，并将 `/api` 请求代理到 `http://localhost:8080`。执行 `npm --prefix web run build` 后，生产模式页面仍然可以通过 `8080` 端口访问。

## 配置参考

所有配置都通过进程环境变量提供。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HAYSTACK_ENV` | `development` | 设置为 `production` 后会要求密码哈希，并默认启用 Secure Cookie。 |
| `HAYSTACK_ADDR` | `127.0.0.1:8080` | HTTP 监听地址。 |
| `HAYSTACK_DB_PATH` | `data/haystack.db` | SQLite 数据库路径，父目录会自动创建。 |
| `HAYSTACK_WEB_DIST` | `web/dist` | Vite 生产构建目录。 |
| `HAYSTACK_BASE_URL` | `http://localhost:8080` | 用于文章元数据的规范站点 URL。 |
| `HAYSTACK_ADMIN_PASSWORD_HASH` | 无 | 单管理员使用的 bcrypt 哈希，必须配置。 |
| `HAYSTACK_SESSION_TTL` | `12h` | 管理员 Session 的 Go duration，必须为正数。 |
| `HAYSTACK_SECURE_COOKIES` | 开发环境 `false`，生产环境 `true` | 显式覆盖 Secure Cookie 设置。 |

生产环境请将 `HAYSTACK_BASE_URL` 设置为公开 HTTPS 地址，并使用 `HAYSTACK_ENV=production`。

## Notes 内容流程

Notes 使用三种状态：

```text
draft ──publish──> published ──archive──> archived
  │                    │                    │
  └────────────────────┘                    └──delete
                       │
                 republish
```

- Draft 可以保存并发布。
- Published 文章可以编辑后重新发布，也可以归档。
- Archived 文章可以重新发布，也可以永久删除。
- 只有 Published 文章会出现在公开归档和公开详情页中。
- 删除操作有意限制为 Archived 文章。
- Slug 会被规范化，并且必须唯一。
- 阅读时长根据 Markdown 内容自动计算。

## API 概览

### 公开 API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/notes?page=1&tag=...` | 获取已发布 Notes，支持分页和可选标签筛选。 |
| `GET` | `/api/notes/:slug` | 获取一篇已发布文章以及新旧文章邻居。 |
| `GET` | `/healthz` | 返回服务健康状态。 |

### 管理员 Session API

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/session` | 检查当前 Session 是否已认证。 |
| `POST` | `/api/admin/session` | 使用管理员密码登录。 |
| `DELETE` | `/api/admin/session` | 注销当前 Session。 |

### 管理端 Notes API

所有管理端 Notes 接口都需要已认证 Session。写操作还需要有效的同源 `Origin` 请求头和 CSRF Token。

| 方法 | 接口 | 说明 |
| --- | --- | --- |
| `GET` | `/api/admin/notes?status=&page=1` | 按状态分页获取 Notes。 |
| `POST` | `/api/admin/notes` | 创建 Draft。 |
| `GET` | `/api/admin/notes/:id` | 加载一篇文章进行编辑。 |
| `PUT` | `/api/admin/notes/:id` | 更新一篇文章。 |
| `DELETE` | `/api/admin/notes/:id` | 删除 Archived 文章。 |
| `POST` | `/api/admin/notes/:id/publish` | 发布或重新发布文章。 |
| `POST` | `/api/admin/notes/:id/archive` | 归档 Published 文章。 |

## 安全设计

项目规模虽然较小，但对安全边界进行了明确处理：

- 管理员密码使用 bcrypt 校验，配置中只保存 bcrypt 哈希。
- Session Token 和 CSRF Token 使用密码学安全随机数生成。
- SQLite 只保存 Session Token 的 SHA-256 哈希，不保存原始 Token。
- Session Cookie 使用 `HttpOnly` 和 `SameSite=Strict`。
- CSRF Cookie 对前端可读，并且必须与 `X-CSRF-Token` 请求头匹配。
- 登录和写操作会将请求 `Origin` 与请求 Host 进行校验。
- 生产环境 Cookie 默认启用 `Secure`。
- Markdown 禁止渲染原始 HTML。
- Markdown 链接和图片会拒绝危险协议。
- Draft 和 Archived 内容不会出现在公开 API 或公开 HTML 元数据中。
- Open Graph 和 canonical 元数据会进行 HTML 转义。
- `.env` 文件、数据库文件、明文凭据和 Session 材料必须排除在版本控制之外。

该项目不是完整的身份认证平台，也不是多用户 CMS。公开部署时，请将它放在 HTTPS 和合适的反向代理之后。

## 测试与验证

运行 Go 测试：

```bash
go test ./...
```

运行前端单元测试：

```bash
npm --prefix web test -- --run
```

运行静态检查和生产构建：

```bash
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run build
```

运行浏览器验收测试：

```bash
npm --prefix web run e2e
```

Playwright 测试会在 `18080` 端口启动隔离的 Go 服务，使用 `data/` 下的临时 E2E 数据库，并验证公开内容、管理员发布流程、指针动效、键盘焦点、reduced motion、移动端溢出和路由级代码分块加载。

## 生产部署

最小部署由以下部分组成：

1. 编译后的 Go 二进制文件。
2. `web/dist` 前端构建目录。
3. 一个可写的 SQLite 数据库目录。
4. 由服务管理器或部署平台提供的环境变量。

构建两个产物：

```bash
npm --prefix web ci
npm --prefix web run build
go build -o bin/haystack ./cmd/haystack
```

生产环境示例：

```bash
export HAYSTACK_ENV=production
export HAYSTACK_ADDR=127.0.0.1:8080
export HAYSTACK_DB_PATH=/var/lib/haystack/haystack.db
export HAYSTACK_WEB_DIST=/opt/haystack/web/dist
export HAYSTACK_BASE_URL=https://your-domain.example
export HAYSTACK_ADMIN_PASSWORD_HASH='your-bcrypt-hash'
export HAYSTACK_SESSION_TTL=12h
```

启动二进制：

```bash
./bin/haystack
```

推荐的生产实践：

- 在反向代理处终止 TLS，并将请求转发到 Go 服务。
- 将 SQLite 数据库放在发布目录之外。
- 使用 SQLite 感知的备份流程，最好在服务停止时备份，或使用 SQLite 官方备份机制。
- 将 `.env`、数据库文件和生成的凭据排除在 Git 与部署产物之外。
- 修改管理员密码时生成新的 bcrypt 哈希并重启服务。
- 监控 `/healthz` 和服务日志。

## 许可证

Haystack 使用 [MIT License](LICENSE) 发布。

<details>
<summary>English version</summary>

# Haystack

> MAKE USEFUL THINGS.

Haystack is an independent developer homepage with a Markdown-based Notes publishing system. It combines a Signal / Playground visual identity with a small, deployable content workflow: one Go service, one SQLite database, and one frontend build directory.

The project is designed for a personal site that can introduce the maker, publish durable technical notes, and keep the entire publishing workflow under one roof.

## Features

- Signal-style homepage with responsive layout and an interactive 3D signal field.
- Reduced-motion support, keyboard navigation, visible focus states, and mobile overflow checks.
- Public Notes archive with pagination, tag filters, reading-time estimates, and newer/older navigation.
- GitHub Flavored Markdown rendering.
- Single-user admin workspace for creating and editing Notes.
- Draft, published, and archived Note states.
- Publish, republish, archive, and archive-only delete actions.
- SQLite persistence with automatic migrations.
- Secure password verification using bcrypt.
- Session-based admin authentication with CSRF and same-origin protection.
- Dynamic description, canonical URL, and Open Graph metadata for Note pages.
- Browser-tested public and admin workflows.

## Routes

### Public routes

| Route | Purpose |
| --- | --- |
| `/` | Signal homepage and latest Notes preview |
| `/notes` | Published Notes archive |
| `/notes/:slug` | Published Note detail page |

Draft and archived Notes are never returned by the public API or public HTML routes.

### Admin routes

| Route | Purpose |
| --- | --- |
| `/admin/login` | Password-based administrator login |
| `/admin/notes` | Browse Notes by status |
| `/admin/notes/new` | Create a draft |
| `/admin/notes/:id/edit` | Edit, publish, republish, or archive a Note |

The admin workspace is intentionally single-user. It is not a multi-tenant user-management system.

## Architecture

```text
Browser
  │
  ├── React application (web/dist)
  │       ├── Public homepage and Notes routes
  │       └── Lazy-loaded admin workspace
  │
  └── Go HTTP server
          ├── Static files and Note metadata injection
          ├── Public Notes API
          ├── Admin authentication and Notes API
          └── SQLite database
```

The backend follows a small Handler → Service → Repository structure:

- HTTP handlers translate requests and responses.
- The Notes service owns validation, status transitions, and reading-time calculation.
- The SQLite repository owns persistence, while migrations live in the database package.
- The authentication manager owns password verification, sessions, cookies, CSRF, and origin checks.

## Technology

### Backend

- Go 1.22+
- `net/http`
- SQLite through `modernc.org/sqlite`
- `golang.org/x/crypto/bcrypt`

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Motion
- React Three Fiber and Three.js
- React Hook Form and Zod
- React Markdown and `remark-gfm`
- Vitest, Testing Library, and Playwright

## Repository layout

```text
.
├── cmd/haystack/              # Go application entrypoint
├── internal/
│   ├── auth/                  # Passwords, sessions, CSRF, origin checks
│   ├── config/                # Environment-backed configuration
│   ├── db/                    # SQLite connection and migrations
│   ├── httpapi/               # Public, admin, auth, and static handlers
│   └── notes/                 # Note model, repository, and service
├── docs/
│   └── superpowers/           # Product and design planning documents
├── web/
│   ├── e2e/                   # Playwright browser acceptance tests
│   ├── src/components/ui/     # Small UI primitives
│   ├── src/features/admin/    # Admin login and Notes workspace
│   ├── src/features/home/     # Signal homepage and 3D scene
│   ├── src/features/notes/    # Public Notes archive and detail pages
│   └── src/styles/             # Global, admin, Notes, and Signal styles
├── .env.example               # Environment variable template
├── go.mod                     # Go module definition
├── LICENSE                    # MIT license
└── README.md
```

## Requirements

- Go 1.22 or newer.
- Node.js and npm. Node.js 22 is used for development and browser verification.
- A local bcrypt-compatible password hashing tool for creating the administrator hash.
- A modern browser for the frontend and Playwright's installed Chromium for E2E tests.

## Quick start

### 1. Install frontend dependencies

```bash
npm --prefix web install
```

### 2. Build the frontend

The Go server serves the compiled frontend from `web/dist` by default.

```bash
npm --prefix web run build
```

### 3. Prepare the administrator password hash

The server accepts a bcrypt hash, never a plaintext administrator password. If Apache `htpasswd` is available locally, it can create a bcrypt hash:

```bash
htpasswd -bnBC 12 "" 'replace-with-a-strong-password' | tr -d ':\n'
```

Use the resulting hash as `HAYSTACK_ADMIN_PASSWORD_HASH`. On PowerShell:

```powershell
$hash = htpasswd.exe -bnBC 12 "" "replace-with-a-strong-password"
$env:HAYSTACK_ADMIN_PASSWORD_HASH = $hash.Substring($hash.IndexOf(':') + 1).Trim()
```

If `htpasswd` is not installed, use another trusted local bcrypt tool. Do not commit the hash, plaintext password, `.env` file, or database file.

### 4. Configure the process environment

Copy the template for reference:

```bash
cp .env.example .env
```

The application reads process environment variables directly; it does not load `.env` files automatically. Export values from your shell, IDE, service manager, or deployment platform. For a Unix-like shell:

```bash
export HAYSTACK_ADDR=127.0.0.1:8080
export HAYSTACK_DB_PATH=data/haystack.db
export HAYSTACK_WEB_DIST=web/dist
export HAYSTACK_BASE_URL=http://localhost:8080
export HAYSTACK_ADMIN_PASSWORD_HASH='your-bcrypt-hash'
export HAYSTACK_SESSION_TTL=12h
```

For PowerShell:

```powershell
$env:HAYSTACK_ADDR = '127.0.0.1:8080'
$env:HAYSTACK_DB_PATH = 'data/haystack.db'
$env:HAYSTACK_WEB_DIST = 'web/dist'
$env:HAYSTACK_BASE_URL = 'http://localhost:8080'
$env:HAYSTACK_ADMIN_PASSWORD_HASH = 'your-bcrypt-hash'
$env:HAYSTACK_SESSION_TTL = '12h'
```

### 5. Start Haystack

```bash
go run ./cmd/haystack
```

Open [http://localhost:8080](http://localhost:8080). The first startup creates the SQLite parent directory, opens the database, and applies pending migrations automatically.

Check the service:

```bash
curl http://localhost:8080/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Frontend development mode

Keep the Go server running on port `8080`, then start Vite in another terminal:

```bash
npm --prefix web run dev
```

Vite runs on port `5173` and proxies `/api` requests to `http://localhost:8080`. The production-style flow remains available at port `8080` after `npm --prefix web run build`.

## Configuration reference

All configuration is provided through process environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `HAYSTACK_ENV` | `development` | Use `production` to require the password hash and enable secure-cookie defaults. |
| `HAYSTACK_ADDR` | `127.0.0.1:8080` | HTTP listen address. |
| `HAYSTACK_DB_PATH` | `data/haystack.db` | SQLite database path. Parent directories are created automatically. |
| `HAYSTACK_WEB_DIST` | `web/dist` | Directory containing the Vite production build. |
| `HAYSTACK_BASE_URL` | `http://localhost:8080` | Canonical site URL used for Note metadata. |
| `HAYSTACK_ADMIN_PASSWORD_HASH` | none | Required bcrypt hash for the single administrator. |
| `HAYSTACK_SESSION_TTL` | `12h` | Positive Go duration for admin sessions. |
| `HAYSTACK_SECURE_COOKIES` | `false`, or `true` in production | Explicitly override the Secure cookie setting. |

For production, set `HAYSTACK_BASE_URL` to the public HTTPS origin and use `HAYSTACK_ENV=production`.

## Notes workflow

Notes use three states:

```text
draft ──publish──> published ──archive──> archived
  │                    │                    │
  └────────────────────┘                    └──delete
                       │
                 republish
```

- A draft can be saved and published.
- A published Note can be edited and republished, or archived.
- An archived Note can be republished or permanently deleted.
- Only published Notes appear in the public archive and public detail routes.
- Deletion is intentionally limited to archived Notes.
- Slugs are normalized and must be unique.
- Reading time is calculated from Markdown content.

## API overview

### Public API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/notes?page=1&tag=...` | List published Notes with pagination and optional tag filtering. |
| `GET` | `/api/notes/:slug` | Return one published Note and its newer/older neighbors. |
| `GET` | `/healthz` | Return the service health status. |

### Admin session API

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/session` | Check whether the current session is authenticated. |
| `POST` | `/api/admin/session` | Authenticate with the administrator password. |
| `DELETE` | `/api/admin/session` | End the current session. |

### Admin Notes API

All admin Notes endpoints require an authenticated session. Write operations also require a valid same-origin `Origin` header and CSRF token.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/admin/notes?status=&page=1` | List Notes, optionally filtered by status. |
| `POST` | `/api/admin/notes` | Create a draft. |
| `GET` | `/api/admin/notes/:id` | Load a Note for editing. |
| `PUT` | `/api/admin/notes/:id` | Update a Note. |
| `DELETE` | `/api/admin/notes/:id` | Delete an archived Note. |
| `POST` | `/api/admin/notes/:id/publish` | Publish or republish a Note. |
| `POST` | `/api/admin/notes/:id/archive` | Archive a published Note. |

## Security model

The application is intentionally small, but security-sensitive boundaries are explicit:

- Administrator passwords are verified with bcrypt. Only the bcrypt hash belongs in configuration.
- Session and CSRF tokens are generated with cryptographic randomness.
- SQLite stores only a SHA-256 hash of the session token, never the raw token.
- The session cookie is `HttpOnly` and uses `SameSite=Strict`.
- The CSRF cookie is readable by the frontend and must match the `X-CSRF-Token` request header.
- Login and write operations validate the request `Origin` against the request host.
- Production cookies use `Secure` by default.
- Raw HTML is disabled in Markdown rendering.
- Markdown links and images reject unsafe protocols.
- Draft and archived content is excluded from public APIs and public HTML metadata.
- Open Graph and canonical metadata values are HTML-escaped.
- `.env` files, database files, plaintext credentials, and session material must remain outside version control.

This project is not a replacement for a full identity platform or a multi-user CMS. Put it behind HTTPS and an appropriate reverse proxy when deploying it publicly.

## Testing and verification

Run the Go tests:

```bash
go test ./...
```

Run the frontend unit tests:

```bash
npm --prefix web test -- --run
```

Run static checks and a production build:

```bash
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run build
```

Run the browser acceptance suite:

```bash
npm --prefix web run e2e
```

The Playwright setup starts an isolated Go server on port `18080`, uses a temporary E2E database under `data/`, and verifies public content, admin publishing, pointer motion, keyboard focus, reduced motion, mobile overflow, and route-level chunk loading.

## Production deployment

A minimal deployment consists of:

1. A compiled Go binary.
2. The `web/dist` frontend build.
3. A writable directory containing the SQLite database.
4. Environment variables supplied by the service manager or deployment platform.

Build both artifacts:

```bash
npm --prefix web ci
npm --prefix web run build
go build -o bin/haystack ./cmd/haystack
```

Example production environment:

```bash
export HAYSTACK_ENV=production
export HAYSTACK_ADDR=127.0.0.1:8080
export HAYSTACK_DB_PATH=/var/lib/haystack/haystack.db
export HAYSTACK_WEB_DIST=/opt/haystack/web/dist
export HAYSTACK_BASE_URL=https://your-domain.example
export HAYSTACK_ADMIN_PASSWORD_HASH='your-bcrypt-hash'
export HAYSTACK_SESSION_TTL=12h
```

Start the binary:

```bash
./bin/haystack
```

Recommended production practices:

- Terminate TLS at a reverse proxy and forward traffic to the Go service.
- Keep the SQLite database outside the release directory.
- Back up the database with an SQLite-aware process, preferably while the service is stopped or using SQLite's backup mechanisms.
- Keep `.env`, database files, and generated credentials out of Git and deployment artifacts.
- Rotate the administrator password by generating a new bcrypt hash and restarting the service.
- Monitor `/healthz` and the service logs.

## License

Haystack is released under the [MIT License](LICENSE).

</details>
