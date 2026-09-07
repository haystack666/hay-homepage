package notes

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func newTestService(t *testing.T, now func() time.Time) *Service {
	t.Helper()
	return NewService(newTestRepository(t), now)
}

func TestPublishSetsPublishedAtAndAllowsPublicRead(t *testing.T) {
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	service := newTestService(t, func() time.Time { return now })
	draft, err := service.CreateDraft(context.Background(), Input{
		Slug: "useful-things", Title: "Useful Things", Excerpt: "A note.",
		ContentMarkdown: strings.Repeat("word ", 120), Tags: []string{"build"},
	})
	if err != nil {
		t.Fatal(err)
	}

	published, err := service.Publish(context.Background(), draft.ID)
	if err != nil {
		t.Fatal(err)
	}
	if published.Status != StatusPublished {
		t.Fatalf("status = %s", published.Status)
	}
	if published.PublishedAt == nil || !published.PublishedAt.Equal(now) {
		t.Fatalf("publishedAt = %v", published.PublishedAt)
	}

	public, err := service.GetPublishedBySlug(context.Background(), draft.Slug)
	if err != nil {
		t.Fatal(err)
	}
	if public.ReadingMinutes < 1 {
		t.Fatal("reading time must be positive")
	}
}

func TestCreateDraftNormalizesSlug(t *testing.T) {
	service := newTestService(t, time.Now)
	note, err := service.CreateDraft(context.Background(), Input{
		Slug: "  Useful Things / Today  ", Title: "Useful Things", Excerpt: "A note.",
		ContentMarkdown: "# Useful", Tags: nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	if note.Slug != "useful-things-today" {
		t.Fatalf("slug = %q", note.Slug)
	}
}

func TestCreateDraftRejectsDuplicateSlug(t *testing.T) {
	service := newTestService(t, time.Now)
	input := Input{Slug: "same", Title: "Same", Excerpt: "A note.", ContentMarkdown: "# Same"}
	if _, err := service.CreateDraft(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if _, err := service.CreateDraft(context.Background(), input); !errors.Is(err, ErrSlugTaken) {
		t.Fatalf("duplicate error = %v", err)
	}
}

func TestArchiveRejectsDraftAndRepublishAllowsArchived(t *testing.T) {
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	service := newTestService(t, func() time.Time { return now })
	note, err := service.CreateDraft(context.Background(), Input{
		Slug: "stateful", Title: "Stateful", Excerpt: "A note.", ContentMarkdown: "# Stateful",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Archive(context.Background(), note.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("archive draft error = %v", err)
	}
	if _, err := service.Publish(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Archive(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	published, err := service.Publish(context.Background(), note.ID)
	if err != nil {
		t.Fatal(err)
	}
	if published.Status != StatusPublished {
		t.Fatalf("status = %s", published.Status)
	}
}

func TestGetPublishedBySlugWithNeighborsEnrichesReadingMinutes(t *testing.T) {
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	service := newTestService(t, func() time.Time { return now })
	older, err := service.CreateDraft(context.Background(), Input{
		Slug: "older", Title: "Older", Excerpt: "...", ContentMarkdown: "# Older",
	})
	if err != nil {
		t.Fatal(err)
	}
	current, err := service.CreateDraft(context.Background(), Input{
		Slug: "current", Title: "Current", Excerpt: "...", ContentMarkdown: "# Current",
	})
	if err != nil {
		t.Fatal(err)
	}
	newer, err := service.CreateDraft(context.Background(), Input{
		Slug: "newer", Title: "Newer", Excerpt: "...", ContentMarkdown: strings.Repeat("x", 501),
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, note := range []Note{older, current, newer} {
		if _, err := service.Publish(context.Background(), note.ID); err != nil {
			t.Fatal(err)
		}
	}

	loaded, neighbors, err := service.GetPublishedBySlugWithNeighbors(context.Background(), current.Slug)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ID != current.ID || loaded.ReadingMinutes != 1 {
		t.Fatalf("loaded note = %+v", loaded)
	}
	if neighbors.Newer == nil || neighbors.Newer.ID != newer.ID || neighbors.Newer.ReadingMinutes != 2 {
		t.Fatalf("newer neighbor = %+v", neighbors.Newer)
	}
	if neighbors.Older == nil || neighbors.Older.ID != older.ID || neighbors.Older.ReadingMinutes != 1 {
		t.Fatalf("older neighbor = %+v", neighbors.Older)
	}
}

func TestListPublishedUsesDefaultPageSize(t *testing.T) {
	service := newTestService(t, time.Now)
	result, err := service.ListPublished(context.Background(), "", 0)
	if err != nil {
		t.Fatal(err)
	}
	if result.Page != 1 || result.PageSize != 12 {
		t.Fatalf("pagination = %+v", result)
	}
}

func TestPublishAllowsRepublishingPublishedNote(t *testing.T) {
	firstPublishedAt := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	secondPublishedAt := firstPublishedAt.Add(time.Hour)
	currentTime := firstPublishedAt
	service := newTestService(t, func() time.Time { return currentTime })
	note, err := service.CreateDraft(context.Background(), Input{
		Slug: "republishable", Title: "Republishable", Excerpt: "A note.", ContentMarkdown: "# Note",
	})
	if err != nil {
		t.Fatal(err)
	}
	published, err := service.Publish(context.Background(), note.ID)
	if err != nil {
		t.Fatal(err)
	}
	currentTime = secondPublishedAt
	republished, err := service.Publish(context.Background(), published.ID)
	if err != nil {
		t.Fatal(err)
	}
	if republished.Status != StatusPublished || republished.PublishedAt == nil || !republished.PublishedAt.Equal(secondPublishedAt) {
		t.Fatalf("republished note = %+v", republished)
	}
}

func TestDeleteOnlyAllowsArchivedNotes(t *testing.T) {
	service := newTestService(t, time.Now)
	note, err := service.CreateDraft(context.Background(), Input{
		Slug: "deletable", Title: "Deletable", Excerpt: "A note.", ContentMarkdown: "# Note",
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Delete(context.Background(), note.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("delete draft error = %v", err)
	}
	if _, err := service.Publish(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.Delete(context.Background(), note.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("delete published error = %v", err)
	}
	if _, err := service.Archive(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	if err := service.Delete(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Get(context.Background(), note.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted note lookup error = %v", err)
	}
}
