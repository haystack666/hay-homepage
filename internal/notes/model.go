package notes

import (
	"context"
	"errors"
	"time"
)

type NoteStatus string

const (
	StatusDraft     NoteStatus = "draft"
	StatusPublished NoteStatus = "published"
	StatusArchived  NoteStatus = "archived"
)

type Tag struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type Note struct {
	ID              int64      `json:"id"`
	Slug            string     `json:"slug"`
	Title           string     `json:"title"`
	Excerpt         string     `json:"excerpt"`
	ContentMarkdown string     `json:"contentMarkdown"`
	Status          NoteStatus `json:"status"`
	PublishedAt     *time.Time `json:"publishedAt,omitempty"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	Tags            []Tag      `json:"tags"`
	ReadingMinutes  int        `json:"readingMinutes"`
}

type Input struct {
	Slug            string
	Title           string
	Excerpt         string
	ContentMarkdown string
	Tags            []string
}

type ListFilter struct {
	Status   NoteStatus
	TagSlug  string
	Page     int
	PageSize int
}

type NoteList struct {
	Items      []Note `json:"items"`
	Page       int    `json:"page"`
	PageSize   int    `json:"pageSize"`
	Total      int    `json:"total"`
	TotalPages int    `json:"totalPages"`
}

type NoteNeighbors struct {
	Newer *Note
	Older *Note
}

var (
	ErrNotFound          = errors.New("note not found")
	ErrSlugTaken         = errors.New("note slug already exists")
	ErrInvalidStatus     = errors.New("invalid note status")
	ErrInvalidTransition = errors.New("invalid note status transition")
	ErrInvalidInput      = errors.New("invalid note input")
)

type Repository interface {
	Create(ctx context.Context, input Input) (Note, error)
	GetByID(ctx context.Context, id int64) (Note, error)
	GetPublishedBySlug(ctx context.Context, slug string) (Note, error)
	GetPublishedNeighbors(ctx context.Context, noteID int64) (NoteNeighbors, error)
	List(ctx context.Context, filter ListFilter) (NoteList, error)
	Update(ctx context.Context, id int64, input Input) (Note, error)
	SetStatus(ctx context.Context, id int64, status NoteStatus, publishedAt *time.Time) (Note, error)
	Delete(ctx context.Context, id int64) error
}
