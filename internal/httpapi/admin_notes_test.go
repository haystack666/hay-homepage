package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"hay-homepage/internal/auth"
	"hay-homepage/internal/db"
	"hay-homepage/internal/notes"
)

type adminTestApp struct {
	service *notes.Service
	manager *auth.Manager
	read    http.Handler
	write   http.Handler
}

func newAdminTestApp(t *testing.T) adminTestApp {
	t.Helper()
	conn, err := db.Open(context.Background(), t.TempDir()+"/admin.db")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	if err := db.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	service := notes.NewService(notes.NewRepository(conn), func() time.Time { return now })
	hash, err := bcrypt.GenerateFromPassword([]byte("correct-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	verifier, err := auth.NewPasswordVerifier(string(hash))
	if err != nil {
		t.Fatal(err)
	}
	manager := auth.NewManager(auth.NewSQLSessionStore(conn), verifier, func() time.Time { return now }, time.Hour, false)
	base := NewAdminNotesHandler(service)
	return adminTestApp{
		service: service,
		manager: manager,
		read:    requireSession(manager, base),
		write:   requireWriteProtection(manager, base),
	}
}

func loginAdmin(t *testing.T, app adminTestApp) []*http.Cookie {
	t.Helper()
	response := httptest.NewRecorder()
	if err := app.manager.Login(context.Background(), response, "correct-password"); err != nil {
		t.Fatal(err)
	}
	return response.Result().Cookies()
}

func requestWithCookies(method, target string, body string, cookies []*http.Cookie, write bool) *http.Request {
	request := httptest.NewRequest(method, target, strings.NewReader(body))
	request.Host = "example.com"
	request.Header.Set("Content-Type", "application/json")
	for _, cookie := range cookies {
		request.AddCookie(cookie)
		if write && cookie.Name == "haystack_csrf" {
			request.Header.Set("X-CSRF-Token", cookie.Value)
		}
	}
	if write {
		request.Header.Set("Origin", "http://example.com")
	}
	return request
}

func TestCreateNoteRequiresSessionAndCSRF(t *testing.T) {
	app := newAdminTestApp(t)
	body := `{"slug":"first-note","title":"First Note","excerpt":"A note","contentMarkdown":"# First","tags":["build"]}`

	unauthenticated := httptest.NewRequest(http.MethodPost, "/api/admin/notes", strings.NewReader(body))
	unauthenticated.Header.Set("Content-Type", "application/json")
	unauthenticatedResponse := httptest.NewRecorder()
	app.write.ServeHTTP(unauthenticatedResponse, unauthenticated)
	if unauthenticatedResponse.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status = %d", unauthenticatedResponse.Code)
	}

	cookies := loginAdmin(t, app)
	missingCSRF := requestWithCookies(http.MethodPost, "/api/admin/notes", body, cookies, false)
	missingCSRFResponse := httptest.NewRecorder()
	app.write.ServeHTTP(missingCSRFResponse, missingCSRF)
	if missingCSRFResponse.Code != http.StatusForbidden {
		t.Fatalf("missing csrf status = %d", missingCSRFResponse.Code)
	}

	create := requestWithCookies(http.MethodPost, "/api/admin/notes", body, cookies, true)
	createResponse := httptest.NewRecorder()
	app.write.ServeHTTP(createResponse, create)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", createResponse.Code, createResponse.Body.String())
	}
	var note notes.Note
	if err := json.Unmarshal(createResponse.Body.Bytes(), &note); err != nil {
		t.Fatal(err)
	}
	if note.Status != notes.StatusDraft || note.Slug != "first-note" {
		t.Fatalf("created note = %+v", note)
	}
}

