# Haystack Personal Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Haystack personal brand homepage with a Signal/Playground landing experience, public Markdown notes, and a single-admin publishing workflow.

**Architecture:** A Go 1.22+ service owns SQLite migrations, notes, session authentication, JSON APIs, and production static-file delivery. A React/Vite/TypeScript frontend owns the interactive public experience and a lazy-loaded shadcn/ui admin area; the Go server injects per-note Open Graph metadata before returning the React entry document.

**Tech Stack:** Go 1.22+, `net/http`, `database/sql`, `modernc.org/sqlite`, embedded SQL migrations, React, TypeScript, Vite, React Router, shadcn/ui, React Hook Form, Zod, React Markdown, `remark-gfm`, Vitest, Testing Library, Playwright.

**Spec:** [Haystack personal homepage design](../specs/2026-09-05-haystack-personal-homepage-design.md)

## Global Constraints

- Use Go 1.22+ with the standard library `net/http` and `database/sql`.
- Use `modernc.org/sqlite`; do not introduce a CGO-dependent SQLite driver.
- Keep the backend boundary `handler → service → repository`.
- Store Markdown in SQLite, disable raw HTML during public rendering, and allow only HTTPS external image URLs.
- Public APIs must return published notes only; drafts and archived notes must never be exposed publicly.
- Use a single administrator password hash from configuration and hashed, expiring session tokens in SQLite.
- Protect every state-changing admin request with HttpOnly/Secure/SameSite session cookies, Origin validation, and a CSRF token.
- Use shadcn/ui in the admin area; implement the public Signal visual layer with custom design tokens instead of default shadcn styling.
- Do not use WebGL or continuous particle effects; pointer motion must use CSS variables and `requestAnimationFrame` and must have a reduced-motion fallback.
- The public page must remain usable with keyboard navigation, touch input, and `prefers-reduced-motion` enabled.
- The first version does not include projects, comments, likes, multi-user access, rich CMS settings, file uploads, subscriptions, or chat.
- Do not commit secrets, SQLite data files, `node_modules`, build output, or `.superpowers` artifacts.

## File Map

The repository is currently a blank workspace with the approved design document as its only product artifact. The implementation creates the following focused units:

### Go backend

- `go.mod`: local Go module and backend dependencies.
- `cmd/haystack/main.go`: process wiring, configuration loading, migration startup, and HTTP server lifecycle.
- `internal/config/config.go`: environment-backed runtime configuration and validation.
- `internal/db/db.go`: SQLite connection and embedded migration runner.
- `internal/db/migrations/0001_initial.sql`: notes, tags, note-tag join, and admin-session tables.
- `internal/notes/model.go`: note statuses, note DTOs, filters, and domain errors.
- `internal/notes/repository.go`: repository interface and SQLite implementation.
- `internal/notes/service.go`: slug normalization, public filtering, reading-time calculation, and publish transitions.
- `internal/auth/password.go`: configured administrator password verification.
- `internal/auth/session.go`: random session token creation, hashing, expiry, cookie handling, and CSRF validation.
- `internal/httpapi/response.go`: consistent JSON success/error responses.
- `internal/httpapi/router.go`: route registration and dependency composition.
- `internal/httpapi/public_notes.go`: public list/detail handlers.
- `internal/httpapi/admin_notes.go`: authenticated draft/edit/publish/archive handlers.
- `internal/httpapi/auth.go`: login/logout handlers and protected-route middleware.
- `internal/httpapi/static.go`: frontend file serving and per-note metadata injection.
- `internal/httpapi/*_test.go`: HTTP-level tests using `httptest` and temporary SQLite databases.

### React frontend

- `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`: frontend toolchain and build configuration.
- `web/src/main.tsx`: React entry point and global providers.
- `web/src/app/App.tsx`: route tree and lazy loading of admin routes.
- `web/src/lib/api.ts`: typed fetch client with credentials and API error parsing.
- `web/src/lib/types.ts`: public/admin API types shared across components.
- `web/src/site.config.ts`: static Haystack copy, Now text, and external links.
- `web/src/styles/tokens.css`, `web/src/styles/global.css`, `web/src/styles/signal.css`: design tokens, base styles, and public interaction styles.
- `web/src/features/home/*`: Signal Poster, nodes, public sections, and pointer-motion hook.
- `web/src/features/notes/*`: list page, detail page, Markdown renderer, metadata, and note cards.
- `web/src/features/admin/*`: login, route guard, notes table, editor, preview, and publish controls.
- `web/src/components/ui/*`: only the shadcn primitives needed by the admin area.
- `web/src/**/*.test.tsx`: focused component and route tests.

### Browser and operational verification

- `playwright.config.ts`: browser test server and base URL configuration.
- `e2e/public.spec.ts`: responsive, keyboard, reduced-motion, and public content checks.
- `e2e/admin-publish.spec.ts`: login, draft, preview, publish, and public visibility flow.
- `.env.example`: non-secret runtime variable names and safe local defaults.
- `.gitignore`: excludes generated and sensitive files.

---

### Task 1: Scaffold the Go and React workspaces

**Files:**
- Create: `go.mod`
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/vite-env.d.ts`
- Create: `.gitignore`
- Create: `.env.example`
- Test: `web/src/main.test.tsx`

**Interfaces:**
- Produces a Go module named `hay-homepage` and a Vite app that later tasks can import without changing the module layout.
- Produces scripts named `dev`, `build`, `typecheck`, `lint`, and `test` in `web/package.json`.

- [ ] **Step 1: Write the initial frontend smoke test**

Create a minimal test proving the React entry renders a stable root marker:

```tsx
import { render, screen } from '@testing-library/react'
import { App } from './app/App'

