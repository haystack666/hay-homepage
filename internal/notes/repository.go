package notes

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"
)

type RepositorySQL struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *RepositorySQL {
	return &RepositorySQL{db: db}
}

func (r *RepositorySQL) Create(ctx context.Context, input Input) (Note, error) {
	now := time.Now().UTC()
	transaction, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, fmt.Errorf("begin create note: %w", err)
	}
	result, err := transaction.ExecContext(ctx, `
		INSERT INTO notes (slug, title, excerpt, content_markdown, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, input.Slug, input.Title, input.Excerpt, input.ContentMarkdown, StatusDraft, formatTime(now), formatTime(now))
	if err != nil {
		_ = transaction.Rollback()
		if isUniqueViolation(err) {
			return Note{}, ErrSlugTaken
		}
		return Note{}, fmt.Errorf("insert note: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		_ = transaction.Rollback()
		return Note{}, fmt.Errorf("read note id: %w", err)
	}
	if err := syncTags(ctx, transaction, id, input.Tags); err != nil {
		_ = transaction.Rollback()
		return Note{}, err
	}
	if err := transaction.Commit(); err != nil {
		return Note{}, fmt.Errorf("commit note: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *RepositorySQL) GetByID(ctx context.Context, id int64) (Note, error) {
	return r.getOne(ctx, `
		SELECT id, slug, title, excerpt, content_markdown, status, published_at, created_at, updated_at
		FROM notes WHERE id = ?
	`, id)
}

func (r *RepositorySQL) GetPublishedBySlug(ctx context.Context, slug string) (Note, error) {
	return r.getOne(ctx, `
		SELECT id, slug, title, excerpt, content_markdown, status, published_at, created_at, updated_at
		FROM notes WHERE slug = ? AND status = ?
	`, slug, StatusPublished)
}

func (r *RepositorySQL) List(ctx context.Context, filter ListFilter) (NoteList, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	pageSize := filter.PageSize
	if pageSize < 1 {
		pageSize = 12
	}
	if pageSize > 100 {
		pageSize = 100
	}

	joins, where, args := listClauses(filter)
	var total int
	countQuery := `SELECT COUNT(DISTINCT n.id) FROM notes n ` + joins + ` WHERE ` + strings.Join(where, " AND ")
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return NoteList{}, fmt.Errorf("count notes: %w", err)
	}

	listArgs := append([]any{}, args...)
	listArgs = append(listArgs, pageSize, (page-1)*pageSize)
	query := `
		SELECT DISTINCT n.id, n.slug, n.title, n.excerpt, n.content_markdown,
			n.status, n.published_at, n.created_at, n.updated_at
		FROM notes n ` + joins + `
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY CASE WHEN n.status = 'published' THEN n.published_at ELSE n.updated_at END DESC, n.id DESC
		LIMIT ? OFFSET ?
	`
	rows, err := r.db.QueryContext(ctx, query, listArgs...)
	if err != nil {
		return NoteList{}, fmt.Errorf("list notes: %w", err)
	}
	items := make([]Note, 0, pageSize)
	for rows.Next() {
		note, err := scanNote(rows)
		if err != nil {
			return NoteList{}, err
		}
		items = append(items, note)
	}
	if err := rows.Err(); err != nil {
		return NoteList{}, fmt.Errorf("iterate notes: %w", err)
	}
	if err := rows.Close(); err != nil {
		return NoteList{}, fmt.Errorf("close notes: %w", err)
	}
	for index := range items {
		items[index].Tags, err = r.tags(ctx, items[index].ID)
		if err != nil {
			return NoteList{}, err
		}
	}

	return NoteList{
		Items:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: int(math.Ceil(float64(total) / float64(pageSize))),
	}, nil
}

func (r *RepositorySQL) GetPublishedNeighbors(ctx context.Context, noteID int64) (NoteNeighbors, error) {
	newer, err := r.getNeighbor(ctx, `
		SELECT n.id, n.slug, n.title, n.excerpt, n.content_markdown,
			n.status, n.published_at, n.created_at, n.updated_at
		FROM notes current
		JOIN notes n ON n.status = ? AND n.published_at IS NOT NULL
		WHERE current.id = ?
			AND current.status = ?
			AND current.published_at IS NOT NULL
			AND (
				n.published_at > current.published_at
				OR (n.published_at = current.published_at AND n.id > current.id)
			)
		ORDER BY n.published_at ASC, n.id ASC
		LIMIT 1
	`, StatusPublished, noteID, StatusPublished)
	if err != nil {
		return NoteNeighbors{}, fmt.Errorf("find newer note: %w", err)
	}
	older, err := r.getNeighbor(ctx, `
		SELECT n.id, n.slug, n.title, n.excerpt, n.content_markdown,
			n.status, n.published_at, n.created_at, n.updated_at
		FROM notes current
		JOIN notes n ON n.status = ? AND n.published_at IS NOT NULL
		WHERE current.id = ?
			AND current.status = ?
			AND current.published_at IS NOT NULL
			AND (
				n.published_at < current.published_at
				OR (n.published_at = current.published_at AND n.id < current.id)
			)
		ORDER BY n.published_at DESC, n.id DESC
		LIMIT 1
	`, StatusPublished, noteID, StatusPublished)
	if err != nil {
		return NoteNeighbors{}, fmt.Errorf("find older note: %w", err)
	}
	return NoteNeighbors{Newer: newer, Older: older}, nil
}

func (r *RepositorySQL) Update(ctx context.Context, id int64, input Input) (Note, error) {
	transaction, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Note{}, fmt.Errorf("begin update note: %w", err)
	}
	result, err := transaction.ExecContext(ctx, `
		UPDATE notes
		SET slug = ?, title = ?, excerpt = ?, content_markdown = ?, updated_at = ?
		WHERE id = ?
	`, input.Slug, input.Title, input.Excerpt, input.ContentMarkdown, formatTime(time.Now().UTC()), id)
	if err != nil {
		_ = transaction.Rollback()
		if isUniqueViolation(err) {
			return Note{}, ErrSlugTaken
		}
		return Note{}, fmt.Errorf("update note: %w", err)
	}
	updated, err := result.RowsAffected()
	if err != nil {
		_ = transaction.Rollback()
		return Note{}, fmt.Errorf("read update count: %w", err)
	}
	if updated == 0 {
		_ = transaction.Rollback()
		return Note{}, ErrNotFound
	}
	if err := syncTags(ctx, transaction, id, input.Tags); err != nil {
		_ = transaction.Rollback()
		return Note{}, err
	}
	if err := transaction.Commit(); err != nil {
		return Note{}, fmt.Errorf("commit note update: %w", err)
	}
	return r.GetByID(ctx, id)
}

func (r *RepositorySQL) Delete(ctx context.Context, id int64) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM notes WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete note: %w", err)
	}
	deleted, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read delete count: %w", err)
	}
	if deleted == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *RepositorySQL) SetStatus(ctx context.Context, id int64, status NoteStatus, publishedAt *time.Time) (Note, error) {
	if status != StatusDraft && status != StatusPublished && status != StatusArchived {
		return Note{}, ErrInvalidStatus
	}
	var publishedValue any
	if publishedAt != nil {
		publishedValue = formatTime(*publishedAt)
	}
	result, err := r.db.ExecContext(ctx, `
		UPDATE notes SET status = ?, published_at = ?, updated_at = ? WHERE id = ?
	`, status, publishedValue, formatTime(time.Now().UTC()), id)
	if err != nil {
		return Note{}, fmt.Errorf("set note status: %w", err)
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return Note{}, fmt.Errorf("read status update count: %w", err)
	}
	if updated == 0 {
		return Note{}, ErrNotFound
	}
	return r.GetByID(ctx, id)
}

func (r *RepositorySQL) getNeighbor(ctx context.Context, query string, args ...any) (*Note, error) {
	row := r.db.QueryRowContext(ctx, query, args...)
	note, err := scanNote(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("scan neighboring note: %w", err)
	}
	note.Tags, err = r.tags(ctx, note.ID)
	if err != nil {
		return nil, err
	}
	return &note, nil
}

func (r *RepositorySQL) getOne(ctx context.Context, query string, args ...any) (Note, error) {
	row := r.db.QueryRowContext(ctx, query, args...)
	note, err := scanNote(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Note{}, ErrNotFound
	}
	if err != nil {
		return Note{}, fmt.Errorf("scan note: %w", err)
	}
	note.Tags, err = r.tags(ctx, note.ID)
	if err != nil {
		return Note{}, err
	}
	return note, nil
}

func (r *RepositorySQL) tags(ctx context.Context, noteID int64) ([]Tag, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.name, t.slug
		FROM tags t JOIN note_tags nt ON nt.tag_id = t.id
		WHERE nt.note_id = ?
		ORDER BY t.slug
	`, noteID)
	if err != nil {
		return nil, fmt.Errorf("list note tags: %w", err)
	}
	defer rows.Close()

	tags := make([]Tag, 0)
	for rows.Next() {
		var tag Tag
		if err := rows.Scan(&tag.Name, &tag.Slug); err != nil {
			return nil, fmt.Errorf("scan note tag: %w", err)
		}
		tags = append(tags, tag)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate note tags: %w", err)
	}
	return tags, nil
}

