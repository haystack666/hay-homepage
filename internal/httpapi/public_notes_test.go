package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"hay-homepage/internal/db"
	"hay-homepage/internal/notes"
)

func newPublicTestService(t *testing.T) *notes.Service {
	t.Helper()
	conn, err := db.Open(context.Background(), t.TempDir()+"/public.db")
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

func seedPublicNote(t *testing.T, service *notes.Service, input notes.Input) notes.Note {
	t.Helper()
	note, err := service.CreateDraft(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	published, err := service.Publish(context.Background(), note.ID)
	if err != nil {
		t.Fatal(err)
	}
	return published
}

func TestPublicListDoesNotExposeDrafts(t *testing.T) {
	service := newPublicTestService(t)
	seedPublicNote(t, service, notes.Input{
		Slug: "public-note", Title: "Public Note", Excerpt: "Visible note",
		ContentMarkdown: "# Public", Tags: []string{"build"},
	})
	if _, err := service.CreateDraft(context.Background(), notes.Input{
		Slug: "draft-only-slug", Title: "Draft Note", Excerpt: "Private note",
		ContentMarkdown: "# Draft", Tags: []string{"build"},
	}); err != nil {
		t.Fatal(err)
	}

	handler := NewPublicNotesHandler(service)
	request := httptest.NewRequest(http.MethodGet, "/api/notes", nil)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json; charset=utf-8" {
		t.Fatalf("content type = %q", got)
	}
	body := response.Body.String()
	if strings.Contains(body, "draft-only-slug") || strings.Contains(body, "contentMarkdown") {
		t.Fatalf("private fields leaked: %s", body)
	}
	if !strings.Contains(body, "public-note") {
		t.Fatalf("published note missing: %s", body)
	}
}

func TestPublicListFiltersByTagAndRejectsInvalidPage(t *testing.T) {
	service := newPublicTestService(t)
	seedPublicNote(t, service, notes.Input{
		Slug: "build-note", Title: "Build Note", Excerpt: "Build",
		ContentMarkdown: "# Build", Tags: []string{"build"},
	})
	seedPublicNote(t, service, notes.Input{
		Slug: "life-note", Title: "Life Note", Excerpt: "Life",
		ContentMarkdown: "# Life", Tags: []string{"life"},
	})

	handler := NewPublicNotesHandler(service)
	request := httptest.NewRequest(http.MethodGet, "/api/notes?tag=build&page=1", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d", response.Code)
	}
	var result struct {
		Items []struct {
			Slug string `json:"slug"`
		} `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].Slug != "build-note" {
		t.Fatalf("filtered items = %+v", result.Items)
	}

	invalid := httptest.NewRequest(http.MethodGet, "/api/notes?page=nope", nil)
	invalidResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid page status = %d", invalidResponse.Code)
	}
}

func TestPublicDetailReturnsMarkdownAndHidesMissingNotes(t *testing.T) {
	service := newPublicTestService(t)
	seedPublicNote(t, service, notes.Input{
		Slug: "public-detail", Title: "Public Detail", Excerpt: "Detail",
		ContentMarkdown: "# Detail\n\nBody", Tags: []string{"notes"},
	})
	handler := NewPublicNotesHandler(service)

	request := httptest.NewRequest(http.MethodGet, "/api/notes/public-detail", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), "contentMarkdown") {
		t.Fatalf("detail response: %d %s", response.Code, response.Body.String())
	}

	missing := httptest.NewRequest(http.MethodGet, "/api/notes/draft-or-missing", nil)
	missingResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingResponse, missing)
	if missingResponse.Code != http.StatusNotFound {
		t.Fatalf("missing status = %d", missingResponse.Code)
	}

	var detail struct {
		Neighbors struct {
			Newer any `json:"newer"`
			Older any `json:"older"`
		} `json:"neighbors"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Neighbors.Newer != nil || detail.Neighbors.Older != nil {
		t.Fatalf("single note neighbors = %+v", detail.Neighbors)
	}
}

func TestPublicDetailReturnsNeighborsBeyondFirstPage(t *testing.T) {
	service := newPublicTestService(t)
	for index := 1; index <= 14; index++ {
		seedPublicNote(t, service, notes.Input{
			Slug: "note-" + strconv.Itoa(index), Title: "Note " + strconv.Itoa(index),
			Excerpt: "Excerpt", ContentMarkdown: "# Note",
			Tags: []string{"notes"},
		})
	}
	archived := seedPublicNote(t, service, notes.Input{
		Slug: "archived-between", Title: "Archived Between", Excerpt: "Archived",
		ContentMarkdown: "# Archived", Tags: []string{"notes"},
	})
	if _, err := service.Archive(context.Background(), archived.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.CreateDraft(context.Background(), notes.Input{
		Slug: "draft-between", Title: "Draft Between", Excerpt: "Draft",
		ContentMarkdown: "# Draft", Tags: []string{"notes"},
	}); err != nil {
		t.Fatal(err)
	}

	handler := NewPublicNotesHandler(service)
	request := httptest.NewRequest(http.MethodGet, "/api/notes/note-2", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", response.Code, response.Body.String())
	}

	var payload struct {
		Neighbors struct {
			Newer map[string]any `json:"newer"`
			Older map[string]any `json:"older"`
		} `json:"neighbors"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Neighbors.Newer["slug"] != "note-3" || payload.Neighbors.Older["slug"] != "note-1" {
		t.Fatalf("neighbors = %+v", payload.Neighbors)
	}
	if _, ok := payload.Neighbors.Newer["contentMarkdown"]; ok {
		t.Fatal("newer neighbor exposed markdown")
	}
	if _, ok := payload.Neighbors.Older["contentMarkdown"]; ok {
		t.Fatal("older neighbor exposed markdown")
	}
}
