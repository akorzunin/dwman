# Test instance migration: ge2 → dyn1 (2026-11-23)

Completed supervised migration of **only `dwman-test`** to
**https://test-dwman.duckdns.org/** on dyn1 (`88.216.92.104`).
No main application deployment/database was changed. Spotify callback registration
was confirmed by the user; no dashboard changes were made by the agent.

## Data and image

- Source: ge2 (`94.249.187.177`), `/srv/deploy/dwman-test/data/`.
- Destination: dyn1, same directory, backend bound to loopback port 8088.
- Source stopped before archiving and remains stopped; its original data is retained.
- Complete archive transferred with matching SHA256 and restored files compared
  against tar before destination startup. Temporary plaintext archives were removed.
- At validation, both `db.json` copies were 609 bytes with one user and SHA256:

  ```text
  a4bf44718392f76ae69808b7c901a8b127ab20fde745f5198b45bc21f60a33cc
  ```

- Retained source image `akorzunin/dwman:sha-503008a` through its immutable
  repository digest. Both source/destination image IDs matched:

  ```text
  sha256:7b45b04d07237404d04da27d2534ed8b76b30ada22e48f22eaf9676a3b068277
  ```

  Source was already Go; no backend upgrade was performed.
- Vault-encrypted snapshot (archive SHA256 is in its filename):

  ```text
  .local/migrations/test-ae5034a4445e8e4169c3111c3cb9ab912dee8b8f9b5b54f46d1feeef3ebbc04f.tar.vault
  ```

  A byte-identical encrypted copy was placed in
  `~/Dropbox/ssh/dwman/migrations/`. This confirms a local Dropbox-folder copy,
  **not remote sync completion**. Keep the Vault password separately.

## HTTPS and VPN

Dyn1 previously had dedicated Naïve listeners on 80/443. Used the existing
infrastructure Caddy 2.11.4/layer4 build and shared-router template, changing only
Naïve's published ports to loopback 8089/8444 and starting shared Caddy on 80/443.
VLESS, tunnel SSH, their credentials and client profiles were not redeployed.
Original VPN Compose is retained at `/srv/deploy/vpn-node/compose.pre-dwman.yaml`.
No VM provisioning, allocation or provider change was performed.

Persistent infrastructure settings now live in
`../ansible-playbooks/node/dyn1/vpn.yaml`, automatically loaded on dynamic VPN
redeploys, and its site-only Caddy source imports `/etc/caddy/sites/*.caddy`.
The DWMan site snippet is `/srv/deploy/caddy/config/sites/dwman-test.caddy`.
Router candidate validation now mounts imported site snippets too.

Naïve and VLESS each passed two isolated HTTPS/expected-egress checks before
and after routing changes. VLESS passed UDP/STUN against Cloudflare and Google.
These are smoke checks, not a long-term stability/throughput measurement.

Only the `test-dwman` DuckDNS record was updated. No node DNS records changed.
This controller's current DuckDNS Vault is `~/Dropbox/ssh/external_vars.yml`;
its local infrastructure `external_vars.yml` lacks that key. Cutover used an
explicit `migration_external_vars_file` override; `test.yml` now selects that shared
path by default for future runs. Shared token trailing whitespace
is normalized, while embedded whitespace/undecrypted ciphertext remains rejected.

## GitHub Actions

Paused `ci-workflow` during transfer and handoff, then **re-enabled** it.
Updated only the `test` environment:

| Setting | Value |
| --- | --- |
| `SERVER_GROUP` | `dyn1` |
| `DEPLOY_URL` | `https://test-dwman.duckdns.org` |
| `PORT` | `8088` |
| `ANSIBLE_HOSTS` | Vault-encrypted one-host dyn1 inventory with noninteractive sudo |
| `ANSIBLE_PASS` | Matching Vault password |
| `SSH_KNOWN_HOSTS` | Dyn1 administrator pins from applied encrypted state |

Spotify/API/Telegram credentials and `IGNORE_CORS=1` are unchanged.

Missing controller keys were restored from the existing Vault; encrypted OpenTofu
state was restored to recover dyn1's applied host-key pin (no cloud apply).
Ge2's existing public host pins were recovered from the old GitHub environment
through a temporary Actions job; host-key checking was never disabled.

A temporary branch verified the uploaded credentials using the same Ansible action
as deployment. The successful **read-only** run connected to dyn1, verified that
only dyn1 was selected and checked container health:
[Actions run 45155762256](https://github.com/akorzunin/dwman/actions/runs/45155762256).
Earlier attempts exposed inventory alias templating, SSH common-args precedence,
and sudo requirements; all were corrected in `github-handoff-apply.yml`.
The temporary branch and public-pin artifact were deleted. No application branch
was pushed and no full application deployment was dispatched.

## Validation and remaining user check

Passed: matching DB hashes/image IDs, healthy destination container, public HTTPS
`/health`, built frontend `/app/`, authenticated admin user-list endpoint, stable
callback and reminder link configuration, public login redirect callback, and VPN
checks. Snapshot memory for DWMan was about 7 MiB (100 MiB limit retained).

**Still requires the user's browser:** complete Spotify sign-in, confirm settings,
refresh/playback and playlist saving. No real Telegram test message was sent.
The handoff's app-validation acknowledgement referred to the automated checks
above, not an end-to-end browser OAuth test.

Do not restart ge2's old container: the two instances share Telegram credentials,
and dyn1's database can now receive new writes/token rotations. For rollback,
stop dyn1 first and reconcile/transfer its latest data before restarting a source.
See [rollback procedure](README.md#rollback--failed-attempt).