func listClauses(filter ListFilter) (string, []string, []any) {
	joins := ""
	where := []string{"1 = 1"}
	args := make([]any, 0, 2)
	if filter.Status != "" {
		where = append(where, "n.status = ?")
		args = append(args, filter.Status)
	}
	if filter.TagSlug != "" {
		joins = "JOIN note_tags nt ON nt.note_id = n.id JOIN tags t ON t.id = nt.tag_id"
		where = append(where, "t.slug = ?")
		args = append(args, filter.TagSlug)
	}
	return joins, where, args
}

func syncTags(ctx context.Context, transaction *sql.Tx, noteID int64, rawTags []string) error {
	if _, err := transaction.ExecContext(ctx, `DELETE FROM note_tags WHERE note_id = ?`, noteID); err != nil {
		return fmt.Errorf("clear note tags: %w", err)
	}
	seen := make(map[string]struct{}, len(rawTags))
	for _, raw := range rawTags {
		name := strings.TrimSpace(raw)
		slug := tagSlug(name)
		if slug == "" {
			continue
		}
		if _, exists := seen[slug]; exists {
			continue
		}
		seen[slug] = struct{}{}
		if _, err := transaction.ExecContext(ctx, `
			INSERT INTO tags(name, slug) VALUES (?, ?)
			ON CONFLICT(slug) DO UPDATE SET name = excluded.name
		`, name, slug); err != nil {
			return fmt.Errorf("upsert note tag: %w", err)
		}
		var tagID int64
		if err := transaction.QueryRowContext(ctx, `SELECT id FROM tags WHERE slug = ?`, slug).Scan(&tagID); err != nil {
			return fmt.Errorf("read note tag: %w", err)
		}
		if _, err := transaction.ExecContext(ctx, `
			INSERT OR IGNORE INTO note_tags(note_id, tag_id) VALUES (?, ?)
		`, noteID, tagID); err != nil {
			return fmt.Errorf("link note tag: %w", err)
		}
	}
	return nil
}

