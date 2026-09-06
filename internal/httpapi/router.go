package httpapi

import (
	"net/http"
	"strings"

	"hay-homepage/internal/auth"
	"hay-homepage/internal/notes"
)

type Dependencies struct {
	Notes   *notes.Service
	Auth    *auth.Manager
	DistDir string
	BaseURL string
}

func NewRouter(deps Dependencies) http.Handler {
	mux := http.NewServeMux()
	publicNotes := NewPublicNotesHandler(deps.Notes)
	adminNotes := protectAdminNotes(deps.Auth, NewAdminNotesHandler(deps.Notes))
	static := &StaticRenderer{DistDir: deps.DistDir, Notes: deps.Notes, BaseURL: deps.BaseURL}

	mux.Handle("/api/notes", publicNotes)
	mux.Handle("/api/notes/", publicNotes)
	mux.Handle("/api/admin/session", NewAuthHandler(deps.Auth))
	mux.Handle("/api/admin/notes", adminNotes)
	mux.Handle("/api/admin/notes/", adminNotes)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, http.MethodGet)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "not_found", "resource not found")
			return
		}
		static.ServeHTTP(w, r)
	})
	return mux
}

func protectAdminNotes(manager *auth.Manager, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			requireSession(manager, next).ServeHTTP(w, r)
			return
		}
		requireWriteProtection(manager, next).ServeHTTP(w, r)
	})
}
