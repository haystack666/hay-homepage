package notes

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"hay-homepage/internal/db"
)

func newTestRepository(t *testing.T) *RepositorySQL {
	t.Helper()
	conn, err := db.Open(context.Background(), filepath.Join(t.TempDir(), "notes.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	return NewRepository(conn)
}

func mustCreate(t *testing.T, repo Repository, input Input) Note {
	t.Helper()
	note, err := repo.Create(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	return note
}

func mustSetStatus(t *testing.T, repo Repository, id int64, status NoteStatus, publishedAt *time.Time) Note {
	t.Helper()
	note, err := repo.SetStatus(context.Background(), id, status, publishedAt)
	if err != nil {
		t.Fatal(err)
	}
	return note
}

func TestListFiltersPublishedNotesByTag(t *testing.T) {
	repo := newTestRepository(t)
	ctx := context.Background()

	mustCreate(t, repo, Input{
		Slug: "private-note", Title: "Private Note", Excerpt: "...",
		ContentMarkdown: "# Private", Tags: []string{"tools"},
	})
	published := mustCreate(t, repo, Input{
		Slug: "public-note", Title: "Public Note", Excerpt: "...",
		ContentMarkdown: "# Public", Tags: []string{"tools"},
	})
	publishedAt := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	published = mustSetStatus(t, repo, published.ID, StatusPublished, &publishedAt)

	result, err := repo.List(ctx, ListFilter{
		Status: StatusPublished, TagSlug: "tools", Page: 1, PageSize: 12,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].ID != published.ID {
		t.Fatalf("unexpected public notes: %+v", result.Items)
	}
	if result.Total != 1 || result.TotalPages != 1 {
		t.Fatalf("unexpected pagination: %+v", result)
	}
}

func TestUpdateReplacesTags(t *testing.T) {
	repo := newTestRepository(t)
	note := mustCreate(t, repo, Input{
		Slug: "tagged-note", Title: "Tagged Note", Excerpt: "...",
		ContentMarkdown: "# Tagged", Tags: []string{"old"},
	})

	updated, err := repo.Update(context.Background(), note.ID, Input{
		Slug: "tagged-note", Title: "Tagged Note", Excerpt: "...",
		ContentMarkdown: "# Updated", Tags: []string{"new", "ideas"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.Tags) != 2 || updated.Tags[0].Slug != "ideas" || updated.Tags[1].Slug != "new" {
		t.Fatalf("unexpected tags: %+v", updated.Tags)
	}

	oldResult, err := repo.List(context.Background(), ListFilter{TagSlug: "old", Page: 1, PageSize: 12})
	if err != nil {
		t.Fatal(err)
	}
	if oldResult.Total != 0 {
		t.Fatalf("old tag still matches: %+v", oldResult)
	}
}

func TestGetPublishedNeighborsFiltersStatusAndUsesIDTieBreak(t *testing.T) {
	repo := newTestRepository(t)
	ctx := context.Background()
	publishedAt := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)

	older := mustCreate(t, repo, Input{
		Slug: "older", Title: "Older", Excerpt: "...", ContentMarkdown: "# Older",
	})
	current := mustCreate(t, repo, Input{
		Slug: "current", Title: "Current", Excerpt: "...", ContentMarkdown: "# Current",
	})
	newer := mustCreate(t, repo, Input{
		Slug: "newer", Title: "Newer", Excerpt: "...", ContentMarkdown: "# Newer",
	})
	archived := mustCreate(t, repo, Input{
		Slug: "archived", Title: "Archived", Excerpt: "...", ContentMarkdown: "# Archived",
	})
	if _, err := repo.SetStatus(ctx, archived.ID, StatusPublished, &publishedAt); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.SetStatus(ctx, archived.ID, StatusArchived, &publishedAt); err != nil {
		t.Fatal(err)
	}
	mustCreate(t, repo, Input{
		Slug: "draft", Title: "Draft", Excerpt: "...", ContentMarkdown: "# Draft",
	})
	for _, note := range []Note{older, current, newer} {
		if _, err := repo.SetStatus(ctx, note.ID, StatusPublished, &publishedAt); err != nil {
			t.Fatal(err)
		}
	}

	neighbors, err := repo.GetPublishedNeighbors(ctx, current.ID)
	if err != nil {
		t.Fatal(err)
	}
	if neighbors.Newer == nil || neighbors.Newer.ID != newer.ID {
		t.Fatalf("newer neighbor = %+v", neighbors.Newer)
	}
	if neighbors.Older == nil || neighbors.Older.ID != older.ID {
		t.Fatalf("older neighbor = %+v", neighbors.Older)
	}
}

func TestGetPublishedBySlugHidesDrafts(t *testing.T) {
	repo := newTestRepository(t)
	note := mustCreate(t, repo, Input{
		Slug: "hidden-note", Title: "Hidden Note", Excerpt: "...",
		ContentMarkdown: "# Hidden", Tags: nil,
	})

	if _, err := repo.GetPublishedBySlug(context.Background(), note.Slug); err != ErrNotFound {
		t.Fatalf("draft lookup error = %v", err)
	}
}

func TestDeleteRemovesNoteAndTagAssociations(t *testing.T) {
	repo := newTestRepository(t)
	note := mustCreate(t, repo, Input{
		Slug: "deleted-note", Title: "Deleted Note", Excerpt: "...",
		ContentMarkdown: "# Deleted", Tags: []string{"cleanup"},
	})

	if err := repo.Delete(context.Background(), note.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetByID(context.Background(), note.ID); err != ErrNotFound {
		t.Fatalf("deleted note lookup error = %v", err)
	}
	result, err := repo.List(context.Background(), ListFilter{TagSlug: "cleanup", Page: 1, PageSize: 12})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 0 {
		t.Fatalf("deleted note still matches tag: %+v", result)
	}
}
