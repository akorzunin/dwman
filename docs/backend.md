# Go backend

## Scope

- OAuth login/callback with server-generated state and the configured redirect URI.
- Token refresh, including persisted Spotify refresh-token rotation.
- Spotify GET/POST proxy used by the existing browser client. Queries, request bodies,
  response status/content type, and `Retry-After` survive proxying. Responses stream
  instead of being buffered in application memory.
- User creation, self-only reads/updates, and admin list/delete/force-notification APIs.
- Weekly Telegram reminders and authenticated test notifications.
- Built frontend, health endpoint, authenticated Swagger UI, and embedded OpenAPI.

Playlist collection/creation remains in the frontend. The unused backend auto-save
algorithm, print-only email sender, template dependency, and legacy scheduler were
removed along with the Python runtime/tooling. Fields such as `send_mail`, `email`,
`save_full_playlist`, and `filter_dislikes` remain API/database-compatible; `send_mail`
now only means enabling Telegram reminders, not sending email.

`internal/backend/openapi.json` is the checked-in API contract, originally exported
from the Python app. Update it alongside handler changes; the Go app serves it without
runtime schema generation. The public `User` schema excludes credentials. The existing
`pnpm --dir web run generate-api` command works against the running local backend.

## Configuration

The binary reads the environment, not `.env`. Task loads `.env` for local runs;
Docker Compose uses `env_file`. Existing deployment variable names remain valid.

| Variable | Default / purpose |
| --- | --- |
| `SPOTIPY_CLIENT_ID`, `SPOTIPY_CLIENT_SECRET` | Required Spotify app credentials |
| `SPOTIPY_REDIRECT_URL` | Required absolute callback URL registered with Spotify |
| `API_LOGIN`, `API_PASSWORD` | Required admin HTTP Basic credentials |
| `TG_BOT_TOKEN` | Required only to deliver Telegram notifications |
| `DEPLOY_URL` | Link in reminders; defaults to `http://localhost:8000` |
| `HTTP_PORT` | Internal listening port, default `8000` |
| `UVICORN_PORT` | Legacy fallback when `HTTP_PORT` is unset |
| `DATA_PATH` | `data/db.json` |
| `IGNORE_CORS` | `false`; enable only for cross-origin development |
| `LOG_LEVEL` | `INFO`; logs are structured JSON |

Compose's `PORT` still controls the **host** mapping, not the internal port.
The Docker image contains only the binary, CA certificates, and compiled frontend.
Its healthcheck is `/app/dwman healthcheck`; no shell, Python, or curl is required.
Do not reduce the existing 100 MiB container limit until real Spotify traffic has
been measured on the target host.

## Migration and rollback

No live deployment was changed during implementation.

1. Build and test locally: `go test -race ./...`, `go vet ./...`, and
   `docker build -t dwman:go-local .`.
2. Stop the old instance before touching its database. Keep a protected copy of
   `data/db.json` **and the old image tag**. The database contains Spotify credentials.
3. Mount a **copy** of that database into a separate test container. Use the test
   Spotify app/redirect URL. To avoid sending real reminders during validation,
   disable `send_mail` in the test copy or leave `TG_BOT_TOKEN` unset.
4. Verify login, old credentials, settings, token refresh/rotation, playlist saving,
   and Telegram test delivery. Compare memory during actual playback polling.
5. Replace the old container using the new image and updated `deploy/compose.yml`.
   Keep only one database writer. The updated healthcheck no longer calls curl.
6. Roll back by stopping Go and restoring the old image plus its matching Compose
   healthcheck. TinyDB document IDs and unrelated tables are retained, and the known
   user fields remain Python-readable. Prefer the latest database after token
   rotation: restoring an older token backup may require Spotify login again.

The store fails startup on malformed JSON, invalid document IDs, or duplicate user
IDs rather than resetting data. Updates use a locked copy, a same-directory temporary
file, file sync, and atomic rename. Files are written with mode `0600`; ensure backups
and container users have appropriate access. As with the old image, the container
runs as root to keep existing bind-mount ownership compatible.

## Deliberate limits and behavior changes

- One process, global store lock, linear lookup, whole-file writes. Appropriate for
  the measured one-user database; use SQLite transactions before adding replicas or
  growing the user base. No additional database service or migration framework.
- Legacy bcrypt `$2b$` hashes and the browser's 72-byte refresh-token-prefix password
  are supported. The existing client-selected registration identity and readable
  browser token cookies are retained for compatibility, not redesigned as sessions.
  A future BFF/session change should verify identity at registration and keep tokens
  server-side; this rewrite is not that authentication redesign.
- The minute-aligned reminder loop honors the configured timezone offset and minute.
  The old hourly loop ignored both. No retry ledger or downtime catch-up; delivery
  is sequential, so slow deliveries can miss later polling slots at larger scale.
  Use a persisted delivery queue if reliable catch-up or higher throughput is needed.
- Admin force-notification keeps hour-based selection (weekday `0` is Monday).
  If overriding time, both weekday and hour are required; hour must be `0..23`.
- Failed Telegram delivery returns an error instead of claiming success.
- Health requests are not logged. Access logs contain route patterns rather than
  URLs/query strings, so OAuth codes/state and user IDs are not copied into logs.
- Network requests have deadlines, request bodies are bounded, and upstream error
  bodies/transport errors are not included in API errors or logs.

## Measurements

Read-only baseline on `ge2`, 2026-11-01: `dwman-test` at commit `db8c4a8` used
**73.18 MiB** according to Docker, **80.5 MiB RSS**, with a 100 MiB limit.
It had one user in a 682-byte database, no restarts/OOMs, and about 5.5 hours of logs.
This is a snapshot, not evidence of a memory leak.

Local isolated native processes, same machine, empty test databases, dummy credentials,
then 1,000 sequential keep-alive `/health` requests:

| Process | Idle RSS | RSS after requests |
| --- | ---: | ---: |
| Original Python backend | 74.5 MiB | 80.5 MiB |
| Go backend (stripped build) | 12.5 MiB | 17.5 MiB |

A local Go Docker smoke run, with the existing 100 MiB limit, user creation/settings
requests and 1,000 health requests, reported **10.3 MiB** Docker memory usage. The
image was **8.9 MB** uncompressed. Docker accounting and native RSS are not identical
metrics. These synthetic checks do **not** establish production peak memory or real
Spotify/OAuth compatibility; validate those on the test deployment before rollout.
