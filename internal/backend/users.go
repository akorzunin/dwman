package backend

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/mail"
	"strings"
	"time"
)

func (s *server) createUser(w http.ResponseWriter, r *http.Request) {
	body := struct {
		user
		Premium *bool `json:"is_premium"`
	}{user: user{publicUser: publicUser{FilterDislikes: true}}}
	if !decode(w, r, &body) {
		return
	}
	u := body.user
	if u.UserID == "" || body.Premium == nil || u.RefreshTokenHash == "" {
		problem(w, 422, "user_id, is_premium and refresh_token_hash are required")
		return
	}
	u.IsPremium = *body.Premium
	u.CreatedAt = time.Now().UTC().Format("2006-01-02 15:04:05.000000+00:00")
	if err := validateUser(&u); err != nil {
		problem(w, 422, err.Error())
		return
	}
	if _, exists := s.store.get(u.UserID); exists {
		jsonResponse(w, 400, map[string]string{"message": errDuplicate.Error()})
		return
	}
	// Legacy API calls this field a hash, but the browser submits the token's
	// first 72 bytes. Retain that contract; never return either auth field.
	hash, err := hashToken(u.RefreshTokenHash)
	if err != nil {
		problem(w, 500, "Could not hash credentials")
		return
	}
	u.RefreshTokenHash = hash
	if err := s.store.create(u); err != nil {
		if errors.Is(err, errDuplicate) {
			jsonResponse(w, 400, map[string]string{"message": err.Error()})
		} else {
			problem(w, 500, "Could not persist user")
		}
		return
	}
	jsonResponse(w, 200, u.publicUser)
}

func (s *server) getUser(w http.ResponseWriter, r *http.Request) {
	u, ok := s.authenticate(w, r)
	if !ok || !selfAccess(w, r, u) {
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	jsonResponse(w, 200, u.publicUser)
}

func (s *server) updateUser(w http.ResponseWriter, r *http.Request) {
	u, ok := s.authenticate(w, r)
	if !ok || !selfAccess(w, r, u) {
		return
	}
	var body map[string]json.RawMessage
	if !decode(w, r, &body) {
		return
	}
	var hash string
	if raw := body["refresh_token"]; len(raw) != 0 && string(raw) != "null" {
		var token string
		if err := json.Unmarshal(raw, &token); err != nil || token == "" {
			problem(w, 422, "Invalid refresh_token")
			return
		}
		var err error
		hash, err = hashToken(token)
		if err != nil {
			problem(w, 500, "Could not hash credentials")
			return
		}
	} else if raw := body["refresh_token_hash"]; len(raw) != 0 && string(raw) != "null" {
		jsonResponse(w, 400, map[string]string{"message": "refresh_token is required when updating its hash"})
		return
	}
	patch := make(map[string]json.RawMessage)
	for _, key := range []string{"send_mail", "email", "send_time", "is_premium", "refresh_token", "dw_playlist_id", "save_full_playlist", "filter_dislikes", "tg_chat_id", "custom_pl_name_pattern", "custom_pl_description_pattern"} {
		if raw, ok := body[key]; ok && string(raw) != "null" {
			patch[key] = raw
		}
	}
	if len(patch) == 0 {
		jsonResponse(w, 400, map[string]string{"message": "Could not update user"})
		return
	}
	data, _ := json.Marshal(patch)
	// Validate before acquiring the persistence lock; apply to the latest record
	// inside the transaction so unrelated concurrent updates are not overwritten.
	candidate := u
	if err := json.Unmarshal(data, &candidate); err != nil {
		problem(w, 422, "Invalid user fields")
		return
	}
	if err := validateUser(&candidate); err != nil {
		problem(w, 422, err.Error())
		return
	}
	updated, err := s.store.update(u.UserID, func(current *user) error {
		if err := json.Unmarshal(data, current); err != nil {
			return err
		}
		if hash != "" {
			current.RefreshTokenHash = hash
		}
		return validateUser(current)
	})
	if err != nil {
		problem(w, 500, "Could not persist user")
		return
	}
	jsonResponse(w, 200, updated.publicUser)
}

func parseSendTime(value string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999Z07:00", "2006-01-02 15:04:05.999999999-0700"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("send_time must include a timezone")
}

func validateUser(u *user) error {
	if u.Email != nil && *u.Email != "" {
		address, err := mail.ParseAddress(*u.Email)
		if err != nil || address.Address != *u.Email || !strings.Contains(address.Address, "@") {
			return errors.New("Invalid email")
		}
	}
	if u.SendTime != nil && *u.SendTime != "" {
		if _, err := parseSendTime(*u.SendTime); err != nil {
			return err
		}
	}
	return nil
}

func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	result := make([]publicUser, 0)
	for _, u := range s.store.all() {
		result = append(result, u.publicUser)
	}
	w.Header().Set("Cache-Control", "no-store")
	jsonResponse(w, 200, result)
}

func (s *server) deleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("user_id")
	if id == "" {
		problem(w, 422, "user_id is required")
		return
	}
	if err := s.store.delete(id); errors.Is(err, errNotFound) {
		jsonResponse(w, 202, map[string]string{"message": "User does not exists"})
	} else if err != nil {
		problem(w, 500, "Could not delete user")
	} else {
		jsonResponse(w, 200, map[string]string{"message": "User deleted"})
	}
}
