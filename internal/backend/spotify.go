package backend

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const spotifyScopes = "user-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-recently-played"

type spotifyToken struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token,omitempty"`
	Scope        string `json:"scope,omitempty"`
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	stateBytes := make([]byte, 32)
	if _, err := rand.Read(stateBytes); err != nil {
		problem(w, 500, "Could not generate OAuth state")
		return
	}
	state := base64.RawURLEncoding.EncodeToString(stateBytes)
	showDialog := r.URL.Query().Get("show_dialog")
	if showDialog == "" {
		showDialog = "false"
	}
	if showDialog != "true" && showDialog != "false" {
		problem(w, 422, "Invalid show_dialog")
		return
	}
	q := url.Values{
		"response_type": {"code"}, "client_id": {s.cfg.clientID}, "scope": {spotifyScopes},
		"redirect_uri": {s.cfg.redirectURL}, "state": {state}, "show_dialog": {showDialog},
	}
	w.Header().Set("Cache-Control", "no-store")
	http.SetCookie(w, &http.Cookie{Name: "oauth_session", Value: state, Path: "/", HttpOnly: true,
		Secure: strings.HasPrefix(s.cfg.redirectURL, "https://"), SameSite: http.SameSiteLaxMode, MaxAge: 600})
	http.Redirect(w, r, s.cfg.accountsURL+"/en/authorize?"+q.Encode(), http.StatusTemporaryRedirect)
}

// Bound token/profile responses; proxy responses are streamed separately.
func readJSONResponse(response *http.Response, target any) error {
	defer response.Body.Close()
	b, err := io.ReadAll(io.LimitReader(response.Body, (1<<20)+1))
	if err != nil || len(b) > 1<<20 {
		return errors.New("invalid upstream response")
	}
	return json.Unmarshal(b, target)
}

func (s *server) exchange(r *http.Request, form url.Values) (spotifyToken, int) {
	form.Set("client_id", s.cfg.clientID)
	form.Set("client_secret", s.cfg.clientSecret)
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, s.cfg.accountsURL+"/api/token", strings.NewReader(form.Encode()))
	if err != nil {
		return spotifyToken{}, 502
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.client.Do(req)
	if err != nil {
		return spotifyToken{}, 502
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		response.Body.Close()
		if response.StatusCode >= 400 && response.StatusCode < 500 {
			return spotifyToken{}, response.StatusCode
		}
		return spotifyToken{}, 502
	}
	var token spotifyToken
	if err := readJSONResponse(response, &token); err != nil || token.AccessToken == "" || token.TokenType != "Bearer" || token.ExpiresIn <= 0 {
		return spotifyToken{}, 502
	}
	return token, 0
}

func (s *server) callback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	cookie, err := r.Cookie("oauth_session")
	state := r.URL.Query().Get("state")
	if err != nil || state == "" || cookie.Value == "" || !constantEqual(state, cookie.Value) {
		problem(w, 400, "Invalid OAuth state")
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "oauth_session", Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: strings.HasPrefix(s.cfg.redirectURL, "https://"), SameSite: http.SameSiteLaxMode})
	code := r.URL.Query().Get("code")
	if code == "" {
		problem(w, 400, "Spotify authorization code is required")
		return
	}
	redirect := true
	if value := r.URL.Query().Get("redirect"); value != "" {
		redirect, err = strconv.ParseBool(value)
		if err != nil {
			problem(w, 422, "Invalid redirect")
			return
		}
	}
	token, status := s.exchange(r, url.Values{"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {s.cfg.redirectURL}})
	if status != 0 {
		problem(w, 502, "Spotify token exchange failed")
		return
	}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, s.cfg.spotifyURL+"/v1/me", nil)
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	response, err := s.client.Do(req)
	if err != nil {
		problem(w, 502, "Spotify profile request failed")
		return
	}
	var profile struct {
		ID string `json:"id"`
	}
	status = response.StatusCode
	if err = readJSONResponse(response, &profile); err != nil || status != 200 || profile.ID == "" {
		problem(w, 502, "Spotify profile request failed")
		return
	}
	if _, exists := s.store.get(profile.ID); exists && token.RefreshToken != "" {
		if err := s.store.rotate(profile.ID, token.RefreshToken); err != nil {
			problem(w, 500, "Could not persist refreshed token")
			return
		}
	}
	data := map[string]any{
		"access_token": token.AccessToken, "token_type": token.TokenType, "expires_in": token.ExpiresIn,
		"scope": token.Scope, "get_time": time.Now().UTC().Format("2006-01-02 15:04:05.000000"),
	}
	if token.RefreshToken != "" {
		data["refresh_token"] = token.RefreshToken
	}
	if !redirect {
		data["user_id"] = profile.ID
		jsonResponse(w, 300, data) // Preserve the dev client's existing callback contract.
		return
	}
	for key, value := range data {
		// Browser Spotify calls currently need these cookies. A session/BFF migration
		// would allow HttpOnly tokens, but requires changing frontend authentication.
		http.SetCookie(w, &http.Cookie{Name: key, Value: stringify(value), Path: "/",
			Secure: strings.HasPrefix(s.cfg.redirectURL, "https://"), SameSite: http.SameSiteLaxMode})
	}
	http.Redirect(w, r, "/app/user/"+url.PathEscape(profile.ID), http.StatusTemporaryRedirect)
}

func stringify(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return strconv.Itoa(v.(int))
}

func (s *server) refreshToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if !decode(w, r, &body) {
		return
	}
	if body.RefreshToken == "" {
		problem(w, 422, "refresh_token is required")
		return
	}
	token, status := s.exchange(r, url.Values{"grant_type": {"refresh_token"}, "refresh_token": {body.RefreshToken}})
	if status != 0 {
		problem(w, status, "Spotify token refresh failed")
		return
	}
	if token.RefreshToken != "" {
		if err := s.store.rotateMatching(body.RefreshToken, token.RefreshToken); err != nil {
			problem(w, 500, "Could not persist refreshed token")
			return
		}
	}
	// The refresh API intentionally omits scope (the existing response schema does).
	token.Scope = ""
	jsonResponse(w, 202, token)
}

func (s *server) proxy(w http.ResponseWriter, r *http.Request) {
	// Construct from a fixed host, never ResolveReference: //host and absolute URLs
	// in user input must not turn this credential-bearing proxy into SSRF.
	base, _ := url.Parse(s.cfg.spotifyURL)
	base.Path = "/" + r.PathValue("path")
	base.RawQuery = r.URL.RawQuery
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	req, err := http.NewRequestWithContext(r.Context(), r.Method, base.String(), r.Body)
	if err != nil {
		problem(w, 400, "Invalid Spotify request")
		return
	}
	for _, name := range []string{"Accept", "Content-Type", "Authorization", "User-Agent"} {
		if value := r.Header.Get(name); value != "" {
			req.Header.Set(name, value)
		}
	}
	response, err := s.client.Do(req)
	if err != nil {
		var sizeErr *http.MaxBytesError
		if errors.As(err, &sizeErr) {
			problem(w, 413, "Request body too large")
		} else {
			problem(w, 502, "Spotify request failed")
		}
		return
	}
	defer response.Body.Close()
	for _, name := range []string{"Content-Type", "Retry-After", "Cache-Control", "ETag", "Content-Encoding"} {
		if value := response.Header.Get(name); value != "" {
			w.Header().Set(name, value)
		}
	}
	w.WriteHeader(response.StatusCode)
	if _, err := io.Copy(w, response.Body); err != nil {
		s.log.Warn("Spotify response stream interrupted")
	}
}