var tagSeparator = regexp.MustCompile(`[^\pL\pN]+`)

func tagSlug(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = tagSeparator.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	return value
}

func scanNote(scanner interface{ Scan(...any) error }) (Note, error) {
	var note Note
	var status string
	var publishedAt sql.NullString
	var createdAt, updatedAt string
	if err := scanner.Scan(
		&note.ID, &note.Slug, &note.Title, &note.Excerpt, &note.ContentMarkdown,
		&status, &publishedAt, &createdAt, &updatedAt,
	); err != nil {
		return Note{}, err
	}
	note.Status = NoteStatus(status)
	var err error
	if publishedAt.Valid {
		note.PublishedAt, err = parseOptionalTime(publishedAt.String)
		if err != nil {
			return Note{}, fmt.Errorf("parse published time: %w", err)
		}
	}
	if note.CreatedAt, err = parseTime(createdAt); err != nil {
		return Note{}, fmt.Errorf("parse created time: %w", err)
	}
	if note.UpdatedAt, err = parseTime(updatedAt); err != nil {
		return Note{}, fmt.Errorf("parse updated time: %w", err)
	}
	return note, nil
}

func formatTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func parseOptionalTime(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	parsed, err := parseTime(value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func parseTime(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05", "2006-01-02 15:04:05.999999999"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported timestamp %q", value)
}

func isUniqueViolation(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "constraint")
}