func TestAdminPublishArchiveAndPublicVisibility(t *testing.T) {
	app := newAdminTestApp(t)
	cookies := loginAdmin(t, app)
	create := requestWithCookies(http.MethodPost, "/api/admin/notes", `{"slug":"publish-me","title":"Publish Me","excerpt":"A note","contentMarkdown":"# Publish"}`, cookies, true)
	createResponse := httptest.NewRecorder()
	app.write.ServeHTTP(createResponse, create)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d", createResponse.Code)
	}
	var note notes.Note
	if err := json.Unmarshal(createResponse.Body.Bytes(), &note); err != nil {
		t.Fatal(err)
	}

	publish := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/publish", "", cookies, true)
	publishResponse := httptest.NewRecorder()
	app.write.ServeHTTP(publishResponse, publish)
	if publishResponse.Code != http.StatusOK {
		t.Fatalf("publish status = %d: %s", publishResponse.Code, publishResponse.Body.String())
	}
	if _, err := app.service.GetPublishedBySlug(context.Background(), "publish-me"); err != nil {
		t.Fatalf("published note not public: %v", err)
	}

	archive := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/archive", "", cookies, true)
	archiveResponse := httptest.NewRecorder()
	app.write.ServeHTTP(archiveResponse, archive)
	if archiveResponse.Code != http.StatusOK {
		t.Fatalf("archive status = %d: %s", archiveResponse.Code, archiveResponse.Body.String())
	}
	if _, err := app.service.GetPublishedBySlug(context.Background(), "publish-me"); !errors.Is(err, notes.ErrNotFound) {
		t.Fatalf("archived note public error = %v", err)
	}
}

func TestAdminUpdateAndListStatus(t *testing.T) {
	app := newAdminTestApp(t)
	cookies := loginAdmin(t, app)
	create := requestWithCookies(http.MethodPost, "/api/admin/notes", `{"slug":"editable","title":"Editable","excerpt":"A note","contentMarkdown":"# Editable","tags":["one"]}`, cookies, true)
	createResponse := httptest.NewRecorder()
	app.write.ServeHTTP(createResponse, create)
	var note notes.Note
	if err := json.Unmarshal(createResponse.Body.Bytes(), &note); err != nil {
		t.Fatal(err)
	}

	get := requestWithCookies(http.MethodGet, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10), "", cookies, false)
	getResponse := httptest.NewRecorder()
	app.read.ServeHTTP(getResponse, get)
	if getResponse.Code != http.StatusOK {
		t.Fatalf("get status = %d: %s", getResponse.Code, getResponse.Body.String())
	}
	var fetched notes.Note
	if err := json.Unmarshal(getResponse.Body.Bytes(), &fetched); err != nil {
		t.Fatal(err)
	}
	if fetched.ID != note.ID || fetched.ContentMarkdown != "# Editable" {
		t.Fatalf("fetched note = %+v", fetched)
	}

	update := requestWithCookies(http.MethodPut, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10), `{"slug":"edited","title":"Edited","excerpt":"Updated","contentMarkdown":"# Edited","tags":["two"]}`, cookies, true)
	updateResponse := httptest.NewRecorder()
	app.write.ServeHTTP(updateResponse, update)
	if updateResponse.Code != http.StatusOK {
		t.Fatalf("update status = %d: %s", updateResponse.Code, updateResponse.Body.String())
	}

	list := requestWithCookies(http.MethodGet, "/api/admin/notes?status=draft", "", cookies, false)
	listResponse := httptest.NewRecorder()
	app.read.ServeHTTP(listResponse, list)
	if listResponse.Code != http.StatusOK {
		t.Fatalf("list status = %d", listResponse.Code)
	}
	var result notes.NoteList
	if err := json.Unmarshal(listResponse.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].Slug != "edited" {
		t.Fatalf("list = %+v", result)
	}

	invalid := requestWithCookies(http.MethodPut, "/api/admin/notes/not-a-number", `{}`, cookies, true)
	invalidResponse := httptest.NewRecorder()
	app.write.ServeHTTP(invalidResponse, invalid)
	if invalidResponse.Code != http.StatusBadRequest {
		t.Fatalf("invalid id status = %d", invalidResponse.Code)
	}
}

