package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"hay-homepage/internal/auth"
)

type authHandler struct {
	manager *auth.Manager
}

func NewAuthHandler(manager *auth.Manager) http.Handler {
	return &authHandler{manager: manager}
}

func (h *authHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/admin/session" {
		writeError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	switch r.Method {
	case http.MethodGet:
		h.current(w, r)
	case http.MethodPost:
		h.login(w, r)
	case http.MethodDelete:
		h.logout(w, r)
	default:
		w.Header().Set("Allow", "GET, POST, DELETE")
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
	}
}

func (h *authHandler) current(w http.ResponseWriter, r *http.Request) {
	if _, err := h.manager.Current(r.Context(), r); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthenticated", "authentication required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
}

func (h *authHandler) login(w http.ResponseWriter, r *http.Request) {
	if err := auth.ValidateOrigin(r); err != nil {
		writeError(w, http.StatusForbidden, "invalid_origin", "request origin is not allowed")
		return
	}
	var input struct {
		Password string `json:"password"`
	}
	decoder := json.NewDecoder(io.LimitReader(r.Body, 16<<10))
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "request body is invalid")
		return
	}
	if input.Password == "" {
		writeError(w, http.StatusBadRequest, "invalid_input", "password is required")
		return
	}
	if err := h.manager.Login(r.Context(), w, input.Password); err != nil {
		if errors.Is(err, auth.ErrUnauthenticated) {
			writeError(w, http.StatusUnauthorized, "unauthenticated", "invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
}

func (h *authHandler) logout(w http.ResponseWriter, r *http.Request) {
	if err := auth.ValidateOrigin(r); err != nil {
		writeError(w, http.StatusForbidden, "invalid_origin", "request origin is not allowed")
		return
	}
	if err := h.manager.ValidateCSRF(r.Context(), r); err != nil {
		writeError(w, http.StatusUnauthorized, "unauthenticated", "authentication required")
		return
	}
	if err := h.manager.Logout(r.Context(), w, r); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
}

func requireSession(manager *auth.Manager, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := manager.Current(r.Context(), r); err != nil {
			writeError(w, http.StatusUnauthorized, "unauthenticated", "authentication required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func requireWriteProtection(manager *auth.Manager, next http.Handler) http.Handler {
	return requireSession(manager, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := auth.ValidateOrigin(r); err != nil {
			writeError(w, http.StatusForbidden, "invalid_origin", "request origin is not allowed")
			return
		}
		if err := manager.ValidateCSRF(r.Context(), r); err != nil {
			writeError(w, http.StatusForbidden, "csrf_failed", "csrf validation failed")
			return
		}
		next.ServeHTTP(w, r)
	}))
}
