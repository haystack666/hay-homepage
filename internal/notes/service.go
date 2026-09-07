package notes

import (
	"context"
	"math"
	"strings"
	"time"
	"unicode"
)

type Service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository, now func() time.Time) *Service {
	return &Service{repo: repo, now: now}
}

func (s *Service) ListPublished(ctx context.Context, tagSlug string, page int) (NoteList, error) {
	result, err := s.repo.List(ctx, ListFilter{
		Status:   StatusPublished,
		TagSlug:  normalizeTagSlug(tagSlug),
		Page:     page,
		PageSize: 12,
	})
	if err != nil {
		return NoteList{}, err
	}
	enrichReadingMinutes(result.Items)
	return result, nil
}

func (s *Service) List(ctx context.Context, status NoteStatus, page int) (NoteList, error) {
	result, err := s.repo.List(ctx, ListFilter{Status: status, Page: page, PageSize: 12})
	if err != nil {
		return NoteList{}, err
	}
	enrichReadingMinutes(result.Items)
	return result, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Note, error) {
	note, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Note{}, err
	}
	note.ReadingMinutes = estimateReadingMinutes(note.ContentMarkdown)
	return note, nil
}

func (s *Service) GetPublishedBySlug(ctx context.Context, slug string) (Note, error) {
	slug = normalizeSlug(slug)
	if slug == "" {
		return Note{}, ErrNotFound
	}
	note, err := s.repo.GetPublishedBySlug(ctx, slug)
	if err != nil {
		return Note{}, err
	}
	note.ReadingMinutes = estimateReadingMinutes(note.ContentMarkdown)
	return note, nil
}

func (s *Service) GetPublishedBySlugWithNeighbors(ctx context.Context, slug string) (Note, NoteNeighbors, error) {
	note, err := s.GetPublishedBySlug(ctx, slug)
	if err != nil {
		return Note{}, NoteNeighbors{}, err
	}
	neighbors, err := s.repo.GetPublishedNeighbors(ctx, note.ID)
	if err != nil {
		return Note{}, NoteNeighbors{}, err
	}
	if neighbors.Newer != nil {
		neighbors.Newer.ReadingMinutes = estimateReadingMinutes(neighbors.Newer.ContentMarkdown)
	}
	if neighbors.Older != nil {
		neighbors.Older.ReadingMinutes = estimateReadingMinutes(neighbors.Older.ContentMarkdown)
	}
	return note, neighbors, nil
}

func (s *Service) CreateDraft(ctx context.Context, input Input) (Note, error) {
	input, err := normalizeInput(input)
	if err != nil {
		return Note{}, err
	}
	note, err := s.repo.Create(ctx, input)
	if err != nil {
		return Note{}, err
	}
	note.ReadingMinutes = estimateReadingMinutes(note.ContentMarkdown)
	return note, nil
}

func (s *Service) Update(ctx context.Context, id int64, input Input) (Note, error) {
	input, err := normalizeInput(input)
	if err != nil {
		return Note{}, err
	}
	note, err := s.repo.Update(ctx, id, input)
	if err != nil {
		return Note{}, err
	}
	note.ReadingMinutes = estimateReadingMinutes(note.ContentMarkdown)
	return note, nil
}

func (s *Service) Publish(ctx context.Context, id int64) (Note, error) {
	note, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Note{}, err
	}
	if note.Status != StatusDraft && note.Status != StatusPublished && note.Status != StatusArchived {
		return Note{}, ErrInvalidTransition
	}
	publishedAt := s.now().UTC()
	published, err := s.repo.SetStatus(ctx, id, StatusPublished, &publishedAt)
	if err != nil {
		return Note{}, err
	}
	published.ReadingMinutes = estimateReadingMinutes(published.ContentMarkdown)
	return published, nil
}

func (s *Service) Archive(ctx context.Context, id int64) (Note, error) {
	note, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return Note{}, err
	}
	if note.Status != StatusPublished {
		return Note{}, ErrInvalidTransition
	}
	archived, err := s.repo.SetStatus(ctx, id, StatusArchived, note.PublishedAt)
	if err != nil {
		return Note{}, err
	}
	archived.ReadingMinutes = estimateReadingMinutes(archived.ContentMarkdown)
	return archived, nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	note, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if note.Status != StatusArchived {
		return ErrInvalidTransition
	}
	return s.repo.Delete(ctx, id)
}

func normalizeInput(input Input) (Input, error) {
	input.Slug = normalizeSlug(input.Slug)
	input.Title = strings.TrimSpace(input.Title)
	input.Excerpt = strings.TrimSpace(input.Excerpt)
	input.ContentMarkdown = strings.TrimSpace(input.ContentMarkdown)
	if input.Slug == "" || input.Title == "" || input.Excerpt == "" || input.ContentMarkdown == "" {
		return Input{}, ErrInvalidInput
	}
	return input, nil
}

func normalizeSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var builder strings.Builder
	separatorPending := false
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			if separatorPending && builder.Len() > 0 {
				builder.WriteByte('-')
			}
			builder.WriteRune(r)
			separatorPending = false
			continue
		}
		if builder.Len() > 0 {
			separatorPending = true
		}
	}
	return strings.Trim(builder.String(), "-")
}

func normalizeTagSlug(value string) string {
	return strings.Trim(strings.ToLower(strings.TrimSpace(value)), "-")
}

func enrichReadingMinutes(items []Note) {
	for index := range items {
		items[index].ReadingMinutes = estimateReadingMinutes(items[index].ContentMarkdown)
	}
}

func estimateReadingMinutes(content string) int {
	visibleRunes := 0
	for _, r := range content {
		if !unicode.IsSpace(r) {
			visibleRunes++
		}
	}
	return int(math.Max(1, math.Ceil(float64(visibleRunes)/500)))
}
