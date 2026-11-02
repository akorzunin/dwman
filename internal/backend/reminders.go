package backend

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (s *server) runReminders(ctx context.Context) {
	// Minute-aligned polling, no catch-up after downtime. A persisted delivery
	// ledger is needed if reminders must be retried or survive missed schedules.
	for {
		now := time.Now()
		timer := time.NewTimer(time.Until(now.Truncate(time.Minute).Add(time.Minute)))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case now = <-timer.C:
			s.notifications(ctx, now.UTC(), true)
		}
	}
}

func reminderDue(u user, now time.Time, matchMinute bool) bool {
	if !u.SendMail || u.SendTime == nil || *u.SendTime == "" {
		return false
	}
	scheduled, err := parseSendTime(*u.SendTime)
	if err != nil {
		return false
	}
	scheduled, now = scheduled.UTC(), now.UTC()
	return scheduled.Weekday() == now.Weekday() && scheduled.Hour() == now.Hour() && (!matchMinute || scheduled.Minute() == now.Minute())
}

func (s *server) sendNotification(ctx context.Context, u user) error {
	if u.TGChatID == nil || *u.TGChatID == "" || s.cfg.tgToken == "" {
		return fmt.Errorf("Telegram chat or bot token is not configured")
	}
	now := time.Now().UTC()
	_, week := now.ISOWeek()
	text := fmt.Sprintf("\nSave Discover Weekly Playlist %d_%02d\n\ndwman: %s\n", now.Year(), week, s.cfg.deployURL)
	if u.DWPlaylistID != nil && *u.DWPlaylistID != "" {
		text += "playlist link: https://open.spotify.com/playlist/" + *u.DWPlaylistID
	}
	form := url.Values{"chat_id": {*u.TGChatID}, "text": {text}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.telegramURL+"/bot"+s.cfg.tgToken+"/sendMessage", strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("could not build Telegram request")
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("Telegram request failed")
	} // Do not expose the bot token in transport errors.
	var result struct {
		OK bool `json:"ok"`
	}
	status := response.StatusCode
	if err := readJSONResponse(response, &result); err != nil || status != 200 || !result.OK {
		return fmt.Errorf("Telegram delivery failed")
	}
	return nil
}

type notificationResult struct {
	TotalUsers    int      `json:"total_users"`
	NotifiedUsers []string `json:"notified_users"`
	Date          string   `json:"date"`
	CurrDate      string   `json:"curr_date"`
}

func (s *server) notifications(ctx context.Context, now time.Time, matchMinute bool) notificationResult {
	date := func(t time.Time) string {
		return fmt.Sprintf("%d %02d:%02d", (int(t.Weekday())+6)%7, t.Hour(), t.Minute())
	}
	result := notificationResult{NotifiedUsers: []string{}, Date: date(time.Now().UTC()), CurrDate: date(now)}
	for _, u := range s.store.all() {
		if ctx.Err() != nil {
			break
		}
		if !u.SendMail {
			continue
		}
		result.TotalUsers++
		if !reminderDue(u, now, matchMinute) {
			continue
		}
		if err := s.sendNotification(ctx, u); err != nil {
			s.log.Warn("reminder delivery failed")
			continue
		}
		result.NotifiedUsers = append(result.NotifiedUsers, u.UserID)
	}
	return result
}

func (s *server) testNotification(w http.ResponseWriter, r *http.Request) {
	u, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	var body struct {
		Subject  string `json:"subject"`
		Text     string `json:"text"`
		TGChatID string `json:"tg_chat_id"`
	}
	if !decode(w, r, &body) {
		return
	}
	if u.TGChatID == nil || body.TGChatID == "" || body.TGChatID != *u.TGChatID {
		problem(w, 403, "Cannot notify another user")
		return
	}
	if err := s.sendNotification(r.Context(), u); err != nil {
		problem(w, 502, "Telegram notification failed")
		return
	}
	jsonResponse(w, 200, map[string]string{"message": "notification has been sent"})
}

func (s *server) forceNotifications(w http.ResponseWriter, r *http.Request) {
	now := time.Now().UTC()
	weekday, hour := r.URL.Query().Get("weekday"), r.URL.Query().Get("hour")
	if weekday != "" || hour != "" {
		day, errDay := intQuery(r, "weekday", 0, 6)
		h, errHour := intQuery(r, "hour", 0, 23)
		if errDay != nil || errHour != nil {
			problem(w, 422, "weekday (0-6) and hour (0-23) must be supplied together")
			return
		}
		currentDay := (int(now.Weekday()) + 6) % 7
		now = now.AddDate(0, 0, day-currentDay)
		now = time.Date(now.Year(), now.Month(), now.Day(), h, 0, 0, 0, time.UTC)
	}
	result := s.notifications(r.Context(), now, false) // Admin forcing retains the old hour-based selection.
	jsonResponse(w, 200, struct {
		Message string `json:"message"`
		notificationResult
	}{"ok", result})
}
