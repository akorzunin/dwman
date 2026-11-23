# Host migrations

For routine verified rclone cloud snapshots, see [DWMan backups](backup.md)
and `backup.yml` (reuses the infrastructure backup role).

Service identity is owned here, not by a VM: **https://test-dwman.duckdns.org**.
`test.yml` selects source/destination **inventory aliases** (`ge2` → `dyn1`),
port 8088 and the test environment. Override with `-e migration_source=...` /
`-e migration_destination=...` on the next move. The workflow is deliberately
supervised, not automatic failover. The ge2 → dyn1 migration was completed on
2026-11-23; see [the migration record](migration-2026-11-23.md).

## Credentials and boundaries

- Inventory, verified SSH identities, sudo, Docker and VPN services remain in
  `../../ansible-playbooks`. Commands below run **from this `deploy/` directory**.
- `ansible.cfg` enables strict host-key checking and the Vault-backed SSH agent.
  Do not use the infrastructure's default `host_key_checking=False` for migration.
  Check inventory connection overrides also retain verified destination pins.
- `migration_external_vars_file` selects `~/Dropbox/ssh/external_vars.yml`, the
  current shared Vault source (the infrastructure-local copy lacks DuckDNS).
  Override the path in `test.yml` on other controllers. Only cutover loads its
  Vault-backed `DUCKDNS_TOKEN`, on the controller, with
  logging suppressed. Keep one source of truth; don't copy the account token into
  this repository or GitHub. Override that path for a future dedicated service Vault.
- Spotify/app secrets are taken from the source container and persisted in a
  destination `.env` with mode 0600. Normal `deploy.yml` now also persists settings,
  so later `docker compose` operations don't depend on an old CI process environment.
- Encrypted full-data snapshots go to ignored `.local/migrations/`. The directory
  is local, **not an off-host backup**: copy the Vault archive to protected backup
  storage and retain its password separately. Temporary plaintext archives are
  deleted in `always`; a killed controller or lost SSH connection can prevent
  cleanup. Inspect `/tmp/dwman-migration-*`, the source tempfile reported by Ansible,
  and destination `migration-data.tar` after interruption. Do not print DB records.

Requires Ansible 12/Core 2.19+, Docker Compose with `--wait`, controller PyYAML
(for offline tests), and Python 3/tar/Docker on both hosts. Use one controller;
there is no distributed lock. Run offline checks with:

```sh
python3 -m unittest discover -s . -p 'test_*.py'
ansible-lint migrate.yml migration-stage.yml migration-cutover.yml prepare-https.yml deploy.yml github-handoff*.yml
```

## 1. One-time hostname / Spotify setup

The DuckDNS name `test-dwman.duckdns.org` must belong to the account of
`DUCKDNS_TOKEN`. There must be no AAAA record (this workflow switches IPv4 only).
The playbook refuses stale IPv6 rather than clearing account DNS implicitly.

In the **existing test Spotify application's dashboard**, add exactly:

```text
https://test-dwman.duckdns.org/get_token
```

Save it before migration; leave the old callback for rollback. Do not create a
new Spotify client or rotate its secret as part of a host move. Spotify requires
an exact registered redirect URI, including path/scheme/trailing slash. Setting
an application environment variable does **not** update Spotify's allowlist.
This workflow intentionally doesn't automate the dashboard with browser cookies.
See https://developer.spotify.com/documentation/web-api/concepts/redirect_uri.
After this first setup, future moves retain the same callback.

## 2. Prepare HTTPS without breaking dyn1 VPN

A dedicated dyn1 VPN binds 80/443 itself. Do **not** start another Caddy on those
ports. The existing infrastructure `vpn_node` role supports a shared Caddy/layer4
router that passes the VPN hostname through and terminates application TLS.
No infrastructure files need to be edited by the migration playbook.

Stage only the service site and persistent proxy directories (no service starts):

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass \
  prepare-https.yml -e migration_prepare_https=true
