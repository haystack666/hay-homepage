package httpapi

import (
	"errors"
	"html"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"hay-homepage/internal/notes"
)

type StaticRenderer struct {
	DistDir string
	Notes   *notes.Service
	BaseURL string
}

func (s *StaticRenderer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	if slug, ok := noteSlugFromPath(r.URL.Path); ok {
		if s.Notes == nil {
			writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
			return
		}
		note, err := s.Notes.GetPublishedBySlug(r.Context(), slug)
		if err != nil {
			if errors.Is(err, notes.ErrNotFound) {
				writeError(w, http.StatusNotFound, "not_found", "note not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
			return
		}
		s.serveIndex(w, r, &note)
		return
	}

	if s.serveAsset(w, r) {
		return
	}
	s.serveIndex(w, r, nil)
}

func (s *StaticRenderer) serveAsset(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.Path == "/" || strings.HasSuffix(r.URL.Path, "/") {
		return false
	}
	relative := filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/"))
	candidate := filepath.Join(s.DistDir, relative)
	cleanDist, err := filepath.Abs(s.DistDir)
	if err != nil {
		return false
	}
	cleanCandidate, err := filepath.Abs(candidate)
	if err != nil {
		return false
	}
	relativeToDist, err := filepath.Rel(cleanDist, cleanCandidate)
	if err != nil || relativeToDist == ".." || strings.HasPrefix(relativeToDist, ".."+string(filepath.Separator)) {
		return false
	}
	info, err := os.Stat(cleanCandidate)
	if err != nil || info.IsDir() {
		return false
	}
	http.ServeFile(w, r, cleanCandidate)
	return true
}

func (s *StaticRenderer) serveIndex(w http.ResponseWriter, r *http.Request, note *notes.Note) {
	index, err := os.ReadFile(filepath.Join(s.DistDir, "index.html"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "frontend_unavailable", "frontend is unavailable")
		return
	}
	content := string(index)
	if note != nil {
		content = injectNoteMetadata(content, *note, s.BaseURL)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(content))
	}
}

func noteSlugFromPath(path string) (string, bool) {
	const prefix = "/notes/"
	if !strings.HasPrefix(path, prefix) {
		return "", false
	}
	rawSlug := strings.TrimPrefix(path, prefix)
	if rawSlug == "" || strings.Contains(rawSlug, "/") {
		return "", false
	}
	slug, err := url.PathUnescape(rawSlug)
	if err != nil || slug == "" {
		return "", false
	}
	return slug, true
}

var descriptionMetaPattern = regexp.MustCompile(`<meta\s+name="description"\s+content="[^"]*"\s*/?>`)

func injectNoteMetadata(index string, note notes.Note, baseURL string) string {
	title := html.EscapeString(note.Title + " — Haystack")
	description := html.EscapeString(note.Excerpt)
	canonical := strings.TrimRight(baseURL, "/") + "/notes/" + url.PathEscape(note.Slug)
	canonicalEscaped := html.EscapeString(canonical)
	metadata := strings.Join([]string{
		`<meta name="description" content="` + description + `">`,
		`<meta property="og:title" content="` + html.EscapeString(note.Title) + `">`,
		`<meta property="og:description" content="` + description + `">`,
		`<meta property="og:type" content="article">`,
		`<meta property="og:url" content="` + canonicalEscaped + `">`,
		`<link rel="canonical" href="` + canonicalEscaped + `">`,
	}, "\n    ")
	index = descriptionMetaPattern.ReplaceAllString(index, `<meta name="description" content="`+description+`">`)
	index = strings.Replace(index, "<!-- HAYSTACK_META -->", metadata, 1)
	return replaceTitle(index, title)
}

func replaceTitle(index, escapedTitle string) string {
	start := strings.Index(index, "<title>")
	if start < 0 {
		return index
	}
	endOffset := strings.Index(index[start:], "</title>")
	if endOffset < 0 {
		return index
	}
	end := start + endOffset + len("</title>")
	return index[:start] + "<title>" + escapedTitle + "</title>" + index[end:]
}
