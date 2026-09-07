package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"hay-homepage/internal/notes"
)

type adminNotesHandler struct {
	service *notes.Service
}

func NewAdminNotesHandler(service *notes.Service) http.Handler {
	return &adminNotesHandler{service: service}
}

type noteInputRequest struct {
	Slug            string   `json:"slug"`
	Title           string   `json:"title"`
	Excerpt         string   `json:"excerpt"`
	ContentMarkdown string   `json:"contentMarkdown"`
	Tags            []string `json:"tags"`
}

func (h *adminNotesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	const prefix = "/api/admin/notes"
	if r.URL.Path == prefix || r.URL.Path == prefix+"/" {
		switch r.Method {
		case http.MethodGet:
			h.list(w, r)
		case http.MethodPost:
			h.create(w, r)
		default:
			methodNotAllowed(w, http.MethodGet, http.MethodPost)
		}
		return
	}
	if !strings.HasPrefix(r.URL.Path, prefix+"/") {
		writeError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}

	segments := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, prefix+"/"), "/"), "/")
	if len(segments) == 0 || segments[0] == "" {
		writeError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}
	id, err := strconv.ParseInt(segments[0], 10, 64)
	if err != nil || id < 1 {
		writeError(w, http.StatusBadRequest, "invalid_id", "note id must be a positive integer")
		return
	}
	if len(segments) == 1 {
		switch r.Method {
		case http.MethodGet:
			h.get(w, r, id)
		case http.MethodPut:
			h.update(w, r, id)
		case http.MethodDelete:
			h.remove(w, r, id)
		default:
			methodNotAllowed(w, http.MethodGet, http.MethodPut, http.MethodDelete)
		}
		return
	}
	if len(segments) == 2 && r.Method == http.MethodPost {
		switch segments[1] {
		case "publish":
			h.publish(w, r, id)
		case "archive":
			h.archive(w, r, id)
		default:
			writeError(w, http.StatusNotFound, "not_found", "resource not found")
		}
		return
	}
	writeError(w, http.StatusNotFound, "not_found", "resource not found")
}

func (h *adminNotesHandler) list(w http.ResponseWriter, r *http.Request) {
	status := notes.NoteStatus(r.URL.Query().Get("status"))
	if status != "" && status != notes.StatusDraft && status != notes.StatusPublished && status != notes.StatusArchived {
		writeError(w, http.StatusBadRequest, "invalid_status", "status is invalid")
		return
	}
	page := 1
	if rawPage := r.URL.Query().Get("page"); rawPage != "" {
		parsed, err := strconv.Atoi(rawPage)
		if err != nil || parsed < 1 {
			writeError(w, http.StatusBadRequest, "invalid_page", "page must be a positive integer")
			return
		}
		page = parsed
	}
	result, err := h.service.List(r.Context(), status, page)
	if err != nil {
		writeNotesError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *adminNotesHandler) create(w http.ResponseWriter, r *http.Request) {
	input, err := decodeNoteInput(r)
	if err != nil {
		writeInputError(w, err)
		return
	}
	note, err := h.service.CreateDraft(r.Context(), input)
	if err != nil {
		writeNotesManagementError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, note)
}

func (h *adminNotesHandler) get(w http.ResponseWriter, r *http.Request, id int64) {
	note, err := h.service.Get(r.Context(), id)
	if err != nil {
		writeNotesManagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (h *adminNotesHandler) update(w http.ResponseWriter, r *http.Request, id int64) {
	input, err := decodeNoteInput(r)
	if err != nil {
		writeInputError(w, err)
		return
	}
	note, err := h.service.Update(r.Context(), id, input)
	if err != nil {
		writeNotesManagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (h *adminNotesHandler) publish(w http.ResponseWriter, r *http.Request, id int64) {
	note, err := h.service.Publish(r.Context(), id)
	if err != nil {
		writeNotesManagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (h *adminNotesHandler) archive(w http.ResponseWriter, r *http.Request, id int64) {
	note, err := h.service.Archive(r.Context(), id)
	if err != nil {
		writeNotesManagementError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, note)
}

func (h *adminNotesHandler) remove(w http.ResponseWriter, r *http.Request, id int64) {
	if err := h.service.Delete(r.Context(), id); err != nil {
		writeNotesManagementError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeNoteInput(r *http.Request) (notes.Input, error) {
	var input noteInputRequest
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return notes.Input{}, err
	}
	return notes.Input{
		Slug:            input.Slug,
		Title:           input.Title,
		Excerpt:         input.Excerpt,
		ContentMarkdown: input.ContentMarkdown,
		Tags:            input.Tags,
	}, nil
}

func writeInputError(w http.ResponseWriter, err error) {
	if errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "invalid_json", "request body is required")
		return
	}
	writeError(w, http.StatusBadRequest, "invalid_json", "request body is invalid")
}

func writeNotesManagementError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, notes.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "note not found")
	case errors.Is(err, notes.ErrSlugTaken):
		writeError(w, http.StatusConflict, "slug_taken", "note slug is already in use")
	case errors.Is(err, notes.ErrInvalidInput), errors.Is(err, notes.ErrInvalidTransition), errors.Is(err, notes.ErrInvalidStatus):
		writeError(w, http.StatusBadRequest, "invalid_note", "note cannot be changed as requested")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
	}
}

func methodNotAllowed(w http.ResponseWriter, methods ...string) {
	w.Header().Set("Allow", strings.Join(methods, ", "))
	writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
}
