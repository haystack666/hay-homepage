package httpapi

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"hay-homepage/internal/notes"
)

type publicNotesHandler struct {
	service *notes.Service
}

func NewPublicNotesHandler(service *notes.Service) http.Handler {
	return &publicNotesHandler{service: service}
}

type publicNoteListItem struct {
	ID             int64            `json:"id"`
	Slug           string           `json:"slug"`
	Title          string           `json:"title"`
	Excerpt        string           `json:"excerpt"`
	Status         notes.NoteStatus `json:"status"`
	PublishedAt    *time.Time       `json:"publishedAt,omitempty"`
	CreatedAt      time.Time        `json:"createdAt"`
	UpdatedAt      time.Time        `json:"updatedAt"`
	Tags           []notes.Tag      `json:"tags"`
	ReadingMinutes int              `json:"readingMinutes"`
}

type publicNoteNeighbors struct {
	Newer *publicNoteListItem `json:"newer"`
	Older *publicNoteListItem `json:"older"`
}

type publicNoteDetail struct {
	publicNoteListItem
	ContentMarkdown string              `json:"contentMarkdown"`
	Neighbors       publicNoteNeighbors `json:"neighbors"`
}

type publicNoteListResponse struct {
	Items      []publicNoteListItem `json:"items"`
	Page       int                  `json:"page"`
	PageSize   int                  `json:"pageSize"`
	Total      int                  `json:"total"`
	TotalPages int                  `json:"totalPages"`
}

func (h *publicNotesHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}

	const prefix = "/api/notes"
	if r.URL.Path == prefix || r.URL.Path == prefix+"/" {
		h.list(w, r)
		return
	}
	if !strings.HasPrefix(r.URL.Path, prefix+"/") {
		writeError(w, http.StatusNotFound, "not_found", "resource not found")
		return
	}

	rawSlug := strings.TrimPrefix(r.URL.Path, prefix+"/")
	if rawSlug == "" || strings.Contains(rawSlug, "/") {
		writeError(w, http.StatusNotFound, "not_found", "note not found")
		return
	}
	slug, err := url.PathUnescape(rawSlug)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_slug", "invalid note slug")
		return
	}
	h.detail(w, r, slug)
}

func (h *publicNotesHandler) list(w http.ResponseWriter, r *http.Request) {
	page := 1
	if value := r.URL.Query().Get("page"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 {
			writeError(w, http.StatusBadRequest, "invalid_page", "page must be a positive integer")
			return
		}
		page = parsed
	}

	result, err := h.service.ListPublished(r.Context(), r.URL.Query().Get("tag"), page)
	if err != nil {
		writeNotesError(w, err)
		return
	}

	items := make([]publicNoteListItem, 0, len(result.Items))
	for _, note := range result.Items {
		items = append(items, toPublicNoteListItem(note))
	}
	writeJSON(w, http.StatusOK, publicNoteListResponse{
		Items:      items,
		Page:       result.Page,
		PageSize:   result.PageSize,
		Total:      result.Total,
		TotalPages: result.TotalPages,
	})
}

func (h *publicNotesHandler) detail(w http.ResponseWriter, r *http.Request, slug string) {
	note, neighbors, err := h.service.GetPublishedBySlugWithNeighbors(r.Context(), slug)
	if err != nil {
		writeNotesError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, toPublicNoteDetail(note, neighbors))
}

func toPublicNoteListItem(note notes.Note) publicNoteListItem {
	return publicNoteListItem{
		ID:             note.ID,
		Slug:           note.Slug,
		Title:          note.Title,
		Excerpt:        note.Excerpt,
		Status:         note.Status,
		PublishedAt:    note.PublishedAt,
		CreatedAt:      note.CreatedAt,
		UpdatedAt:      note.UpdatedAt,
		Tags:           note.Tags,
		ReadingMinutes: note.ReadingMinutes,
	}
}

func toPublicNoteDetail(note notes.Note, neighbors notes.NoteNeighbors) publicNoteDetail {
	return publicNoteDetail{
		publicNoteListItem: toPublicNoteListItem(note),
		ContentMarkdown:    note.ContentMarkdown,
		Neighbors: publicNoteNeighbors{
			Newer: toPublicNoteListItemPointer(neighbors.Newer),
			Older: toPublicNoteListItemPointer(neighbors.Older),
		},
	}
}

func toPublicNoteListItemPointer(note *notes.Note) *publicNoteListItem {
	if note == nil {
		return nil
	}
	item := toPublicNoteListItem(*note)
	return &item
}

func writeNotesError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, notes.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "note not found")
	case errors.Is(err, notes.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, "invalid_input", "note input is invalid")
	default:
		writeError(w, http.StatusInternalServerError, "internal_error", "an unexpected error occurred")
	}
}
