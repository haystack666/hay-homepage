package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"hay-homepage/internal/auth"
	"hay-homepage/internal/db"
)

func newTestAuthHandler(t *testing.T) (http.Handler, *auth.Manager) {
	t.Helper()
	conn, err := db.Open(context.Background(), t.TempDir()+"/http-auth.db")
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
	verifier, err := auth.NewPasswordVerifier(string(hash))
	if err != nil {
		t.Fatal(err)
	}
	manager := auth.NewManager(
		auth.NewSQLSessionStore(conn), verifier,
		time.Now, time.Hour, false,
	)
	return NewAuthHandler(manager), manager
}

func TestLoginAndCurrentSession(t *testing.T) {
	handler, _ := newTestAuthHandler(t)
	login := httptest.NewRequest(http.MethodPost, "/api/admin/session", stringsReader(`{"password":"correct-password"}`))
	login.Host = "example.com"
	login.Header.Set("Origin", "http://example.com")
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login status = %d: %s", loginResponse.Code, loginResponse.Body.String())
	}
	if !json.Valid(loginResponse.Body.Bytes()) {
		t.Fatal("login response is not json")
	}

	current := httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	current.Host = "example.com"
	for _, cookie := range loginResponse.Result().Cookies() {
		current.AddCookie(cookie)
	}
	currentResponse := httptest.NewRecorder()
	handler.ServeHTTP(currentResponse, current)
	if currentResponse.Code != http.StatusOK {
		t.Fatalf("current status = %d", currentResponse.Code)
	}
}

func TestLoginRejectsWrongPasswordWithoutDetails(t *testing.T) {
	handler, _ := newTestAuthHandler(t)
	request := httptest.NewRequest(http.MethodPost, "/api/admin/session", stringsReader(`{"password":"wrong-password"}`))
	request.Host = "example.com"
	request.Header.Set("Origin", "http://example.com")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d", response.Code)
	}
	if response.Body.String() != "{\"error\":{\"code\":\"unauthenticated\",\"message\":\"invalid credentials\"}}\n" {
		t.Fatalf("generic error = %s", response.Body.String())
	}
}

func TestLogoutRequiresCSRFAndClearsSession(t *testing.T) {
	handler, _ := newTestAuthHandler(t)
	login := httptest.NewRequest(http.MethodPost, "/api/admin/session", stringsReader(`{"password":"correct-password"}`))
	login.Host = "example.com"
	login.Header.Set("Origin", "http://example.com")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, login)

	logout := httptest.NewRequest(http.MethodDelete, "/api/admin/session", nil)
	logout.Host = "example.com"
	logout.Header.Set("Origin", "http://example.com")
	var csrf string
	for _, cookie := range loginResponse.Result().Cookies() {
		logout.AddCookie(cookie)
		if cookie.Name == "haystack_csrf" {
			csrf = cookie.Value
		}
	}
	withoutCSRF := httptest.NewRecorder()
	handler.ServeHTTP(withoutCSRF, logout)
	if withoutCSRF.Code != http.StatusUnauthorized {
		t.Fatalf("missing csrf status = %d", withoutCSRF.Code)
	}

	logout.Header.Set("X-CSRF-Token", csrf)
	withCSRF := httptest.NewRecorder()
	handler.ServeHTTP(withCSRF, logout)
	if withCSRF.Code != http.StatusOK {
		t.Fatalf("logout status = %d: %s", withCSRF.Code, withCSRF.Body.String())
	}
}

func stringsReader(value string) *strings.Reader {
	return strings.NewReader(value)
}
