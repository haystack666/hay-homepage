package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"hay-homepage/internal/db"
	"hay-homepage/internal/notes"
)

func newStaticTestService(t *testing.T) *notes.Service {
	t.Helper()
	conn, err := db.Open(context.Background(), filepath.Join(t.TempDir(), "static.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	return notes.NewService(notes.NewRepository(conn), func() time.Time {
		return time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	})
}

func TestStaticRendererInjectsPublishedNoteMetadata(t *testing.T) {
	distDir := t.TempDir()
	index := `<!doctype html><html><head><meta name="description" content="default"><!-- HAYSTACK_META --><title>Haystack — Independent Developer</title></head><body><div id="root"></div></body></html>`
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte(index), 0o644); err != nil {
		t.Fatal(err)
	}
	service := newStaticTestService(t)
	note, err := service.CreateDraft(context.Background(), notes.Input{
		Slug: "safe-note", Title: `A "useful" note`, Excerpt: `Build & ship`, ContentMarkdown: "# Note",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Publish(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}

	renderer := &StaticRenderer{DistDir: distDir, Notes: service, BaseURL: "https://haystack.example"}
	request := httptest.NewRequest(http.MethodGet, "/notes/safe-note", nil)
	response := httptest.NewRecorder()
	renderer.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	body := response.Body.String()
	for _, fragment := range []string{
		`<title>A &#34;useful&#34; note — Haystack</title>`,
		`property="og:title" content="A &#34;useful&#34; note"`,
		`property="og:description" content="Build &amp; ship"`,
		`href="https://haystack.example/notes/safe-note"`,
	} {
		if !strings.Contains(body, fragment) {
			t.Fatalf("metadata fragment %q missing from %s", fragment, body)
		}
	}
}

func TestStaticRendererDoesNotExposeDraftRoute(t *testing.T) {
	distDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte("<html><head><!-- HAYSTACK_META --></head></html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	renderer := &StaticRenderer{DistDir: distDir, Notes: newStaticTestService(t), BaseURL: "http://localhost:8080"}
	request := httptest.NewRequest(http.MethodGet, "/notes/draft-only", nil)
	response := httptest.NewRecorder()
	renderer.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("draft route status = %d", response.Code)
	}
}

func TestStaticRendererServesAssetsAndSPAEntry(t *testing.T) {
	distDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(distDir, "index.html"), []byte("index"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(distDir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(distDir, "assets", "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatal(err)
	}
	renderer := &StaticRenderer{DistDir: distDir, Notes: newStaticTestService(t), BaseURL: "http://localhost:8080"}

	asset := httptest.NewRecorder()
	renderer.ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/assets/app.js", nil))
	if asset.Code != http.StatusOK || asset.Body.String() != "console.log(1)" {
		t.Fatalf("asset response = %d %q", asset.Code, asset.Body.String())
	}

	spa := httptest.NewRecorder()
	renderer.ServeHTTP(spa, httptest.NewRequest(http.MethodGet, "/about", nil))
	if spa.Code != http.StatusOK || spa.Body.String() != "index" {
		t.Fatalf("spa response = %d %q", spa.Code, spa.Body.String())
	}
}
