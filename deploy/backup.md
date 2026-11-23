# DWMan cloud backups with rclone

Select the **current live host** explicitly, independently of the last migration.
No backup is scheduled automatically.

## Live database only (controller upload)

Use `backup-db.yml` on a running Go deployment when you only need `db.json`.
The Go store replaces the file atomically, so the playbook reads one complete
version without stopping DWMan. Ansible Vault encrypts it on the controller
before rclone uploads it, and `rclone check --download` verifies the stored
ciphertext. No rclone configuration or cloud credentials are needed on dyn1.
This does not back up `.env`, Compose files, or certificates.

From `deploy/`, with a working controller `dropbox-remote`:

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass \
  backup-db.yml -e backup_target=dyn1
```

Override `backup_db_remote_root` to use a different controller remote and prefix.
The encryption password file defaults to `migration_vault_password_file` in
`test.yml`. Keep that password separately from the cloud backup. The playbook
prints the exact object and encrypted SHA256. To inspect or restore, download
that object with `rclone copyto` into a private directory, verify the checksum,
and decrypt to a separate mode-0600 file (`umask 077` and
`ansible-vault decrypt --vault-password-file ... --output db.json snapshot.json.vault`).
Validate off-host; stop the target app and preserve its existing data before
replacing any live DB.

First verified live run (2026-11-23, dyn1, one user record):

```text
dropbox-remote:ssh/dwman/backups/dyn1/dwman-test/db-20261123T180609Z-dwman-db-ku8t0_59.json.vault
SHA256 dcd8f15760c4676f73fb96f49d08240cf2ffe7e8c3c323acd6e68d018bcd9675
```

The Vault round trip and Dropbox readback passed; DWMan stayed running.

## Full deployment backup (source-host upload)

`backup.yml` reuses `../ansible-playbooks/roles/backup`. Use it when you need the
full deployment tree or are backing up an older app that writes DB files in place.
The snapshot includes `/srv/deploy/dwman-test/`: the full `data/` directory
(including `db.json`), Compose definition, `.env`, and recovery metadata. Keeping
these together is more useful for recovery than a DB file without its configuration.
Other application environments, VPN services and the rest of `/srv/deploy` are not
selected. The role discovers all containers sharing the selected storage and
refuses omitted writable external volumes instead of silently losing them.

## Prerequisites and encryption

On the source host: rclone, GNU tar, Python 3 and Docker, passwordless sudo, and
an existing authenticated rclone configuration. The playbook does not install
software or create/replace a cloud remote. On the controller: both repositories,
the verified host pins, Ansible and the existing Vault-backed inventory/key.

**The archive contains Spotify refresh tokens, application secrets, and container
inspection metadata. Tar/gzip and its SHA256 sidecar are not encryption.** The
migration workflow's Vault encryption does not apply to this role's cloud backups.
Use a trusted private encrypted destination; for client-side encryption, select
an existing **rclone `crypt` remote** and retain its password/salt separately from
cloud storage. Do not assume an arbitrary rclone remote encrypts data at rest.
Never commit an rclone configuration or pass credentials with `-e`/CLI arguments.

At implementation time dyn1 had **neither rclone installed nor the default config**
`/home/vpnadmin/.config/rclone/rclone.conf`. No full deployment upload was
attempted. Provision a trusted remote/config first; the playbook fails
its tool/cloud checks before stopping the application if they are missing.
The infra repository also has a `rclone` installation/setup role, but this wrapper
intentionally does not run its config-creation tasks or overwrite any existing
credentials. Reuse a securely provisioned config with the paths below.

## Run

From this `deploy/` directory, with the standard remote/config:

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass \
  backup.yml -e backup_target=dyn1 -e backup_confirm=dyn1:test
```

Role defaults: remote `backup-remote`, config
`/home/<ansible_user>/.config/rclone/rclone.conf`. To select an existing encrypted
remote or a root-owned configuration explicitly:

```sh
ansible-playbook -i ../../ansible-playbooks/hosts \
  --vault-password-file ../../ansible-playbooks/.ansible_pass \
  backup.yml -e backup_target=dyn1 -e backup_confirm=dyn1:test \
  -e backup_remote_name=backup-crypt \
  -e backup_rclone_config_path=/root/.config/rclone/rclone.conf
```

Change `backup_target` on future host moves. For a different environment, also pass
`-e migration_environment=main` and the matching `backup_confirm=<host>:main`.
Do not use `backup_paths` to broaden this wrapper to the whole host; use the
infrastructure's generic backup playbook for unrelated services.

Run only one backup/migration/deployment at a time. Pause deployment Actions or
otherwise ensure no deploy is in flight while taking the snapshot. There is no
distributed operation lock. `--check` is rejected: it cannot verify cloud backups.

## Behavior

1. Check tools, selected storage and cloud access **before downtime**.
2. Record exactly which relevant containers were running, stop those containers,
   and take a filesystem-consistent archive in root-only `/var/tmp` staging.
3. Restart the same container IDs in `always`, before uploading. Previously stopped
   containers stay stopped. Wait for running/healthy recovery.
4. Read/decompress all archive members and report DWMan JSON/table counts without
   printing records. Malformed/empty JSON is preserved with a warning, not repaired;
   a transport-successful backup need not contain a usable database.
5. Upload archive and SHA256 sidecar with `rclone copyto --immutable`. Download
   cloud bytes with `rclone check --download --one-way` to verify the upload.
6. Print the exact cloud object and SHA256, then remove staging only after success.

Default object layout:

```text
backup-remote:/backups/dyn1/dwman-test/dwman-test-service-backup-<unique-id>.tar.gz
backup-remote:/backups/dyn1/dwman-test/dwman-test-service-backup-<unique-id>.tar.gz.sha256
```

With `backup_remote_name=backup-crypt`, the same logical paths are under that
remote; rclone encrypts filenames/content according to its existing crypt config.
No `sync`, retention deletion, or overwrite of old backup objects is performed.
Disk space on the source must accommodate a full archive.

On failure, private staging is retained for recovery. A controller crash/lost
connection can bypass Ansible `always`: inspect the reported staging directory's
`metadata/containers.json` and restart **only its originally running IDs**. Never
start ge2's retired test container simply because it is stopped. Non-Docker
writers must be quiesced separately; this role cannot discover them.

## Recovery

Use the **exact cloud object path printed by the successful run**, not a guessed
filename. On a trusted recovery machine with the same remote (and crypt keys if
applicable), download the archive and sidecar into a private directory, compare
SHA256, test gzip, and extract into an isolated directory. The archive contains
paths relative to `/` and private `metadata/containers.json`.

Follow the infrastructure's [safe restore instructions](../../ansible-playbooks/node/backup/readme.md#restore-safely).
Never extract directly over `/` or a running database. Validate JSON and test an
isolated copy before stopping the target app, protecting its current data, and
restoring with appropriate ownership/modes. Token rotation can make an older
snapshot stale; prefer the latest verified copy. Keep only one live writer and
one active Telegram reminder instance after restoration.
