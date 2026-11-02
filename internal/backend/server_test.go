package backend

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
)

func ptr(s string) *string { return &s }

func testServer(t *testing.T, upstream http.HandlerFunc) (*server, http.Handler) {
	t.Helper()
	remote := httptest.NewServer(upstream)
	t.Cleanup(remote.Close)
	store, err := openStore(filepath.Join(t.TempDir(), "db.json"))
	if err != nil {
		t.Fatal(err)
	}
	s := &server{
		cfg: config{clientID: "client", clientSecret: "secret", redirectURL: "https://app.example/get_token",
			adminLogin: "admin", adminPassword: "admin-password", tgToken: "bot-secret", deployURL: "https://app.example",
			accountsURL: remote.URL, spotifyURL: remote.URL, telegramURL: remote.URL, webDir: t.TempDir()},
		store: store, client: remote.Client(), log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	s.client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	return s, s.handler()
}

func request(h http.Handler, method, path, body, name, password string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if name != "" {
		r.SetBasicAuth(name, password)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func seed(t *testing.T, s *server, id, token string) user {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword(tokenBytes(token), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	u := user{publicUser: publicUser{UserID: id, CreatedAt: "2026-01-01 00:00:00+00:00", FilterDislikes: true}, RefreshToken: token, RefreshTokenHash: string(hash)}
	if err := s.store.create(u); err != nil {
		t.Fatal(err)
	}
	return u
}

func requireStatus(t *testing.T, w *httptest.ResponseRecorder, status int) {
	t.Helper()
	if w.Code != status {
		t.Fatalf("status = %d, want %d; body = %s", w.Code, status, w.Body.String())
	}
}

func TestAuthenticationAndSelfAccess(t *testing.T) {
	s, h := testServer(t, http.NotFound)
	seed(t, s, "alice", "alice-secret")
	seed(t, s, "bob", "bob-secret")
	for _, tc := range []struct {
		method, path, body, name, password string
		status                             int
	}{
		{"GET", "/api/user?user_id=alice", "", "", "", 401},
		{"GET", "/api/user?user_id=alice", "", "alice", "wrong", 401},
		{"GET", "/api/user?user_id=bob", "", "alice", "alice-secret", 403},
		{"PUT", "/api/update_user?user_id=bob", `{"send_mail":true}`, "alice", "alice-secret", 403},
		{"GET", "/api/user", "", "alice", "alice-secret", 422},
		{"GET", "/api/user?user_id=alice", "", "alice", "alice-secret", 200},
		{"GET", "/api/users", "", "alice", "alice-secret", 401},
		{"GET", "/api/users", "", "admin", "admin-password", 200},
		{"DELETE", "/api/delete_user?user_id=bob", "", "alice", "alice-secret", 401},
	} {
		t.Run(tc.method+tc.path+tc.name+tc.password, func(t *testing.T) {
			w := request(h, tc.method, tc.path, tc.body, tc.name, tc.password)
			requireStatus(t, w, tc.status)
			if tc.status == 200 {
				for _, secret := range []string{"refresh_token", "alice-secret", "bob-secret", "$2"} {
					if strings.Contains(w.Body.String(), secret) {
						t.Fatalf("public response contains %q", secret)
					}
				}
			}
		})
	}
}

func TestCreateUpdateDeleteAndReopen(t *testing.T) {
	s, h := testServer(t, http.NotFound)
	body := `{"user_id":"alice","is_premium":false,"refresh_token_hash":"token","tg_chat_id":"123","send_time":"1973-01-06T14:30:00Z"}`
	w := request(h, "POST", "/api/new_user", body, "", "")
	requireStatus(t, w, 200)
	if strings.Contains(w.Body.String(), "refresh_token") {
		t.Fatal("credentials exposed")
	}
	u, ok := s.store.get("alice")
	if !ok || !u.FilterDislikes || !matchesToken(u, "token") {
		t.Fatal("bad user defaults or hash")
	}
	requireStatus(t, request(h, "POST", "/api/new_user", body, "", ""), 400)
	w = request(h, "PUT", "/api/update_user?user_id=alice", `{"send_mail":true,"email":"","custom_pl_description_pattern":"{year}","refresh_token":"new-token","user_id":"bob"}`, "alice", "token")
	requireStatus(t, w, 200)
	if strings.Contains(w.Body.String(), "refresh_token") {
		t.Fatal("update exposed token")
	}
	u, _ = s.store.get("alice")
	if !u.SendMail || *u.CustomPLDescriptionPattern != "{year}" || u.RefreshToken != "new-token" || !matchesToken(u, "new-token") || matchesToken(u, "token") {
		t.Fatal("update did not rotate auth and preserve fields")
	}
	reopened, err := openStore(s.store.path)
	if err != nil {
		t.Fatal(err)
	}
	u, ok = reopened.get("alice")
	if !ok || *u.TGChatID != "123" || !matchesToken(u, "new-token") {
		t.Fatal("update not persisted")
	}
	requireStatus(t, request(h, "DELETE", "/api/delete_user?user_id=alice", "", "admin", "admin-password"), 200)
	requireStatus(t, request(h, "DELETE", "/api/delete_user?user_id=alice", "", "admin", "admin-password"), 202)
	requireStatus(t, request(h, "GET", "/api/users", "", "admin", "admin-password"), 200)
	if _, found := s.store.get("alice"); found {
		t.Fatal("user not deleted")
	}
}

func TestInvalidUserBodies(t *testing.T) {
	s, h := testServer(t, http.NotFound)
	seed(t, s, "alice", "token")
	for _, body := range []string{`null`, `{}`, `{"user_id":"x","refresh_token_hash":"t"}`, `{"user_id":"x","is_premium":false}`, `{"user_id":"x","is_premium":false,"refresh_token_hash":"t","send_time":"invalid"}`, `{"user_id":"x","is_premium":false,"refresh_token_hash":"t","email":"invalid"}`, `{} {}`, `{"is_premium":"no"}`} {
		w := request(h, "POST", "/api/new_user", body, "", "")
		if w.Code < 400 {
			t.Fatalf("accepted invalid create %s", body)
		}
	}
	for _, tc := range []struct {
		body   string
		status int
	}{
		{`{}`, 400}, {`null`, 400}, {`{"send_time":"missing timezone"}`, 422},
		{`{"send_mail":"yes"}`, 422}, {`{"email":"not-email"}`, 422},
		{`{"refresh_token_hash":"replacement"}`, 400}, {`{"refresh_token":""}`, 422},
		{`{"custom_pl_name_pattern":null}`, 400},
	} {
		requireStatus(t, request(h, "PUT", "/api/update_user?user_id=alice", tc.body, "alice", "token"), tc.status)
	}
	w := request(h, "POST", "/api/new_user", strings.Repeat("x", (1<<20)+1), "", "")
	if w.Code < 400 {
		t.Fatal("accepted oversized body")
	}
}

func TestOAuthStateAndExistingUserLogin(t *testing.T) {
	for _, redirect := range []bool{true, false} {
		t.Run(map[bool]string{true: "redirect", false: "json"}[redirect], func(t *testing.T) {
			var calls atomic.Int32
			s, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				switch r.URL.Path {
				case "/api/token":
					if err := r.ParseForm(); err != nil {
						t.Error(err)
					}
					if r.Form.Get("redirect_uri") != "https://app.example/get_token" || r.Form.Get("client_secret") != "secret" {
						t.Error("incorrect token form")
					}
					jsonResponse(w, 200, spotifyToken{AccessToken: "access", TokenType: "Bearer", ExpiresIn: 3600, RefreshToken: "new-token", Scope: "scope"})
				case "/v1/me":
					if r.Header.Get("Authorization") != "Bearer access" {
						t.Error("missing bearer token")
					}
					jsonResponse(w, 200, map[string]string{"id": "alice"})
				default:
					t.Errorf("unexpected upstream: %s", r.URL.Path)
				}
			})
			before := seed(t, s, "alice", "old-token")
			_, err := s.store.update("alice", func(u *user) error { u.SendMail = true; u.TGChatID = ptr("123"); return nil })
			if err != nil {
				t.Fatal(err)
			}
			login := request(h, "GET", "/login?state=attacker", "", "", "")
			requireStatus(t, login, 307)
			location, _ := url.Parse(login.Header().Get("Location"))
			state := location.Query().Get("state")
			if len(state) < 32 || state == "attacker" || location.Query().Get("redirect_uri") != s.cfg.redirectURL {
				t.Fatal("invalid login redirect")
			}
			cookie := login.Result().Cookies()[0]
			if !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.MaxAge != 600 {
				t.Fatal("insecure OAuth cookie")
			}
			for _, badState := range []string{"", "wrong"} {
				r := httptest.NewRequest("GET", "/get_token?code=code&state="+badState, nil)
				r.AddCookie(cookie)
				w := httptest.NewRecorder()
				h.ServeHTTP(w, r)
				requireStatus(t, w, 400)
			}
			if calls.Load() != 0 {
				t.Fatal("invalid state reached Spotify")
			}
			r := httptest.NewRequest("GET", "/get_token?code=code&state="+state+"&redirect="+map[bool]string{true: "true", false: "false"}[redirect], nil)
			r.AddCookie(cookie)
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if redirect {
				requireStatus(t, w, 307)
			} else {
				requireStatus(t, w, 300)
			}
			after, _ := s.store.get("alice")
			if len(s.store.all()) != 1 || after.CreatedAt != before.CreatedAt || !after.SendMail || *after.TGChatID != "123" || !matchesToken(after, "new-token") || matchesToken(after, "old-token") {
				t.Fatal("login reset settings or failed to rotate auth")
			}
			if redirect {
				if w.Header().Get("Location") != "/app/user/alice" {
					t.Fatal("wrong frontend redirect")
				}
				count := 0
				for _, c := range w.Result().Cookies() {
					if c.Name == "refresh_token" || c.Name == "access_token" {
						count++
						if !c.Secure || c.SameSite != http.SameSiteLaxMode {
							t.Fatal("insecure token cookie")
						}
					}
				}
				if count != 2 {
					t.Fatal("missing browser tokens")
				}
			} else if !strings.Contains(w.Body.String(), `"user_id":"alice"`) {
				t.Fatal("missing dev user ID")
			}
		})
	}
}

func TestRefreshRotationAndErrors(t *testing.T) {
	for _, tc := range []struct {
		name, response         string
		upstreamStatus, status int
		hashOnly               bool
	}{
		{"rotation", `{"access_token":"access","token_type":"Bearer","expires_in":3600,"refresh_token":"new-token"}`, 200, 202, false},
		{"hash-only rotation", `{"access_token":"access","token_type":"Bearer","expires_in":3600,"refresh_token":"new-token"}`, 200, 202, true},
		{"no rotation", `{"access_token":"access","token_type":"Bearer","expires_in":3600}`, 200, 202, false},
		{"invalid grant", `{"error":"invalid_grant","error_description":"old-token"}`, 400, 400, false},
		{"upstream server error", `{"secret":"old-token"}`, 500, 502, false},
		{"malformed", `not json`, 200, 502, false},
		{"missing fields", `{"access_token":"access"}`, 200, 502, false},
		{"error payload", `{"error":"invalid_grant"}`, 200, 502, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
				r.ParseForm()
				if r.Form.Get("refresh_token") != "old-token" || r.Form.Get("grant_type") != "refresh_token" {
					t.Error("bad refresh request")
				}
				w.WriteHeader(tc.upstreamStatus)
				io.WriteString(w, tc.response)
			})
			before := seed(t, s, "alice", "old-token")
			if tc.hashOnly {
				s.store.update("alice", func(u *user) error { u.RefreshToken = ""; return nil })
			}
			w := request(h, "POST", "/api/refresh_token", `{"refresh_token":"old-token"}`, "", "")
			requireStatus(t, w, tc.status)
			u, _ := s.store.get("alice")
			if strings.Contains(tc.response, `"refresh_token":"new-token"`) {
				if !matchesToken(u, "new-token") || matchesToken(u, "old-token") || u.RefreshToken != "new-token" {
					t.Fatal("rotation failed")
				}
			} else if u.RefreshTokenHash != before.RefreshTokenHash {
				t.Fatal("unexpected auth mutation")
			}
			if tc.status != 202 && strings.Contains(w.Body.String(), "old-token") {
				t.Fatal("secret in error")
			}
		})
	}
}

