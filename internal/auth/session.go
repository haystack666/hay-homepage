package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrSessionExpired  = errors.New("session expired")
	ErrCSRF            = errors.New("csrf validation failed")
	ErrInvalidOrigin   = errors.New("invalid origin")
)

const (
	sessionCookieName = "haystack_session"
	csrfCookieName    = "haystack_csrf"
	csrfHeaderName    = "X-CSRF-Token"
)

type Session struct {
	TokenHash string
	ExpiresAt time.Time
}

type SessionStore interface {
	Create(ctx context.Context, tokenHash string, expiresAt time.Time) error
	Get(ctx context.Context, tokenHash string) (time.Time, error)
	Delete(ctx context.Context, tokenHash string) error
}

type SQLSessionStore struct {
	db *sql.DB
}

func NewSQLSessionStore(db *sql.DB) *SQLSessionStore {
	return &SQLSessionStore{db: db}
}

func (s *SQLSessionStore) Create(ctx context.Context, tokenHash string, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO admin_sessions (token_hash, expires_at)
		VALUES (?, ?)
	`, tokenHash, formatSessionTime(expiresAt))
	if err != nil {
		return fmt.Errorf("create admin session: %w", err)
	}
	return nil
}

func (s *SQLSessionStore) Get(ctx context.Context, tokenHash string) (time.Time, error) {
	var rawExpiresAt string
	err := s.db.QueryRowContext(ctx, `
		SELECT expires_at FROM admin_sessions WHERE token_hash = ?
	`, tokenHash).Scan(&rawExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return time.Time{}, ErrUnauthenticated
	}
	if err != nil {
		return time.Time{}, fmt.Errorf("get admin session: %w", err)
	}
	expiresAt, err := time.Parse(time.RFC3339Nano, rawExpiresAt)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse session expiry: %w", err)
	}
	return expiresAt.UTC(), nil
}

func (s *SQLSessionStore) Delete(ctx context.Context, tokenHash string) error {
	if _, err := s.db.ExecContext(ctx, `DELETE FROM admin_sessions WHERE token_hash = ?`, tokenHash); err != nil {
		return fmt.Errorf("delete admin session: %w", err)
	}
	return nil
}

type Manager struct {
	sessions SessionStore
	verifier *PasswordVerifier
	now      func() time.Time
	ttl      time.Duration
	secure   bool
}

func NewManager(sessions SessionStore, verifier *PasswordVerifier, now func() time.Time, ttl time.Duration, secure bool) *Manager {
	return &Manager{
		sessions: sessions,
		verifier: verifier,
		now:      now,
		ttl:      ttl,
		secure:   secure,
	}
}

func (m *Manager) Login(ctx context.Context, w http.ResponseWriter, password string) error {
	if err := m.verifier.Verify(password); err != nil {
		return ErrUnauthenticated
	}

	rawToken, err := randomToken()
	if err != nil {
		return fmt.Errorf("generate session token: %w", err)
	}
	rawCSRF, err := randomToken()
	if err != nil {
		return fmt.Errorf("generate csrf token: %w", err)
	}
	expiresAt := m.now().UTC().Add(m.ttl)
	if err := m.sessions.Create(ctx, hashToken(rawToken), expiresAt); err != nil {
		return err
	}

	setCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    rawToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   m.secure,
		SameSite: http.SameSiteStrictMode,
		Expires:  expiresAt,
		MaxAge:   maxAge(m.ttl),
	})
	setCookie(w, &http.Cookie{
		Name:     csrfCookieName,
		Value:    rawCSRF,
		Path:     "/",
		HttpOnly: false,
		Secure:   m.secure,
		SameSite: http.SameSiteStrictMode,
		Expires:  expiresAt,
		MaxAge:   maxAge(m.ttl),
	})
	return nil
}

func (m *Manager) Logout(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	session, err := m.Current(ctx, r)
	if err == nil {
		if err := m.sessions.Delete(ctx, session.TokenHash); err != nil {
			return err
		}
	}
	if err != nil && !errors.Is(err, ErrUnauthenticated) && !errors.Is(err, ErrSessionExpired) {
		return err
	}
	clearCookie(w, sessionCookieName, true, m.secure)
	clearCookie(w, csrfCookieName, false, m.secure)
	return nil
}

func (m *Manager) Current(ctx context.Context, r *http.Request) (Session, error) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil || cookie.Value == "" {
		return Session{}, ErrUnauthenticated
	}
	tokenHash := hashToken(cookie.Value)
	expiresAt, err := m.sessions.Get(ctx, tokenHash)
	if err != nil {
		return Session{}, err
	}
	if !m.now().UTC().Before(expiresAt) {
		_ = m.sessions.Delete(ctx, tokenHash)
		return Session{}, ErrSessionExpired
	}
	return Session{TokenHash: tokenHash, ExpiresAt: expiresAt}, nil
}

func (m *Manager) ValidateCSRF(ctx context.Context, r *http.Request) error {
	if _, err := m.Current(ctx, r); err != nil {
		return err
	}
	cookie, err := r.Cookie(csrfCookieName)
	if err != nil || cookie.Value == "" {
		return ErrCSRF
	}
	header := r.Header.Get(csrfHeaderName)
	if header == "" || subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(header)) != 1 {
		return ErrCSRF
	}
	return nil
}

func ValidateOrigin(r *http.Request) error {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return ErrInvalidOrigin
	}
	parsed, err := url.Parse(origin)
	if err != nil || parsed.Host == "" || parsed.Host != r.Host {
		return ErrInvalidOrigin
	}
	return nil
}

func randomToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func hashToken(token string) string {
	digest := sha256.Sum256([]byte(token))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func formatSessionTime(value time.Time) string {
	return value.UTC().Format(time.RFC3339Nano)
}

func maxAge(ttl time.Duration) int {
	seconds := int(ttl / time.Second)
	if seconds < 1 {
		return 1
	}
	return seconds
}

func setCookie(w http.ResponseWriter, cookie *http.Cookie) {
	http.SetCookie(w, cookie)
}

func clearCookie(w http.ResponseWriter, name string, httpOnly, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		HttpOnly: httpOnly,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
	})
}

func IsSameSitePath(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/")
}