func TestAdminRepublishAndDeleteArchivedNote(t *testing.T) {
	app := newAdminTestApp(t)
	cookies := loginAdmin(t, app)
	create := requestWithCookies(http.MethodPost, "/api/admin/notes", `{"slug":"lifecycle-note","title":"Lifecycle Note","excerpt":"A note","contentMarkdown":"# Lifecycle"}`, cookies, true)
	createResponse := httptest.NewRecorder()
	app.write.ServeHTTP(createResponse, create)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", createResponse.Code, createResponse.Body.String())
	}
	var note notes.Note
	if err := json.Unmarshal(createResponse.Body.Bytes(), &note); err != nil {
		t.Fatal(err)
	}

	deleteDraft := requestWithCookies(http.MethodDelete, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10), "", cookies, true)
	deleteDraftResponse := httptest.NewRecorder()
	app.write.ServeHTTP(deleteDraftResponse, deleteDraft)
	if deleteDraftResponse.Code != http.StatusBadRequest {
		t.Fatalf("delete draft status = %d: %s", deleteDraftResponse.Code, deleteDraftResponse.Body.String())
	}

	publish := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/publish", "", cookies, true)
	publishResponse := httptest.NewRecorder()
	app.write.ServeHTTP(publishResponse, publish)
	if publishResponse.Code != http.StatusOK {
		t.Fatalf("publish status = %d: %s", publishResponse.Code, publishResponse.Body.String())
	}
	republish := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/publish", "", cookies, true)
	republishResponse := httptest.NewRecorder()
	app.write.ServeHTTP(republishResponse, republish)
	if republishResponse.Code != http.StatusOK {
		t.Fatalf("republish status = %d: %s", republishResponse.Code, republishResponse.Body.String())
	}

	archive := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/archive", "", cookies, true)
	archiveResponse := httptest.NewRecorder()
	app.write.ServeHTTP(archiveResponse, archive)
	if archiveResponse.Code != http.StatusOK {
		t.Fatalf("archive status = %d: %s", archiveResponse.Code, archiveResponse.Body.String())
	}
	republishArchived := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/publish", "", cookies, true)
	republishArchivedResponse := httptest.NewRecorder()
	app.write.ServeHTTP(republishArchivedResponse, republishArchived)
	if republishArchivedResponse.Code != http.StatusOK {
		t.Fatalf("republish archived status = %d: %s", republishArchivedResponse.Code, republishArchivedResponse.Body.String())
	}
	archiveAgain := requestWithCookies(http.MethodPost, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10)+"/archive", "", cookies, true)
	archiveAgainResponse := httptest.NewRecorder()
	app.write.ServeHTTP(archiveAgainResponse, archiveAgain)
	if archiveAgainResponse.Code != http.StatusOK {
		t.Fatalf("archive again status = %d: %s", archiveAgainResponse.Code, archiveAgainResponse.Body.String())
	}

	missingCSRF := requestWithCookies(http.MethodDelete, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10), "", cookies, false)
	missingCSRFResponse := httptest.NewRecorder()
	app.write.ServeHTTP(missingCSRFResponse, missingCSRF)
	if missingCSRFResponse.Code != http.StatusForbidden {
		t.Fatalf("missing csrf delete status = %d", missingCSRFResponse.Code)
	}

	deleteNote := requestWithCookies(http.MethodDelete, "/api/admin/notes/"+strconv.FormatInt(note.ID, 10), "", cookies, true)
	deleteResponse := httptest.NewRecorder()
	app.write.ServeHTTP(deleteResponse, deleteNote)
	if deleteResponse.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d: %s", deleteResponse.Code, deleteResponse.Body.String())
	}
	if _, err := app.service.Get(context.Background(), note.ID); !errors.Is(err, notes.ErrNotFound) {
		t.Fatalf("deleted note lookup error = %v", err)
	}
	if _, err := app.service.GetPublishedBySlug(context.Background(), note.Slug); !errors.Is(err, notes.ErrNotFound) {
		t.Fatalf("deleted public note lookup error = %v", err)
	}
}