func TestProxyPreservesQueryBodyHeadersAndStatus(t *testing.T) {
	_, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/playlists/abc/items" || r.URL.RawQuery != "limit=10&offset=20" {
			t.Errorf("lost URL: %s", r.URL)
		}
		body, _ := io.ReadAll(r.Body)
		if string(body) != `{"uris":["spotify:track:1"]}` || r.Method != "POST" {
			t.Error("lost body or method")
		}
		if r.Header.Get("Authorization") != "Bearer token" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Untrusted") != "" || r.Header.Get("Accept-Encoding") == "br" {
			t.Error("incorrect forwarded headers")
		}
		w.Header().Set("Retry-After", "30")
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Set-Cookie", "upstream-secret=bad")
		w.WriteHeader(429)
		io.WriteString(w, `{"error":"rate limited"}`)
	})
	r := httptest.NewRequest("POST", "/api/spotify/v1/playlists/abc/items?limit=10&offset=20", strings.NewReader(`{"uris":["spotify:track:1"]}`))
	r.Header.Set("Authorization", "Bearer token")
	r.Header.Set("Cookie", "secret=value")
	r.Header.Set("X-Untrusted", "no")
	r.Header.Set("Accept-Encoding", "br")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	requireStatus(t, w, 429)
	if w.Header().Get("Retry-After") != "30" || w.Header().Get("Content-Type") != "application/json" || w.Header().Get("Set-Cookie") != "" {
		t.Fatal("incorrect response headers")
	}
	if w.Body.String() != `{"error":"rate limited"}` {
		t.Fatal("lost upstream body")
	}
}

