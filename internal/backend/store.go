package backend

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

type publicUser struct {
	UserID                     string  `json:"user_id"`
	CreatedAt                  string  `json:"created_at"`
	SendMail                   bool    `json:"send_mail"`
	Email                      *string `json:"email"`
	SendTime                   *string `json:"send_time"`
	IsPremium                  bool    `json:"is_premium"`
	TGChatID                   *string `json:"tg_chat_id"`
	DWPlaylistID               *string `json:"dw_playlist_id"`
	SaveFullPlaylist           bool    `json:"save_full_playlist"`
	FilterDislikes             bool    `json:"filter_dislikes"`
	CustomPLNamePattern        *string `json:"custom_pl_name_pattern"`
	CustomPLDescriptionPattern *string `json:"custom_pl_description_pattern"`
}

type user struct {
	publicUser
	RefreshToken     string `json:"refresh_token,omitempty"`
	RefreshTokenHash string `json:"refresh_token_hash,omitempty"`
}

var errNotFound = errors.New("User not found")
var errDuplicate = errors.New("User already exists")

// Single-process store with a global lock and O(n) scans/whole-file writes.
// Move to SQLite transactions before adding replicas or a large user base.
// Keep TinyDB's document IDs and unrelated tables for rollback compatibility.
type store struct {
	mu       sync.RWMutex
	path     string
	document map[string]json.RawMessage
	users    map[string]user
}

func openStore(path string) (*store, error) {
	s := &store{path: path, document: make(map[string]json.RawMessage), users: make(map[string]user)}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(data, &s.document); err != nil || s.document == nil {
		return nil, errors.New("invalid database document")
	}
	if raw, ok := s.document["users"]; ok {
		var records map[string]json.RawMessage
		if err = json.Unmarshal(raw, &records); err != nil || records == nil {
			return nil, errors.New("invalid users table")
		}
		for id, record := range records {
			u := user{publicUser: publicUser{FilterDislikes: true}}
			if err := json.Unmarshal(record, &u); err != nil {
				return nil, errors.New("invalid user record")
			}
			s.users[id] = u
		}
	}
	seen := make(map[string]bool)
	for id, u := range s.users {
		n, err := strconv.Atoi(id)
		if err != nil || n <= 0 || u.UserID == "" || seen[u.UserID] {
			return nil, errors.New("invalid or duplicate user record")
		}
		seen[u.UserID] = true
	}
	return s, nil
}

func (s *store) all() []user {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]user, 0, len(s.users))
	for _, u := range s.users {
		result = append(result, u)
	}
	return result
}

func (s *store) get(userID string) (user, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, u := range s.users {
		if u.UserID == userID {
			return u, true
		}
	}
	return user{}, false
}

// Mutate a copy: failed writes must not leave in-memory auth ahead of disk.
func (s *store) change(fn func(map[string]user) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	updated := make(map[string]user, len(s.users))
	for k, v := range s.users {
		updated[k] = v
	}
	if err := fn(updated); err != nil {
		return err
	}
	raw, err := json.Marshal(updated)
	if err != nil {
		return err
	}
	document := make(map[string]json.RawMessage, len(s.document)+1)
	for k, v := range s.document {
		document[k] = v
	}
	document["users"] = raw
	data, err := json.Marshal(document)
	if err != nil {
		return err
	}
	if err := atomicWrite(s.path, data); err != nil {
		return err
	}
	s.users, s.document = updated, document
	return nil
}

func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(dir, ".db-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}

func (s *store) create(u user) error {
	return s.change(func(users map[string]user) error {
		next := 1
		for id, existing := range users {
			if existing.UserID == u.UserID {
				return errDuplicate
			}
			n, _ := strconv.Atoi(id)
			if n >= next {
				next = n + 1
			}
		}
		users[strconv.Itoa(next)] = u
		return nil
	})
}

func (s *store) update(id string, fn func(*user) error) (user, error) {
	var result user
	err := s.change(func(users map[string]user) error {
		for key, u := range users {
			if u.UserID == id {
				if err := fn(&u); err != nil {
					return err
				}
				users[key], result = u, u
				return nil
			}
		}
		return errNotFound
	})
	return result, err
}

func (s *store) delete(id string) error {
	return s.change(func(users map[string]user) error {
		for key, u := range users {
			if u.UserID == id {
				delete(users, key)
				return nil
			}
		}
		return errNotFound
	})
}

func tokenBytes(token string) []byte {
	b := []byte(token)
	// Legacy browser authentication and Python bcrypt truncate at 72 bytes.
	if len(b) > 72 {
		b = b[:72]
	}
	return b
}

func hashToken(token string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword(tokenBytes(token), 12)
	return string(hash), err
}

func matchesToken(u user, token string) bool {
	return u.RefreshTokenHash != "" && bcrypt.CompareHashAndPassword([]byte(u.RefreshTokenHash), tokenBytes(token)) == nil
}

func (s *store) rotate(id, token string) error {
	hash, err := hashToken(token)
	if err != nil {
		return err
	}
	_, err = s.update(id, func(u *user) error {
		u.RefreshToken, u.RefreshTokenHash = token, hash
		return nil
	})
	return err
}

func (s *store) rotateMatching(oldToken, newToken string) error {
	// Legacy records can have only a hash, so no plaintext-only index is safe.
	for _, u := range s.all() {
		if u.RefreshToken == oldToken || matchesToken(u, oldToken) {
			if err := s.rotate(u.UserID, newToken); err != nil {
				return fmt.Errorf("persist rotated token: %w", err)
			}
			return nil
		}
	}
	return nil // Token refresh is also used before a user has registered.
}
