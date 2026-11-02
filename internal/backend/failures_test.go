package backend

import (
	"bytes"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfig(t *testing.T) {
	for key, value := range map[string]string{
		"SPOTIPY_CLIENT_ID": "client", "SPOTIPY_CLIENT_SECRET": "secret", "SPOTIPY_REDIRECT_URL": "https://app.example/get_token",
		"API_LOGIN": "admin", "API_PASSWORD": "password", "HTTP_PORT": "", "UVICORN_PORT": "", "DATA_PATH": "", "IGNORE_CORS": "false",
	} {
		t.Setenv(key, value)
	}
	c, err := loadConfig()
	if err != nil || c.addr != ":8000" || c.dbPath != "data/db.json" || c.ignoreCORS {
		t.Fatalf("bad defaults: %#v, %v", c, err)
	}
	t.Setenv("UVICORN_PORT", "8080")
	c, _ = loadConfig()
	if c.addr != ":8080" {
		t.Fatal("legacy port ignored")
	}
	t.Setenv("HTTP_PORT", "8081")
	t.Setenv("IGNORE_CORS", "True")
	c, _ = loadConfig()
	if c.addr != ":8081" || !c.ignoreCORS {
		t.Fatal("port precedence or CORS failed")
	}
	t.Setenv("SPOTIPY_REDIRECT_URL", "/relative")
	if _, err := loadConfig(); err == nil {
		t.Fatal("accepted relative redirect URI")
	}
	t.Setenv("SPOTIPY_REDIRECT_URL", "https://app.example/get_token")
	t.Setenv("API_PASSWORD", "")
	if _, err := loadConfig(); err == nil {
		t.Fatal("accepted missing admin password")
	}
}

func TestRotationFailureDoesNotCommitOrReturnTokens(t *testing.T) {
	s, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, spotifyToken{AccessToken: "secret-access", TokenType: "Bearer", ExpiresIn: 3600, RefreshToken: "secret-new"})
	})
	seed(t, s, "alice", "old-token")
	s.store.path = filepath.Join(s.store.path, "impossible")
	w := request(h, "POST", "/api/refresh_token", `{"refresh_token":"old-token"}`, "", "")
	requireStatus(t, w, 500)
	if strings.Contains(w.Body.String(), "secret-") {
		t.Fatal("tokens returned despite persistence failure")
	}
	u, _ := s.store.get("alice")
	if !matchesToken(u, "old-token") || matchesToken(u, "secret-new") {
		t.Fatal("failed rotation changed authentication")
	}
}

func TestUnknownRefreshTokenStillWorks(t *testing.T) {
	_, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		jsonResponse(w, 200, spotifyToken{AccessToken: "access", TokenType: "Bearer", ExpiresIn: 3600, RefreshToken: "new"})
	})
	requireStatus(t, request(h, "POST", "/api/refresh_token", `{"refresh_token":"unregistered"}`, "", ""), 202)
}

func TestLongLegacyTokenPrefix(t *testing.T) {
	s, _ := testServer(t, http.NotFound)
	token := strings.Repeat("x", 90)
	u := seed(t, s, "alice", token)
	if !matchesToken(u, token) || !matchesToken(u, token[:72]) || matchesToken(u, "different") {
		t.Fatal("legacy bcrypt truncation changed")
	}
}

func TestLogsExcludeOAuthAndUserSecrets(t *testing.T) {
	s, _ := testServer(t, http.NotFound)
	var logs bytes.Buffer
	s.log = slog.New(slog.NewJSONHandler(&logs, nil))
	h := s.handler()
	requireStatus(t, request(h, "GET", "/health", "", "", ""), 200)
	if logs.Len() != 0 {
		t.Fatal("health probes should not generate access logs")
	}
	requireStatus(t, request(h, "GET", "/get_token?code=secret-code&state=secret-state", "", "", ""), 400)
	requireStatus(t, request(h, "GET", "/api/user?user_id=private-user", "", "private-user", "private-token"), 401)
	for _, secret := range []string{"secret-code", "secret-state", "private-user", "private-token"} {
		if strings.Contains(logs.String(), secret) {
			t.Fatalf("secret %q in logs", secret)
		}
	}
}

// A test transport lets failure paths run without real Spotify/Telegram traffic.
type failedTransport struct{}

func (failedTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("upstream transport error with secret-token")
}

func TestNetworkErrorsAreSanitized(t *testing.T) {
	s, _ := testServer(t, http.NotFound)
	s.client = &http.Client{Transport: failedTransport{}}
	h := s.handler()
	seed(t, s, "alice", "token")
	s.store.update("alice", func(u *user) error { u.TGChatID = ptr("123"); return nil })
	for _, tc := range []struct{ method, path, body, name, pass string }{
		{"POST", "/api/refresh_token", `{"refresh_token":"secret-token"}`, "", ""},
		{"GET", "/api/spotify/v1/me", "", "", ""},
		{"POST", "/api/test-notification", `{"tg_chat_id":"123"}`, "alice", "token"},
	} {
		w := request(h, tc.method, tc.path, tc.body, tc.name, tc.pass)
		requireStatus(t, w, 502)
		if strings.Contains(w.Body.String(), "secret-token") {
			t.Fatal("transport error leaked")
		}
	}
}

func TestProxyDoesNotFollowRedirectsOrChangeOrigin(t *testing.T) {
	var escaped bool
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { escaped = true }))
	defer target.Close()
	_, h := testServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/https://evil.example/v1/me" {
			t.Errorf("unexpected proxy path: %s", r.URL.Path)
		}
		w.Header().Set("Location", target.URL)
		w.WriteHeader(http.StatusTemporaryRedirect)
	})
	// Encoded slashes avoid ServeMux's normal path-cleaning redirect.
	w := request(h, "GET", "/api/spotify/https:%2F%2Fevil.example/v1/me", "", "", "")
	requireStatus(t, w, 307)
	if escaped || w.Header().Get("Location") != "" {
		t.Fatal("proxy followed or exposed upstream redirect")
	}
}

func TestBoundedUpstreamJSON(t *testing.T) {
	response := &http.Response{Body: io.NopCloser(strings.NewReader(strings.Repeat("x", (1<<20)+1)))}
	if err := readJSONResponse(response, new(any)); err == nil {
		t.Fatal("accepted oversized upstream response")
	}
}