func TestProxyGzipAndStreaming(t *testing.T) {
	_, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Encoding", "gzip")
		z := gzip.NewWriter(w)
		z.Write([]byte(`{"ok":true}`))
		z.Close()
	})
	w := request(h, "GET", "/api/spotify/v1/me", "", "", "")
	requireStatus(t, w, 200)
	if w.Body.String() != `{"ok":true}` || w.Header().Get("Content-Encoding") != "" {
		t.Fatal("gzip not correctly decoded")
	}
}

func TestTelegramAuthDueTimeAndFailures(t *testing.T) {
	var deliveries atomic.Int32
	var fail atomic.Bool
	s, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botbot-secret/sendMessage" {
			t.Error("bad Telegram URL")
		}
		r.ParseForm()
		if r.Form.Get("chat_id") != "123" || !strings.Contains(r.Form.Get("text"), "https://app.example") {
			t.Error("bad Telegram form")
		}
		deliveries.Add(1)
		jsonResponse(w, 200, map[string]bool{"ok": !fail.Load()})
	})
	seed(t, s, "alice", "token")
	s.store.update("alice", func(u *user) error {
		u.TGChatID = ptr("123")
		u.SendMail = true
		u.SendTime = ptr("1973-01-07T00:30:00+02:00")
		return nil
	})
	requireStatus(t, request(h, "POST", "/api/test-notification", `{"tg_chat_id":"123","subject":"x","text":"x"}`, "", ""), 401)
	requireStatus(t, request(h, "POST", "/api/test-notification", `{"tg_chat_id":"456"}`, "alice", "token"), 403)
	requireStatus(t, request(h, "POST", "/api/test-notification", `{"tg_chat_id":"123"}`, "alice", "token"), 200)
	if deliveries.Load() != 1 {
		t.Fatal("unexpected delivery")
	}
	// Sunday 00:30 +02:00 is Saturday 22:30 UTC; minutes must be honored.
	now := time.Date(2026, 10, 31, 22, 30, 0, 0, time.UTC)
	result := s.notifications(context.Background(), now, true)
	if result.TotalUsers != 1 || len(result.NotifiedUsers) != 1 {
		t.Fatal("missed due reminder")
	}
	result = s.notifications(context.Background(), now.Add(time.Minute), true)
	if len(result.NotifiedUsers) != 0 {
		t.Fatal("ignored reminder minute")
	}
	requireStatus(t, request(h, "POST", "/api/force_notifications_task?weekday=5&hour=22", "", "admin", "admin-password"), 200)
	requireStatus(t, request(h, "POST", "/api/force_notifications_task?weekday=5&hour=24", "", "admin", "admin-password"), 422)
	requireStatus(t, request(h, "POST", "/api/force_notifications_task?weekday=5", "", "admin", "admin-password"), 422)
	fail.Store(true)
	requireStatus(t, request(h, "POST", "/api/test-notification", `{"tg_chat_id":"123"}`, "alice", "token"), 502)
	if len(s.notifications(context.Background(), now, true).NotifiedUsers) != 0 {
		t.Fatal("failed delivery reported as sent")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	done := make(chan struct{})
	go func() { s.runReminders(ctx); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("reminder worker did not stop")
	}
}

