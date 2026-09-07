package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"hay-homepage/internal/db"
)

func newTestManager(t *testing.T, now func() time.Time) *Manager {
	t.Helper()
	conn, err := db.Open(context.Background(), t.TempDir()+"/auth.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := NewPasswordVerifier(string(hash))
	if err != nil {
		t.Fatal(err)
	}
	return NewManager(NewSQLSessionStore(conn), verifier, now, time.Hour, false)
}

func TestLoginSetsSecureSessionAndCSRFCookies(t *testing.T) {
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	manager := newTestManager(t, func() time.Time { return now })
	response := httptest.NewRecorder()

	if err := manager.Login(context.Background(), response, "correct-password"); err != nil {
		t.Fatal(err)
	}

	cookies := response.Result().Cookies()
	sessionCookie := findCookie(cookies, sessionCookieName)
	csrfCookie := findCookie(cookies, csrfCookieName)
	if sessionCookie == nil || csrfCookie == nil {
		t.Fatalf("cookies = %+v", cookies)
	}
	if !sessionCookie.HttpOnly {
		t.Fatal("session cookie must be HttpOnly")
	}
	if csrfCookie.HttpOnly {
		t.Fatal("csrf cookie must be readable by the frontend")
	}
	if sessionCookie.SameSite != http.SameSiteStrictMode || csrfCookie.SameSite != http.SameSiteStrictMode {
		t.Fatal("cookies must use SameSite=Strict")
	}
	if sessionCookie.Value == csrfCookie.Value {
		t.Fatal("session and csrf token must differ")
	}
}

func TestCurrentRejectsExpiredSession(t *testing.T) {
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	current := now
	manager := newTestManager(t, func() time.Time { return current })
	response := httptest.NewRecorder()
	if err := manager.Login(context.Background(), response, "correct-password"); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	for _, cookie := range response.Result().Cookies() {
		request.AddCookie(cookie)
	}
	if _, err := manager.Current(context.Background(), request); err != nil {
		t.Fatal(err)
	}

	current = current.Add(2 * time.Hour)
	if _, err := manager.Current(context.Background(), request); err != ErrSessionExpired {
		t.Fatalf("expired session error = %v", err)
	}
}

func TestValidateCSRFRequiresMatchingCookieAndHeader(t *testing.T) {
	manager := newTestManager(t, time.Now)
	loginResponse := httptest.NewRecorder()
	if err := manager.Login(context.Background(), loginResponse, "correct-password"); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/api/admin/notes", nil)
	request.Host = "example.com"
	request.Header.Set("Origin", "http://example.com")
	var csrf string
	for _, cookie := range loginResponse.Result().Cookies() {
		request.AddCookie(cookie)
		if cookie.Name == csrfCookieName {
			csrf = cookie.Value
		}
	}
	if err := manager.ValidateCSRF(context.Background(), request); err != ErrCSRF {
		t.Fatalf("missing csrf error = %v", err)
	}
	request.Header.Set(csrfHeaderName, csrf)
	if err := manager.ValidateCSRF(context.Background(), request); err != nil {
		t.Fatal(err)
	}
	if err := ValidateOrigin(request); err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Origin", "http://evil.example")
	if err := ValidateOrigin(request); err != ErrInvalidOrigin {
		t.Fatalf("invalid origin error = %v", err)
	}
}

func TestWrongPasswordIsGeneric(t *testing.T) {
	manager := newTestManager(t, time.Now)
	response := httptest.NewRecorder()
	if err := manager.Login(context.Background(), response, "wrong-password"); err != ErrUnauthenticated {
		t.Fatalf("wrong password error = %v", err)
	}
	if len(response.Result().Cookies()) != 0 {
		t.Fatal("wrong password must not set cookies")
	}
}

func findCookie(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}