test('renders the application root', () => {
  render(<App />)
  expect(screen.getByTestId('app-root')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the smoke test to verify the scaffold is incomplete**

Run: `npm --prefix web test -- --run src/main.test.tsx`

Expected: FAIL because `web/src/app/App.tsx` does not exist yet.

- [ ] **Step 3: Create the minimum Vite and Go scaffolding**

Configure Vite with React, TypeScript, `web/src` as the source root, and `/api` development proxying to `http://localhost:8080`. Create `App.tsx` with only:

```tsx
export function App() {
  return <main data-testid="app-root" />
}
```

Set `main.tsx` to mount `App` into `#root` and add the required `go 1.22` line to `go.mod`.

- [ ] **Step 4: Add scripts and ignore rules**

Use scripts with these meanings:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest"
}
```

Ignore `web/node_modules`, `web/dist`, `data/*.db`, `.env`, and `.superpowers` while keeping `.env.example` tracked.

- [ ] **Step 5: Run the scaffold checks**

Run: `npm --prefix web test -- --run src/main.test.tsx`

Expected: PASS.

Run: `npm --prefix web run build`

Expected: PASS and `web/dist/index.html` exists.

- [ ] **Step 6: Checkpoint the scaffold**

If Git has been initialized before implementation, commit the scaffold with:

```bash
git add go.mod web .gitignore .env.example
git commit -m "chore: scaffold haystack web and go apps"
```

---

### Task 2: Add SQLite migrations and database bootstrap

**Files:**
- Create: `internal/db/db.go`
- Create: `internal/db/migrations/0001_initial.sql`
- Test: `internal/db/db_test.go`

**Interfaces:**
- Produces `db.Open(ctx, path) (*sql.DB, error)` and `db.Migrate(ctx, conn) error`.
- Produces tables `notes`, `tags`, `note_tags`, `admin_sessions`, and a migration tracking table.

- [ ] **Step 1: Write migration behavior tests**

Use a temporary SQLite file rather than a mock database:

```go
func TestOpenRunsMigrationsAndIsIdempotent(t *testing.T) {
    path := filepath.Join(t.TempDir(), "haystack.db")
    ctx := context.Background()

    first, err := Open(ctx, path)
    if err != nil { t.Fatal(err) }
    if err := Migrate(ctx, first); err != nil { t.Fatal(err) }
    first.Close()

    second, err := Open(ctx, path)
    if err != nil { t.Fatal(err) }
    if err := Migrate(ctx, second); err != nil { t.Fatal(err) }

    var count int
    if err := second.QueryRowContext(ctx,
        `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'notes'`,
    ).Scan(&count); err != nil { t.Fatal(err) }
    if count != 1 { t.Fatalf("notes table count = %d", count) }
}
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `go test ./internal/db -run TestOpenRunsMigrationsAndIsIdempotent -v`

Expected: FAIL because the database package and migration file do not exist.

- [ ] **Step 3: Write the initial schema**

Create tables with these constraints:

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Add indexes for `notes(status, published_at)`, `notes(slug)`, and `admin_sessions(expires_at)`.

- [ ] **Step 4: Implement embedded migration execution**

Use `//go:embed migrations/*.sql`, create the migration table in a transaction, apply unapplied files in lexical order, and commit only after each migration succeeds. Configure SQLite foreign keys on connection.

- [ ] **Step 5: Run the migration test**

Run: `go test ./internal/db -run TestOpenRunsMigrationsAndIsIdempotent -v`

Expected: PASS.

- [ ] **Step 6: Checkpoint the database foundation**

```bash
git add internal/db
git commit -m "feat: add sqlite migrations and database bootstrap"
```

---

### Task 3: Implement the notes repository with real SQLite tests

**Files:**
- Create: `internal/notes/model.go`
- Create: `internal/notes/repository.go`
- Test: `internal/notes/repository_test.go`
- Modify: `internal/db/migrations/0001_initial.sql` only if repository tests expose a missing index or constraint

**Interfaces:**

Define these types in `internal/notes/model.go`:

```go
type NoteStatus string

const (
    StatusDraft     NoteStatus = "draft"
    StatusPublished NoteStatus = "published"
    StatusArchived  NoteStatus = "archived"
)

type Tag struct {
    Name string `json:"name"`
    Slug string `json:"slug"`
}

type Note struct {
    ID             int64       `json:"id"`
    Slug           string      `json:"slug"`
    Title          string      `json:"title"`
    Excerpt        string      `json:"excerpt"`
    ContentMarkdown string      `json:"contentMarkdown"`
    Status         NoteStatus  `json:"status"`
    PublishedAt    *time.Time  `json:"publishedAt,omitempty"`
    CreatedAt      time.Time   `json:"createdAt"`
    UpdatedAt      time.Time   `json:"updatedAt"`
    Tags           []Tag       `json:"tags"`
    ReadingMinutes int         `json:"readingMinutes"`
}

type Input struct {
    Slug            string
    Title           string
    Excerpt         string
    ContentMarkdown string
    Tags            []string
}

type ListFilter struct {
    Status   NoteStatus
    TagSlug  string
    Page     int
    PageSize int
}

type NoteList struct {
    Items      []Note `json:"items"`
    Page       int    `json:"page"`
    PageSize   int    `json:"pageSize"`
    Total      int    `json:"total"`
    TotalPages int    `json:"totalPages"`
}
```

The repository constructor is `NewRepository(db *sql.DB) *RepositorySQL`. Its interface exposes `Create`, `GetByID`, `GetPublishedBySlug`, `List`, `Update`, and `SetStatus`.

- [ ] **Step 1: Write repository tests against a temporary SQLite database**

Cover create/list/detail, tag filtering, published ordering, and status isolation:

```go
func TestListFiltersPublishedNotesByTag(t *testing.T) {
    repo := newTestRepository(t)
    ctx := context.Background()

    _, err := repo.Create(ctx, Input{
        Slug: "quiet-tools", Title: "Quiet Tools", Excerpt: "...",
        ContentMarkdown: "# Quiet Tools", Tags: []string{"tools"},
    })
    if err != nil { t.Fatal(err) }

    published := mustCreatePublished(t, repo, "public-note", []string{"tools"})
    mustCreateDraft(t, repo, "private-note", []string{"tools"})

    result, err := repo.List(ctx, ListFilter{
        Status: StatusPublished, TagSlug: "tools", Page: 1, PageSize: 12,
    })
    if err != nil { t.Fatal(err) }
    if len(result.Items) != 1 || result.Items[0].ID != published.ID {
        t.Fatalf("unexpected public notes: %+v", result.Items)
    }
}
```

Also test that updating tags replaces the join rows and that `GetPublishedBySlug` returns `ErrNotFound` for drafts.

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `go test ./internal/notes -run TestListFiltersPublishedNotesByTag -v`

Expected: FAIL because the repository implementation is missing.

- [ ] **Step 3: Implement SQL queries and tag synchronization**

Use transactions for create/update/tag replacement. Keep row scanning in small helpers. List queries must join tags only after filtering the note IDs, aggregate tags deterministically, and calculate total count separately. Return `ErrNotFound` for missing IDs and unpublished slugs.

- [ ] **Step 4: Run all notes repository tests**

Run: `go test ./internal/notes -v`

Expected: PASS with a real temporary SQLite database.

- [ ] **Step 5: Checkpoint the repository**

```bash
git add internal/notes internal/db/migrations/0001_initial.sql
git commit -m "feat: add notes repository"
```

---

### Task 4: Add the notes service and publish rules

**Files:**
- Create: `internal/notes/service.go`
- Test: `internal/notes/service_test.go`

**Interfaces:**

Create `Service` with:

```go
type Service struct {
    repo Repository
    now  func() time.Time
}

func NewService(repo Repository, now func() time.Time) *Service
func (s *Service) ListPublished(ctx context.Context, tagSlug string, page int) (NoteList, error)
func (s *Service) GetPublishedBySlug(ctx context.Context, slug string) (Note, error)
func (s *Service) CreateDraft(ctx context.Context, input Input) (Note, error)
func (s *Service) Update(ctx context.Context, id int64, input Input) (Note, error)
func (s *Service) Publish(ctx context.Context, id int64) (Note, error)
func (s *Service) Archive(ctx context.Context, id int64) (Note, error)
```

- [ ] **Step 1: Write failing service tests**

Use a fixed clock and assert the exact transitions:

```go
func TestPublishSetsPublishedAtAndAllowsPublicRead(t *testing.T) {
    now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
    service := newTestService(t, func() time.Time { return now })
    draft := mustCreateDraft(t, service, "useful-things")

    published, err := service.Publish(context.Background(), draft.ID)
    if err != nil { t.Fatal(err) }
    if published.Status != StatusPublished { t.Fatal("expected published status") }
    if published.PublishedAt == nil || !published.PublishedAt.Equal(now) {
        t.Fatalf("publishedAt = %v", published.PublishedAt)
    }

    public, err := service.GetPublishedBySlug(context.Background(), draft.Slug)
    if err != nil { t.Fatal(err) }
    if public.ReadingMinutes < 1 { t.Fatal("reading time must be positive") }
}
```

Add tests for slug normalization, duplicate slug errors, draft isolation, archived-to-published transition, invalid archive of a draft, and the 12-item default page size.

- [ ] **Step 2: Run service tests to verify failure**

Run: `go test ./internal/notes -run 'TestPublish|TestNormalize|TestArchive' -v`

Expected: FAIL because `Service` is not implemented.

- [ ] **Step 3: Implement validation and transitions**

Normalize slugs to lowercase kebab-case and reject empty or invalid values at the service boundary. Allow `draft → published` and `archived → published`; allow `published → archived`; reject archiving a draft. Set `published_at` when publishing and preserve it when archiving. Calculate reading time as `max(1, ceil(visibleRuneCount/500))` so Chinese and space-separated text both receive a deterministic estimate.

- [ ] **Step 4: Run service and repository tests**

Run: `go test ./internal/notes ./internal/db -v`

Expected: PASS.

- [ ] **Step 5: Checkpoint the service**

```bash
git add internal/notes
git commit -m "feat: add note publishing service"
```

---

### Task 5: Implement public JSON APIs and unified responses

**Files:**
- Create: `internal/httpapi/response.go`
- Create: `internal/httpapi/public_notes.go`
- Test: `internal/httpapi/public_notes_test.go`

**Interfaces:**

Create handlers with:

```go
func NewPublicNotesHandler(service *notes.Service) http.Handler
```

The endpoints are:

- `GET /api/notes?tag=&page=` → `notes.NoteList` without Markdown content in list items.
- `GET /api/notes/{slug}` → one published note with Markdown content.

Use `writeJSON(w, status, value)` and `writeError(w, status, code, message)` from `response.go`.

- [ ] **Step 1: Write failing HTTP tests**

Seed one published note and one draft in SQLite, then assert:

```go
func TestPublicListDoesNotExposeDrafts(t *testing.T) {
    service := seededNotesService(t)
    handler := NewPublicNotesHandler(service)
    request := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
    response := httptest.NewRecorder()

    handler.ServeHTTP(response, request)

    if response.Code != http.StatusOK { t.Fatalf("status = %d", response.Code) }
    body := response.Body.String()
    if strings.Contains(body, "draft-only-slug") {
        t.Fatal("draft leaked into public response")
    }
}
```

Also test tag filtering, invalid page values, missing slug returning 404, and `application/json` content type.

- [ ] **Step 2: Run the API tests to verify failure**

Run: `go test ./internal/httpapi -run TestPublic -v`

Expected: FAIL because the handler and response helpers do not exist.

- [ ] **Step 3: Implement public handlers**

Parse `page` with default 1, cap `pageSize` at 12, pass the tag to `ListPublished`, and map domain errors to 404/400. Remove `ContentMarkdown` from list DTOs with an explicit public list type rather than relying on accidental JSON behavior.

- [ ] **Step 4: Run public API tests**

Run: `go test ./internal/httpapi -run TestPublic -v`

Expected: PASS.

- [ ] **Step 5: Checkpoint the public API**

```bash
git add internal/httpapi
git commit -m "feat: add public notes api"
```

---

### Task 6: Implement administrator authentication, sessions, and CSRF

**Files:**
- Create: `internal/auth/password.go`
- Create: `internal/auth/session.go`
- Create: `internal/httpapi/auth.go`
- Test: `internal/auth/session_test.go`
- Test: `internal/httpapi/auth_test.go`

**Interfaces:**

Create:

```go
type PasswordVerifier struct { hash []byte }
func NewPasswordVerifier(hash string) (*PasswordVerifier, error)
func (p *PasswordVerifier) Verify(password string) error

type Manager struct {
    sessions SessionStore
    verifier *PasswordVerifier
    now      func() time.Time
    ttl      time.Duration
}
func NewManager(store SessionStore, verifier *PasswordVerifier, now func() time.Time, ttl time.Duration) *Manager
func (m *Manager) Login(ctx context.Context, w http.ResponseWriter, password string) error
func (m *Manager) Logout(ctx context.Context, w http.ResponseWriter, r *http.Request) error
func (m *Manager) Current(ctx context.Context, r *http.Request) (Session, error)
func (m *Manager) ValidateCSRF(r *http.Request) error
```

Use `crypto/rand` for raw token generation, SHA-256 for the stored token hash, bcrypt for configured password verification, an HttpOnly `haystack_session` cookie, and a readable `haystack_csrf` cookie. The write middleware requires the header `X-CSRF-Token` to equal the CSRF cookie and validates the request Origin against the request host.

- [ ] **Step 1: Write failing authentication tests**

Cover wrong passwords, login cookie flags, expired sessions, logout, missing CSRF, and mismatched CSRF:

```go
func TestLoginSetsSecureSessionAndCSRFCookies(t *testing.T) {
    manager := newTestManager(t)
    response := httptest.NewRecorder()

    if err := manager.Login(context.Background(), response, "correct-password"); err != nil {
        t.Fatal(err)
    }

    cookies := response.Result().Cookies()
    if findCookie(cookies, "haystack_session").HttpOnly != true {
        t.Fatal("session cookie must be HttpOnly")
    }
    if findCookie(cookies, "haystack_csrf").HttpOnly {
        t.Fatal("csrf cookie must be readable by the frontend")
    }
}
```

- [ ] **Step 2: Run auth tests to verify failure**

Run: `go test ./internal/auth ./internal/httpapi -run 'TestLogin|TestCSRF|TestSession' -v`

Expected: FAIL because the manager and handlers are missing.

- [ ] **Step 3: Implement session persistence and middleware**

Persist only hashed tokens and expiration timestamps through a small `SessionStore` backed by the repository layer. Delete expired sessions on lookup. Never include the configured password hash or raw session token in a response body or log.

- [ ] **Step 4: Add login/logout endpoints**

Implement `POST /api/admin/session` with `{ "password": "..." }`, `DELETE /api/admin/session`, and `GET /api/admin/session` for the route guard. Return a generic 401 message for all authentication failures.

- [ ] **Step 5: Run auth tests**

Run: `go test ./internal/auth ./internal/httpapi -v`

Expected: PASS.

- [ ] **Step 6: Checkpoint authentication**

```bash
git add internal/auth internal/httpapi
git commit -m "feat: add admin sessions and csrf protection"
```

---

### Task 7: Add authenticated notes management APIs

**Files:**
- Create: `internal/httpapi/admin_notes.go`
- Modify: `internal/httpapi/router.go`
- Test: `internal/httpapi/admin_notes_test.go`

**Interfaces:**

Register these handlers behind the session and CSRF middleware:

- `GET /api/admin/notes?status=`
- `POST /api/admin/notes`
- `PUT /api/admin/notes/{id}`
- `POST /api/admin/notes/{id}/publish`
- `POST /api/admin/notes/{id}/archive`

Use request DTOs:

```go
type noteInputRequest struct {
    Slug            string   `json:"slug"`
    Title           string   `json:"title"`
    Excerpt         string   `json:"excerpt"`
    ContentMarkdown string   `json:"contentMarkdown"`
    Tags            []string `json:"tags"`
}
```

- [ ] **Step 1: Write failing management API tests**

Test that a valid authenticated request can create a draft and that an unauthenticated or CSRF-missing request cannot mutate data:

```go
func TestCreateNoteRequiresSessionAndCSRF(t *testing.T) {
    app := newTestAPI(t)
    body := strings.NewReader(`{"slug":"first-note","title":"First Note","excerpt":"...","contentMarkdown":"# First","tags":["build"]}`)
    request := httptest.NewRequest(http.MethodPost, "/api/admin/notes", body)
    request.Header.Set("Content-Type", "application/json")
    response := httptest.NewRecorder()

    app.ServeHTTP(response, request)

    if response.Code != http.StatusUnauthorized { t.Fatalf("status = %d", response.Code) }
}
```

Add tests for draft creation, update, publish, archive, invalid state transition, slug conflict, and public visibility after publish.

- [ ] **Step 2: Run management tests to verify failure**

Run: `go test ./internal/httpapi -run TestCreateNoteRequiresSessionAndCSRF -v`

Expected: FAIL because the routes are not registered.

- [ ] **Step 3: Implement request decoding and status mapping**

Decode JSON with a bounded body reader, pass the validated input to `notes.Service`, return 201 for draft creation, 200 for update/status changes, 400 for invalid input/state, 404 for unknown IDs, and 409 for slug conflicts.

- [ ] **Step 4: Wire the full router**

Create:

```go
type Dependencies struct {
    Notes    *notes.Service
    Auth     *auth.Manager
    DistDir  string
    BaseURL  string
}

func NewRouter(deps Dependencies) http.Handler
```

Register API routes before the static fallback so `/api/*` never receives `index.html`.

- [ ] **Step 5: Run management and all Go tests**

Run: `go test ./... -v`

Expected: PASS.

- [ ] **Step 6: Checkpoint the management API**

```bash
git add internal/httpapi
git commit -m "feat: add authenticated note management api"
```

---

### Task 8: Add runtime configuration, static delivery, and Open Graph injection

**Files:**
- Create: `internal/config/config.go`
- Create: `internal/httpapi/static.go`
- Create: `cmd/haystack/main.go`
- Modify: `web/index.html`
- Test: `internal/httpapi/static_test.go`
- Test: `internal/config/config_test.go`

**Interfaces:**

Configuration must expose:

```go
type Config struct {
    Addr               string
    DBPath             string
    DistDir            string
    BaseURL            string
    AdminPasswordHash  string
    SessionTTL         time.Duration
}
func Load() (Config, error)
```

Static rendering must expose:

```go
type StaticRenderer struct {
    DistDir string
    Notes   *notes.Service
    BaseURL string
}
func (s *StaticRenderer) ServeHTTP(w http.ResponseWriter, r *http.Request)
```

- [ ] **Step 1: Write configuration and metadata tests**

Assert defaults for local development and rejection of a missing production password hash. For static delivery, create a temporary `index.html` containing `<!-- HAYSTACK_META -->`, seed a published note and a draft, then assert that the published title/description/Open Graph tags are injected while draft content never appears.

- [ ] **Step 2: Run tests to verify failure**

Run: `go test ./internal/config ./internal/httpapi -run 'TestLoad|TestStatic|TestMetadata' -v`

Expected: FAIL because configuration and renderer are not implemented.

- [ ] **Step 3: Add the HTML metadata marker**

Place this marker in `web/index.html` inside `<head>`:

```html
<!-- HAYSTACK_META -->
```

Keep a static default title and description around the marker for routes without a note.

- [ ] **Step 4: Implement safe metadata injection**

For `/notes/{slug}`, call `GetPublishedBySlug`. If found, escape title, description, canonical URL, and `og:url` with `html/template` or equivalent HTML escaping before replacing the marker. If the note is missing, return a public 404 response instead of exposing draft existence. All other non-API paths serve the React entry; static assets are served from `DistDir`.

- [ ] **Step 5: Wire `main.go`**

Load config, open SQLite, run migrations, create repository/service/auth dependencies, build `NewRouter`, and start `http.Server` with read/write/idle timeouts. Add `GET /healthz` returning `{"status":"ok"}`.

- [ ] **Step 6: Run backend build and tests**

Run: `go test ./... -v`

Expected: PASS.

Run: `go build ./cmd/haystack`

Expected: PASS.

- [ ] **Step 7: Checkpoint runtime delivery**

```bash
git add internal/config internal/httpapi cmd/haystack web/index.html
git commit -m "feat: serve web app and note metadata from go"
```

---

### Task 9: Build the frontend API layer, routes, and design tokens

**Files:**
- Modify: `web/package.json`
- Create: `web/src/lib/types.ts`
- Create: `web/src/lib/api.ts`
- Create: `web/src/site.config.ts`
- Create: `web/src/app/App.tsx`
- Create: `web/src/app/RouteError.tsx`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/global.css`
- Modify: `web/src/main.tsx`
- Test: `web/src/lib/api.test.ts`
- Test: `web/src/app/App.test.tsx`

**Interfaces:**

Define public types matching Go JSON:

```ts
export type NoteStatus = 'draft' | 'published' | 'archived'

export interface NoteListItem {
  id: number
  slug: string
  title: string
  excerpt: string
  status: NoteStatus
  publishedAt?: string
  createdAt: string
  updatedAt: string
  tags: { name: string; slug: string }[]
  readingMinutes: number
}

export interface NoteDetail extends NoteListItem {
  contentMarkdown: string
}

export interface NoteListResponse {
  items: NoteListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
```

Export typed functions from `web/src/lib/api.ts`:

```ts
export async function getNotes(params?: { tag?: string; page?: number }): Promise<NoteListResponse>
export async function getNote(slug: string): Promise<NoteDetail>
export async function login(password: string): Promise<void>
export async function logout(): Promise<void>
export async function getSession(): Promise<{ authenticated: boolean }>
```

Admin functions are added in Task 12 with the same `requestJson` helper and `credentials: 'include'`.

- [ ] **Step 1: Write failing API client tests**

Mock `global.fetch` and assert URL encoding, credentials, JSON parsing, and a typed `ApiError` when the server returns the unified error envelope:

```ts
it('requests published notes with tag and page', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [], page: 2, pageSize: 12, total: 0, totalPages: 0 }), { status: 200 }))
  await getNotes({ tag: 'build ideas', page: 2 })
  expect(fetch).toHaveBeenCalledWith('/api/notes?tag=build%20ideas&page=2', expect.objectContaining({ credentials: 'include' }))
})
```

- [ ] **Step 2: Run frontend tests to verify failure**

Run: `npm --prefix web test -- --run src/lib/api.test.ts src/app/App.test.tsx`

Expected: FAIL because the API layer, route tree, and design styles do not exist.

- [ ] **Step 3: Implement the request helper and public routes**

Create routes for `/`, `/notes`, `/notes/:slug`, `/admin/login`, and lazy-loaded `/admin/*`. Use an error element that shows a retry action without rendering a stack trace. Keep static copy and links in `site.config.ts`.

- [ ] **Step 4: Add the approved design tokens**

Define CSS variables for `#0C0E0D`, `#EFFFF1`, `#98A895`, `#B8FF3D`, `#FF6542`, and `#273328`; add Geist/Inter fallback stacks, focus styles, selection color, max content widths, and the mobile single-column breakpoint. Do not import shadcn defaults into public styles.

- [ ] **Step 5: Run API and route tests**

Run: `npm --prefix web test -- --run src/lib/api.test.ts src/app/App.test.tsx`

Expected: PASS.

Run: `npm --prefix web run typecheck`

Expected: PASS.

- [ ] **Step 6: Checkpoint the frontend shell**

```bash
git add web/package.json web/src web/index.html
git commit -m "feat: add frontend routes and api client"
```

---

### Task 10: Implement the Signal Playground homepage

**Files:**
- Create: `web/src/features/home/HomePage.tsx`
- Create: `web/src/features/home/SignalPoster.tsx`
- Create: `web/src/features/home/SignalNode.tsx`
- Create: `web/src/features/home/NowSection.tsx`
- Create: `web/src/features/home/NotesPreview.tsx`
- Create: `web/src/features/home/AboutSection.tsx`
- Create: `web/src/features/home/LinksSection.tsx`
- Create: `web/src/features/home/usePointerOrbit.ts`
- Create: `web/src/styles/signal.css`
- Test: `web/src/features/home/HomePage.test.tsx`
- Test: `web/src/features/home/usePointerOrbit.test.ts`

**Interfaces:**

- `SignalNode` accepts `{ label: 'NOW' | 'NOTES' | 'LINKS'; href: string; detail: string }` and renders a keyboard-focusable link.
- `usePointerOrbit(enabled: boolean)` returns `{ containerRef, style }`; it updates CSS variables only inside a `requestAnimationFrame` loop and returns static values when disabled.
- `HomePage` calls `getNotes({ page: 1 })`, passes the first three items to `NotesPreview`, and renders a visible retry state when the request fails.

- [ ] **Step 1: Write failing homepage tests**

Cover stable copy, keyboard navigation, the latest three notes, and request failure:

```tsx
it('exposes signal links without relying on hover', async () => {
  vi.spyOn(api, 'getNotes').mockResolvedValue({ items: [], page: 1, pageSize: 12, total: 0, totalPages: 0 })
  render(<HomePage />)
  expect(screen.getByRole('link', { name: /notes/i })).toHaveAttribute('href', '/notes')
  expect(screen.getByText('MAKE USEFUL THINGS.')).toBeVisible()
})
```

Add a test that `prefers-reduced-motion` disables pointer updates and a test that the API error renders a retry button.

- [ ] **Step 2: Run homepage tests to verify failure**

Run: `npm --prefix web test -- --run src/features/home`

Expected: FAIL because the home feature is missing.

- [ ] **Step 3: Implement the static Signal Poster**

Build the poster with Haystack label, index number, large declaration, scroll cue, low-contrast orbit/grid, and visible `NOW`, `NOTES`, and `LINKS` nodes. Use normal anchor links; hover only enhances the visual state.

- [ ] **Step 4: Implement pointer motion with reduced-motion support**

Use one `pointermove` listener on the poster container, store the latest coordinates, schedule one animation-frame write to `--orbit-x` and `--orbit-y`, and cancel the frame on unmount. Use `matchMedia('(prefers-reduced-motion: reduce)')` to disable listeners and reset variables.

- [ ] **Step 5: Implement below-the-fold sections**

Render Now, latest three Notes, About, Links, and footer in the approved order. Use static copy from `site.config.ts`, and keep failed note loading local to the Notes preview so the rest of the homepage remains usable.

- [ ] **Step 6: Run component tests and build**

Run: `npm --prefix web test -- --run src/features/home`

Expected: PASS.

Run: `npm --prefix web run build`

Expected: PASS.

- [ ] **Step 7: Checkpoint the homepage**

```bash
git add web/src/features/home web/src/styles/signal.css web/src/site.config.ts
git commit -m "feat: add signal playground homepage"
```

---

### Task 11: Implement public Notes list, Markdown detail, and metadata

**Files:**
- Create: `web/src/features/notes/NotesListPage.tsx`
- Create: `web/src/features/notes/NoteCard.tsx`
- Create: `web/src/features/notes/NoteDetailPage.tsx`
- Create: `web/src/features/notes/MarkdownArticle.tsx`
- Create: `web/src/features/notes/noteMeta.ts`
- Create: `web/src/styles/notes.css`
- Test: `web/src/features/notes/NotesListPage.test.tsx`
- Test: `web/src/features/notes/NoteDetailPage.test.tsx`
- Test: `web/src/features/notes/MarkdownArticle.test.tsx`

**Interfaces:**

- `NotesListPage` reads `tag` and `page` from `URLSearchParams`, calls `getNotes`, renders loading/error/empty/success states, and updates the query string when a tag is selected.
- `NoteDetailPage` reads `slug`, calls `getNote`, sets `document.title`, description, and canonical link, and renders previous/next links when present.
- `MarkdownArticle` accepts `{ markdown: string }` and renders GFM without raw HTML. Link components must reject non-HTTP(S) protocols and add `rel="noreferrer"` to external links.

- [ ] **Step 1: Write failing list/detail/rendering tests**

Test the four public states and the XSS boundary:

```tsx
it('does not render raw html from markdown', () => {
  render(<MarkdownArticle markdown={'# Safe\n\n<script>alert("x")</script>'} />)
  expect(screen.getByRole('heading', { name: 'Safe' })).toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
})
```

Also test that an empty response produces the designed empty state, a tag filter updates the URL, and a failed detail request provides a back-to-Notes link.

- [ ] **Step 2: Run Notes tests to verify failure**

Run: `npm --prefix web test -- --run src/features/notes`

Expected: FAIL because the Notes feature files are missing.

- [ ] **Step 3: Implement list and card layout**

Use a readable content width, low-motion hover treatment, title/excerpt/tag/date/reading-time fields, tag buttons, and simple pagination only when `totalPages > 1`. Do not add full-text search.

- [ ] **Step 4: Implement safe Markdown rendering**

Use `react-markdown` with `remark-gfm` and no `rehype-raw`. Render headings, paragraphs, lists, blockquotes, code, and links with the Notes typography. Reject `javascript:`, `data:`, and other non-HTTP(S) link protocols before rendering.

- [ ] **Step 5: Implement detail metadata and navigation**

Update title/description/canonical on load and restore the default values on unmount. Render previous/next links only when returned by the API. Keep the article body width around 680–760px and line-height near 1.75.

- [ ] **Step 6: Run public Notes tests and build**

Run: `npm --prefix web test -- --run src/features/notes`

Expected: PASS.

Run: `npm --prefix web run typecheck && npm --prefix web run build`

Expected: PASS.

- [ ] **Step 7: Checkpoint public Notes**

```bash
git add web/src/features/notes web/src/styles/notes.css web/src/lib/api.ts web/src/lib/types.ts
git commit -m "feat: add public notes pages"
```

---

### Task 12: Implement the lazy-loaded shadcn admin UI

**Files:**
- Create: `web/src/features/admin/AdminRoutes.tsx`
- Create: `web/src/features/admin/AdminGuard.tsx`
- Create: `web/src/features/admin/LoginPage.tsx`
- Create: `web/src/features/admin/NotesAdminPage.tsx`
- Create: `web/src/features/admin/NoteEditorPage.tsx`
- Create: `web/src/features/admin/MarkdownPreview.tsx`
- Create: `web/src/features/admin/adminApi.ts`
- Create: `web/src/components/ui/button.tsx`
- Create: `web/src/components/ui/input.tsx`
- Create: `web/src/components/ui/textarea.tsx`
- Create: `web/src/components/ui/tabs.tsx`
- Create: `web/src/components/ui/dialog.tsx`
- Create: `web/src/components/ui/badge.tsx`
- Create: `web/src/components/ui/table.tsx`
- Create: `web/src/components/ui/sonner.tsx`
- Test: `web/src/features/admin/LoginPage.test.tsx`
- Test: `web/src/features/admin/NoteEditorPage.test.tsx`
- Test: `web/src/features/admin/NotesAdminPage.test.tsx`

**Interfaces:**

Admin API functions:

```ts
export async function getAdminNotes(status?: NoteStatus): Promise<NoteListResponse>
export async function createDraft(input: NoteInput): Promise<NoteDetail>
export async function updateNote(id: number, input: NoteInput): Promise<NoteDetail>
export async function publishNote(id: number): Promise<NoteDetail>
export async function archiveNote(id: number): Promise<NoteDetail>
```

`NoteEditorPage` uses React Hook Form + Zod and exposes a `Save draft` action separate from `Publish`. `AdminGuard` calls `getSession` and redirects unauthenticated users to `/admin/login`.

- [ ] **Step 1: Write failing admin tests**

Test login error, protected redirect, form validation, draft save, Markdown preview, and publish confirmation:

```tsx
it('keeps save draft and publish as separate actions', async () => {
  render(<NoteEditorPage />)
  expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /publish/i })).not.toHaveAttribute('type', 'submit')
})
```

- [ ] **Step 2: Run admin tests to verify failure**

Run: `npm --prefix web test -- --run src/features/admin`

Expected: FAIL because the admin routes, API, and UI primitives are missing.

- [ ] **Step 3: Add only the required shadcn primitives**

Initialize the shadcn configuration and add Button, Input, Textarea, Tabs, Dialog, Badge, Table, and Sonner. Keep their tokens scoped so admin component styling does not replace the public Signal palette.

- [ ] **Step 4: Implement auth guard and login page**

Submit the password through `login`, show a generic error for 401, redirect to `/admin/notes` on success, and provide logout from the admin shell. Keep session cookies out of JavaScript storage.

- [ ] **Step 5: Implement notes table and editor**

The table filters draft/published/archived status and links to edit. The editor validates title, slug, excerpt, and non-empty Markdown; renders a side-by-side or tabbed preview; sends credentials and CSRF headers; and displays API errors beside fields or through Sonner.

- [ ] **Step 6: Implement publish/archive confirmation**

Use a Dialog that displays title, slug, and intended action. Only after confirmation call the status endpoint, refresh the row, and show a success toast. Keep archive separate from delete so no content is destroyed.

- [ ] **Step 7: Verify admin lazy loading**

Use `React.lazy(() => import('./features/admin/AdminRoutes'))` and assert in a build inspection or route test that the editor module is not imported by the public home module.

- [ ] **Step 8: Run admin tests and type checks**

Run: `npm --prefix web test -- --run src/features/admin`

Expected: PASS.

Run: `npm --prefix web run typecheck && npm --prefix web run build`

Expected: PASS.

- [ ] **Step 9: Checkpoint the admin UI**

```bash
git add web/src/features/admin web/src/components/ui web/src/app/App.tsx
git commit -m "feat: add admin note editor and publishing ui"
```

---

### Task 13: Add browser acceptance coverage and operational verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/public.spec.ts`
- Create: `e2e/admin-publish.spec.ts`
- Modify: `web/package.json`
- Modify: `.env.example`
- Test: `go test ./...`
- Test: `npm --prefix web run typecheck`
- Test: `npm --prefix web run build`

**Interfaces:**
- Playwright starts the built Go server with a temporary SQLite path and a test bcrypt password hash.
- The test server exposes the same `GET /healthz`, public API, admin API, static route, and metadata behavior as production.

- [ ] **Step 1: Write the public browser tests**

Cover:

1. Desktop home shows the Signal declaration, visible Notes link, Now section, and latest published notes.
2. Keyboard tab navigation reaches all Signal nodes and shows visible focus.
3. Mobile viewport has no horizontal overflow and Signal nodes are tappable.
4. Reduced-motion emulation leaves all text and links visible and does not register pointer animation.
5. A public page network trace does not request the admin editor chunk.

- [ ] **Step 2: Write the publish flow browser test**

Use the seeded admin password to login, create a draft, save it, verify it does not appear publicly, publish it, then verify it appears in `/notes`, `/notes/{slug}`, and the returned HTML contains the correct Open Graph title and description. Archive it and verify it disappears from public list/detail responses.

- [ ] **Step 3: Run the browser tests before final fixes**

Run: `npx playwright test`

Expected: FAIL only for missing wiring or behavior covered by the remaining implementation; record the first failing assertion and fix the underlying boundary rather than loosening the test.

- [ ] **Step 4: Verify the complete local production path**

Run:

```bash
go test ./...
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run build
go build ./cmd/haystack
npx playwright test
```

Expected: every command exits 0; the Go binary serves the built frontend, SQLite migrations run against an empty database, and the publish flow passes.

- [ ] **Step 5: Check responsive and accessibility behavior manually in a browser**

Use the running app at desktop and mobile widths. Verify the poster hierarchy, hover/focus states, Notes readability, admin form errors, reduced-motion behavior, and absence of horizontal scrolling. Do not claim completion until the golden path and the publish edge cases have been exercised.

- [ ] **Step 6: Checkpoint the verified release candidate**

```bash
git add playwright.config.ts e2e web/package.json .env.example
git commit -m "test: verify haystack public and admin flows"
```

## Plan Self-Review

- **Spec coverage:** Product positioning and non-goals are captured in the global constraints; visual tokens and motion rules are covered by Tasks 9–10; public routes and Notes behavior are covered by Tasks 9–11; admin workflow is covered by Tasks 6–7 and 12; Go/SQLite boundaries are covered by Tasks 1–8; security is covered by Task 6 and Task 7; metadata injection is covered by Task 8; responsive, keyboard, reduced-motion, and publish acceptance are covered by Task 13; deployment output is produced by Tasks 1 and 8.
- **Placeholder scan:** The plan contains no unresolved placeholder markers or unspecified implementation step. Every task names concrete files, interfaces, tests, commands, and expected results.
- **Type consistency:** `notes.Note`, `notes.NoteList`, `notes.Input`, `notes.Service`, `auth.Manager`, `httpapi.Dependencies`, and the TypeScript `NoteListItem`/`NoteDetail` types are defined before later tasks consume them. Public list DTOs intentionally omit Markdown while detail DTOs include it.
- **Scope check:** The backend, public frontend, and admin frontend are coupled through the same Notes API and are therefore kept in one ordered plan rather than split into independent sub-projects. Each task leaves a testable boundary for the next task.