func TestStaticDocsHealthAndCORS(t *testing.T) {
	s, _ := testServer(t, http.NotFound)
	s.cfg.ignoreCORS = true
	if err := os.WriteFile(filepath.Join(s.cfg.webDir, "index.html"), []byte("frontend"), 0600); err != nil {
		t.Fatal(err)
	}
	h := s.handler()
	for _, path := range []string{"/health", "/app/", "/app/user/alice", "/openapi.json"} {
		w := request(h, "GET", path, "", "", "")
		requireStatus(t, w, 200)
		if w.Header().Get("Access-Control-Allow-Origin") != "*" {
			t.Fatal("missing CORS")
		}
	}
	requireStatus(t, request(h, "GET", "/docs", "", "", ""), 401)
	requireStatus(t, request(h, "GET", "/docs", "", "admin", "admin-password"), 200)
	requireStatus(t, request(h, "GET", "/", "", "", ""), 307)
	requireStatus(t, request(h, "GET", "/app", "", "", ""), 307)
	requireStatus(t, request(h, "GET", "/en/login", "", "", ""), 307)
	requireStatus(t, request(h, "OPTIONS", "/api/update_user", "", "", ""), 204)
	var schema map[string]any
	if err := json.Unmarshal(openAPI, &schema); err != nil {
		t.Fatal(err)
	}
}

