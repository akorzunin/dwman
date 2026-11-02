package backend

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

//go:embed openapi.json
var openAPI []byte

type config struct {
	addr, dbPath, webDir                 string
	clientID, clientSecret, redirectURL  string
	adminLogin, adminPassword            string
	tgToken, deployURL                   string
	ignoreCORS                           bool
	accountsURL, spotifyURL, telegramURL string
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func loadConfig() (config, error) {
	c := config{
		addr:   ":" + env("HTTP_PORT", env("UVICORN_PORT", "8000")),
		dbPath: env("DATA_PATH", "data/db.json"), webDir: "web/dist",
		clientID: os.Getenv("SPOTIPY_CLIENT_ID"), clientSecret: os.Getenv("SPOTIPY_CLIENT_SECRET"),
		redirectURL: os.Getenv("SPOTIPY_REDIRECT_URL"),
		adminLogin:  os.Getenv("API_LOGIN"), adminPassword: os.Getenv("API_PASSWORD"),
		tgToken: os.Getenv("TG_BOT_TOKEN"), deployURL: env("DEPLOY_URL", "http://localhost:8000"),
		ignoreCORS:  strings.EqualFold(os.Getenv("IGNORE_CORS"), "true") || os.Getenv("IGNORE_CORS") == "1",
		accountsURL: "https://accounts.spotify.com", spotifyURL: "https://api.spotify.com",
		telegramURL: "https://api.telegram.org",
	}
	if c.clientID == "" || c.clientSecret == "" || c.adminLogin == "" || c.adminPassword == "" {
		return c, errors.New("SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, API_LOGIN and API_PASSWORD are required")
	}
	u, err := url.Parse(c.redirectURL)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return c, errors.New("SPOTIPY_REDIRECT_URL must be an absolute HTTP(S) URL")
	}
	return c, nil
}

type server struct {
	cfg    config
	store  *store
	client *http.Client
	log    *slog.Logger
}

func Run() error {
	c, err := loadConfig()
	if err != nil {
		return err
	}
	level := slog.LevelInfo
	if value := os.Getenv("LOG_LEVEL"); value != "" {
		if err := level.UnmarshalText([]byte(value)); err != nil {
			return errors.New("invalid LOG_LEVEL")
		}
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	db, err := openStore(c.dbPath)
	if err != nil {
		return err
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxIdleConns = 16
	transport.MaxIdleConnsPerHost = 4
	transport.IdleConnTimeout = 60 * time.Second
	client := &http.Client{Transport: transport, Timeout: 20 * time.Second,
		// Never forward user credentials or OAuth requests through upstream redirects.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	defer transport.CloseIdleConnections()
	s := &server{cfg: c, store: db, client: client, log: logger}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); s.runReminders(ctx) }()
	httpServer := &http.Server{
		Addr: c.addr, Handler: s.handler(), ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second,
		IdleTimeout: 60 * time.Second, MaxHeaderBytes: 32 << 10,
	}
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdown); err != nil {
			logger.Error("HTTP shutdown failed")
			_ = httpServer.Close()
		}
	}()
	logger.Info("listening", "address", c.addr)
	err = httpServer.ListenAndServe()
	stop()
	<-shutdownDone
	<-workerDone
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { jsonResponse(w, 200, map[string]string{"message": "ok"}) })
	mux.HandleFunc("GET /login", s.login)
	mux.HandleFunc("GET /get_token", s.callback)
	mux.HandleFunc("POST /api/refresh_token", s.refreshToken)
	mux.HandleFunc("POST /api/new_user", s.createUser)
	mux.HandleFunc("GET /api/user", s.getUser)
	mux.HandleFunc("PUT /api/update_user", s.updateUser)
	mux.HandleFunc("POST /api/test-notification", s.testNotification)
	mux.HandleFunc("GET /api/users", s.admin(s.listUsers))
	mux.HandleFunc("DELETE /api/delete_user", s.admin(s.deleteUser))
	mux.HandleFunc("POST /api/force_notifications_task", s.admin(s.forceNotifications))
	mux.HandleFunc("GET /api/spotify/{path...}", s.proxy)
	mux.HandleFunc("POST /api/spotify/{path...}", s.proxy)
	mux.HandleFunc("GET /openapi.json", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(openAPI)
	})
	mux.HandleFunc("GET /docs", s.admin(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = io.WriteString(w, `<!doctype html><title>DWMan API</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui'})</script>`)
	}))
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir(filepath.Join(s.cfg.webDir, "assets")))))
	mux.HandleFunc("GET /app", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/app/", http.StatusTemporaryRedirect)
	})
	mux.HandleFunc("GET /app/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, filepath.Join(s.cfg.webDir, "index.html"))
	})
	mux.HandleFunc("GET /favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		files, _ := filepath.Glob(filepath.Join(s.cfg.webDir, "assets", "play-arrow-*.png"))
		if len(files) == 0 {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, files[0])
	})
	mux.HandleFunc("GET /user/{user_id}", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/app/user/"+url.PathEscape(r.PathValue("user_id")), http.StatusTemporaryRedirect)
	})
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/app/", http.StatusTemporaryRedirect)
		} else if parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/"), "/"); len(parts) == 2 && parts[1] == "login" {
			http.Redirect(w, r, "/login", http.StatusTemporaryRedirect)
		} else {
			http.NotFound(w, r)
		}
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		defer func() {
			if recover() != nil {
				s.log.Error("request panic", "method", r.Method) // Never log query strings, tokens, or panic values.
				if !rw.wrote {
					problem(rw, 500, "Internal server error")
				}
			}
			if r.URL.Path != "/health" || rw.status >= 400 {
				// Route patterns omit query strings (OAuth codes/state) and user identifiers.
				s.log.Info("request", "route", r.Pattern, "method", r.Method, "status", rw.status, "duration_ms", time.Since(start).Milliseconds())
			}
		}()
		if s.cfg.ignoreCORS {
			rw.Header().Set("Access-Control-Allow-Origin", "*")
			rw.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			rw.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			if r.Method == http.MethodOptions {
				rw.WriteHeader(http.StatusNoContent)
				return
			}
		}
		mux.ServeHTTP(rw, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
	wrote  bool
}