```

`dyn1-https.yml` opts the infrastructure into shared HTTPS. It uses
`caddy-sites.caddy` to import the staged `/etc/caddy/sites/*.caddy` files without
replacing VPN SNI routes. Paths in that vars file assume sibling repositories.
For the already-provisioned, verified dyn1, run the infrastructure's supported
VPN deployment/provision entry point with the extra vars file, e.g. **from the
infrastructure repository**, following its lifecycle prerequisites:

```sh
ansible-playbook -i hosts --vault-password-file .ansible_pass \
  infra/cherry-vpn/provision.yaml -e dyn_node=dyn1 \
  -e @../dwman/deploy/dyn1-https.yml
```

This is a **separate supervised infrastructure operation**, not part of data
migration: it may recreate VPN containers and publish profiles. It must not
allocate/replace an existing VM unexpectedly; review its normal lifecycle checks.
The infrastructure now also persists this mode in `node/dyn1/vpn.yaml`, loaded
by its dynamic-node deployment. Keep that configuration and the shared site import
on subsequent runs, including rebuilds, or dedicated VPN mode could reclaim 443. For a different/shared node, integrate
`import /etc/caddy/sites/*.caddy` into its own site-only Caddy source using the
infrastructure's existing patterns; do not reuse dyn1 paths blindly.

Verify VPN checks still pass. The new application site can return 502 or have
pending ACME before DNS moves; that is expected. Migration preflight checks the
running router knows the service hostname/backend, never replaces its config.

## 3. Freeze deployments and preflight

Pause deploy Actions while keeping CI checks available; ensure no deploy is in
flight (the current workflow can cancel in-progress runs). Do not push a deploy
branch until the GitHub handoff is complete. Both stage/cutover require explicit
acknowledgements; they cannot prove that CI was really paused or Spotify saved.

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass migrate.yml
```

Default `preflight` makes no persistent/service/DNS changes. It checks source
mount/settings, empty destination, prepared Caddy, and public IPv4/no IPv6.
Never use `--limit` or `--check`; guard tasks must execute.

## 4. Stage: stop, snapshot, copy, start destination

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass migrate.yml \
  -e migration_action=stage -e migration_confirm=ge2:dyn1:test \
  -e migration_ci_paused=true -e migration_spotify_registered=true
```

Only `dwman-test` on ge2 stops; main and other services are untouched. The full
`data/` directory is archived after stopping, its JSON validated, the snapshot
Vault-encrypted, SHA256 compared across hosts, and restored files compared with
tar before startup. Existing destination container/data is rejected, including
partial prior attempts: **stage is intentionally not blindly rerunnable**.

The destination pulls the **source image's immutable registry digest**, retaining
its effective container healthcheck (including the old Python image). Don't combine a host
move and a backend upgrade. Custom ports/data paths or images without a healthcheck
are rejected. The destination uses the stable URL and passes container/local HTTP
health checks. DNS is **unchanged**, the source stays stopped. The destination can
send Telegram reminders now; never run the source in parallel. Failed stage does
not automatically restart anything: a newly rotated token/write must not be lost.

## 5. Cut over service DNS, then CI

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass migrate.yml \
  -e migration_action=cutover -e migration_confirm=ge2:dyn1:test \
  -e migration_ci_paused=true -e migration_spotify_registered=true
```

Requires a healthy staged destination, matching staging receipt, and stopped
source. Updates **only `test-dwman`**, not `akorz-dyn1`/`akorz-ge2`, using an
explicit public IPv4. Waits for DNS, valid public TLS, `/health`, and a login
redirect containing the stable callback. ACME happens after DNS moves: expect
**downtime during staging/DNS propagation/certificate issuance**, not a seamless
migration. Use DNS-01 certificate staging before requiring zero downtime.

If cutover fails, DNS may already point to dyn1. Keep source stopped and CI paused;
inspect and retry cutover after fixing the issue. No automatic DNS rollback.

Manually verify Spotify login, preserved settings, refresh, playlist saving and
Telegram. Then use the controller's authenticated `gh` CLI through Ansible to
update **only the GitHub `test` environment**, not main/repository credentials.
Preview (GitHub read-only; no live host access):

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass github-handoff.yml
```

Apply after validation while CI is still paused:

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass github-handoff.yml \
  -e migration_github_apply=true -e migration_confirm=ge2:dyn1:test \
  -e migration_ci_paused=true -e migration_spotify_registered=true \
  -e migration_app_validated=true
```

The handoff checks for active branch workflows, stopped source, healthy destination,
a matching staging receipt, correct DNS and valid public TLS before any write.
It builds a portable **one-host** inventory with the target's private key (no local
key-file/known-hosts paths), Vault-encrypts that inventory, and uploads the inventory,
Vault password and existing trusted host pins through stdin with logging suppressed.
The scoped inventory enables noninteractive sudo because dyn1's administrator
has no direct Docker socket access. SSH extra args leave the action's common args
free to select its uploaded `known_hosts` file.
It never uses `ssh-keyscan`. `migration_github_key_file` and
`migration_github_known_hosts_file` are configurable in `test.yml`; the latter
currently selects dyn1's applied-state pins. No Spotify/API/Telegram secrets or
`IGNORE_CORS` are changed. Values written:

| Setting | Value |
| --- | --- |
| `SERVER_GROUP` | `dyn1` |
| `DEPLOY_URL` | `https://test-dwman.duckdns.org` |
| `PORT` | `8088` |
| `ANSIBLE_HOSTS` secret | Scoped inventory containing only dyn1 and its Vault-backed SSH key |
| `ANSIBLE_PASS` secret | Matching Vault password |
| `SSH_KNOWN_HOSTS` secret | Independently verified/pinned dyn1 administrator host key |

Keep existing Spotify/API/Telegram secrets. Do not upload the full infrastructure
inventory. The scoped account still grants Docker/sudo access, not app-only access.
The GitHub API cannot retrieve old secret values, so this multi-setting handoff
is **not atomic**. Keep CI paused on failure and rerun after fixing the issue.
It does not dispatch/resume workflows automatically. Resume deploys only after
this handoff. The first normal CI deployment replaces
the migration Compose/image with the branch's Go image: validate that upgrade
separately per `../docs/backend.md` if the migrated source was Python.

## Rollback / failed attempt

1. Keep CI paused; **stop destination `dwman-test` first**, even after failed stage.
   Verify it is stopped. Do not remove destination data or the encrypted snapshot.
2. Decide which database is current. Once destination ran, reminders, token refresh
   and user writes may have changed it. Prefer transferring its latest stopped
   `data/` back with a new protected snapshot; reconcile before starting source.
   The old source copy is only a pre-migration snapshot, not guaranteed current.
3. Before DNS cutover, restarting the source with its original settings restores
   its old URL. After cutover, restore the service DNS record to the source's
   verified IPv4 with the shared token, configure the stable hostname on source
   Caddy and set its `.env` callback/link to the stable URL (or deliberately revert
   to the still-registered old callback and old URL). Verify TLS and OAuth.
4. Restore GitHub test target/inventory/pins/URL accordingly, then resume CI.
   Never use `docker compose down -v`, overwrite data, or start both copies.
5. To retry stage, first archive/inspect the partial destination, stop/remove only
   its application container, and move its `data/` aside explicitly. Stage refuses
   overwrites by design. Do not delete a newer database just to satisfy the guard.

Keep old data/snapshots until validation is complete. Retire old app routing and
container separately; node deletion must not be allowed to erase the only copy.