func TestStoreAtomicFailureAndLegacyDocument(t *testing.T) {
	path := filepath.Join(t.TempDir(), "db.json")
	// Python bcrypt's $2b$ hashes and TinyDB numeric document keys are retained.
	legacy := `{"users":{"7":{"user_id":"legacy","created_at":"2026-01-01","is_premium":false,"refresh_token_hash":"$2b$04$abcdefghijklmnopqrstuu1VNeABE73u784CXhTtJsOmsz5FpGxae"}},"other":{"1":{"keep":true}}}`
	if err := os.WriteFile(path, []byte(legacy), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if u, ok := s.get("legacy"); !ok || !u.FilterDislikes || !matchesToken(u, "legacy-token") {
		t.Fatal("legacy user or Python bcrypt authentication lost")
	}
	if err := s.create(user{publicUser: publicUser{UserID: "new"}}); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if !bytes.Contains(data, []byte(`"other":{"1":{"keep":true}}`)) || !bytes.Contains(data, []byte(`"8":`)) {
		t.Fatal("legacy document structure changed")
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatal("unsafe database permissions")
	}
	originalPath := s.path
	s.path = filepath.Join(path, "impossible") // Parent is a regular file: deterministic write failure even as root.
	_, err = s.update("legacy", func(u *user) error { u.RefreshToken = "must-not-commit"; return nil })
	if err == nil {
		t.Fatal("expected write failure")
	}
	u, _ := s.get("legacy")
	if u.RefreshToken != "" {
		t.Fatal("failed write mutated memory")
	}
	after, _ := os.ReadFile(originalPath)
	if !bytes.Equal(data, after) {
		t.Fatal("failed write changed database")
	}
	for _, bad := range []string{`null`, ``, `{"users":null}`, `{"users":{"x":{"user_id":"a"}}}`, `{"users":{"1":{"user_id":"a"},"2":{"user_id":"a"}}}`} {
		badPath := filepath.Join(t.TempDir(), "db.json")
		os.WriteFile(badPath, []byte(bad), 0600)
		if _, err := openStore(badPath); err == nil {
			t.Fatalf("accepted corrupt database %q", bad)
		}
	}
}

func TestConcurrentStoreUpdates(t *testing.T) {
	s, h := testServer(t, http.NotFound)
	seed(t, s, "alice", "token")
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			w := request(h, "PUT", "/api/update_user?user_id=alice", `{"filter_dislikes":false}`, "alice", "token")
			if w.Code != 200 {
				t.Errorf("concurrent update: %d", w.Code)
			}
		}()
	}
	wg.Wait()
	if _, err := openStore(s.store.path); err != nil {
		t.Fatal(err)
	}
}