func (w *statusWriter) WriteHeader(code int) {
	if !w.wrote {
		w.status, w.wrote = code, true
		w.ResponseWriter.WriteHeader(code)
	}
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if !w.wrote {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func jsonResponse(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func problem(w http.ResponseWriter, status int, detail string) {
	jsonResponse(w, status, map[string]string{"detail": detail})
}

func decode(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	d := json.NewDecoder(r.Body)
	if err := d.Decode(value); err != nil {
		problem(w, 422, "Invalid JSON body")
		return false
	}
	if err := d.Decode(new(any)); err != io.EOF {
		problem(w, 422, "Expected one JSON value")
		return false
	}
	return true
}

func constantEqual(a, b string) bool {
	x, y := sha256.Sum256([]byte(a)), sha256.Sum256([]byte(b))
	return subtle.ConstantTimeCompare(x[:], y[:]) == 1
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", "Basic")
	problem(w, 401, "Incorrect username or password")
}

func (s *server) admin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name, password, ok := r.BasicAuth()
		validName, validPass := constantEqual(name, s.cfg.adminLogin), constantEqual(password, s.cfg.adminPassword)
		if !ok || !validName || !validPass {
			unauthorized(w)
			return
		}
		next(w, r)
	}
}

func (s *server) authenticate(w http.ResponseWriter, r *http.Request) (user, bool) {
	name, token, ok := r.BasicAuth()
	u, found := s.store.get(name)
	if !ok || !found || !matchesToken(u, token) {
		unauthorized(w)
		return user{}, false
	}
	return u, true
}

func selfAccess(w http.ResponseWriter, r *http.Request, u user) bool {
	id := r.URL.Query().Get("user_id")
	if id == "" {
		problem(w, 422, "user_id is required")
		return false
	}
	if id != u.UserID {
		problem(w, 403, "Cannot access another user")
		return false
	}
	return true
}

func intQuery(r *http.Request, key string, min, max int) (int, error) {
	i, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil || i < min || i > max {
		return 0, errors.New("invalid " + key)
	}
	return i, nil
}
