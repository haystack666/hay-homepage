package db

import (
	"context"
	"path/filepath"
	"testing"
)

func TestOpenRunsMigrationsAndIsIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "haystack.db")
	ctx := context.Background()

	first, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, first); err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}

	second, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = second.Close() })
	if err := Migrate(ctx, second); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := second.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'notes'`,
	).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("notes table count = %d", count)
	}
}

func TestMigrationCreatesForeignKeys(t *testing.T) {
	conn, err := Open(context.Background(), filepath.Join(t.TempDir(), "haystack.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}

	var enabled int
	if err := conn.QueryRowContext(context.Background(), `PRAGMA foreign_keys`).Scan(&enabled); err != nil {
		t.Fatal(err)
	}
	if enabled != 1 {
		t.Fatalf("foreign keys pragma = %d", enabled)
	}
}
