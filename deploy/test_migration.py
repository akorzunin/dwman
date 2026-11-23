"""Offline migration guards and Compose rendering; never loads real inventory/secrets."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import yaml

DEPLOY = Path(__file__).resolve().parent
ENV = {**os.environ, "ANSIBLE_CONFIG": str(DEPLOY / "ansible.cfg")}


class MigrationTests(unittest.TestCase):
    def run_play(self, path, *args):
        return subprocess.run(
            ["ansible-playbook", "-i", "localhost,", str(path), *args],
            env=ENV, text=True, capture_output=True, timeout=60,
        )

    def test_syntax(self):
        for name in ("migrate.yml", "prepare-https.yml", "deploy.yml", "github-handoff.yml", "backup.yml", "backup-db.yml"):
            with self.subTest(name=name):
                result = self.run_play(DEPLOY / name, "--syntax-check")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_unsafe_calls_fail_before_remote_tasks(self):
        for extra in (
            {"migration_source": "missing"},
            {"migration_source": "localhost", "migration_destination": "localhost"},
            {"migration_action": "delete"},
        ):
            with self.subTest(extra=extra):
                result = self.run_play(DEPLOY / "migrate.yml", "-e", json.dumps(extra))
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Inspect both application containers", result.stdout)

    def test_stage_requires_confirmation_before_touching_hosts(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = Path(directory) / "hosts.yml"
            inventory.write_text("all:\n  hosts:\n    ge2: {}\n    dyn1: {}\n")
            result = self.run_play(
                DEPLOY / "migrate.yml", "-i", str(inventory),
                "-e", "migration_action=stage",
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Require acknowledgement", result.stdout)
            self.assertNotIn("Inspect both application containers", result.stdout)

    @unittest.skipUnless(shutil.which("docker"), "Docker Compose required")
    def test_persisted_settings_survive_compose_interpolation(self):
        secret = 'spaces \\"quote\\" $word ${UNSET} # hash \\ slash\nnewline'
        source = {
            "Config": {"Env": [f"API_PASSWORD={secret}", "SPOTIPY_CLIENT_ID=client"]}
        }
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            tasks = yaml.safe_load((DEPLOY / "migration-stage.yml").read_text())
            block = next(t["block"] for t in tasks if "block" in t)
            template = next(
                t["ansible.builtin.copy"]["content"] for t in block
                if t["name"].startswith("Persist source application")
            )
            compose_task = next(t for t in block if t["name"].startswith("Install the migration Compose"))
            source["Config"]["Healthcheck"] = {
                "Test": ["CMD", "/app/dwman", "healthcheck"],
                "Interval": 30000000000, "Timeout": 5000000000, "Retries": 5,
            }
            compose_vars = compose_task["vars"]
            shutil.copy(DEPLOY / "migration-compose.yml", directory / "migration-compose.yml")
            play = [{
                "hosts": "localhost", "connection": "local", "gather_facts": False,
                "vars": {
                    "migration_source_info": source,
                    "migration_image": {"stdout": json.dumps([{"RepoDigests": ["example/app@sha256:" + "a" * 64]}])},
                    "migration_environment": "test", "migration_port": 8088,
                    "migration_url": "https://test-dwman.duckdns.org",
                },
                "tasks": [
                    {"name": "Render settings", "ansible.builtin.copy": {
                        "dest": str(directory / ".env"), "content": template, "mode": "0600",
                    }},
                    {"name": "Render effective source healthcheck", "vars": compose_vars,
                     "ansible.builtin.copy": {
                         "dest": str(directory / "compose.yml"), "mode": "0644",
                         "content": compose_task["ansible.builtin.copy"]["content"],
                     }},
                ],
            }]
            path = directory / "render.yml"
            path.write_text(yaml.safe_dump(play))
            result = self.run_play(path)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            result = subprocess.run(
                ["docker", "compose", "config", "--format", "json"],
                cwd=directory, text=True, capture_output=True, timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            service = json.loads(result.stdout)["services"]["dwman"]
            # `compose config` escapes dollar signs for round-trip YAML/JSON;
            # interpolation's actual values are reported by --environment.
            self.assertEqual(service["environment"]["API_PASSWORD"].replace('$$', '$'), secret)
            interpolation = subprocess.run(
                ["docker", "compose", "config", "--environment"],
                cwd=directory, text=True, capture_output=True, timeout=30,
            )
            self.assertEqual(interpolation.returncode, 0, interpolation.stderr)
            self.assertIn('API_PASSWORD=' + secret + '\n', interpolation.stdout)
            self.assertEqual(service["environment"]["SPOTIPY_REDIRECT_URL"],
                             "https://test-dwman.duckdns.org/get_token")
            self.assertEqual(service["ports"][0]["host_ip"], "127.0.0.1")
            self.assertEqual(service["healthcheck"]["test"], source["Config"]["Healthcheck"]["Test"])
            self.assertEqual(service["healthcheck"]["retries"], 5)
            self.assertEqual((directory / ".env").stat().st_mode & 0o777, 0o600)

    def test_github_handoff_requires_confirmation_before_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            inventory = directory / "hosts.yml"
            inventory.write_text("all:\n  hosts:\n    ge2: {}\n    dyn1: {}\n")
            gh = directory / "gh"
            gh.write_text(
                '#!/usr/bin/env python3\nimport sys\n'
                'if sys.argv[1:3] == ["variable", "list"]: print("[]")\n'
                'elif sys.argv[1:3] == ["api", "repos/akorzunin/dwman/environments/test"]: print("test")\n'
                'else: raise SystemExit(99)\n'
            )
            gh.chmod(0o700)
            result = subprocess.run(
                ["ansible-playbook", "-i", str(inventory), str(DEPLOY / "github-handoff.yml"),
                 "-e", "migration_github_apply=true"],
                env={**ENV, "PATH": str(directory) + os.pathsep + os.environ["PATH"]},
                text=True, capture_output=True, timeout=60,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Require migration and deployment freeze", result.stdout)
            self.assertNotIn("Upload only the scoped inventory", result.stdout)

    def test_vault_encrypted_inventory_loads_like_the_ci_action(self):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            password = directory / "password"
            password.write_text("offline-test-password")
            password.chmod(0o600)
            inventory = {"all": {"hosts": {"destination": {
                "ansible_host": "192.0.2.1", "ansible_private_key": "dummy-key",
            }}}}
            encrypted = subprocess.run(
                ["ansible-vault", "encrypt", "--vault-password-file", str(password), "--output", "-"],
                input=yaml.safe_dump(inventory), text=True, capture_output=True, env=ENV, timeout=30,
            )
            self.assertEqual(encrypted.returncode, 0, encrypted.stderr)
            self.assertTrue(encrypted.stdout.startswith("$ANSIBLE_VAULT;"))
            path = directory / ".ansible_inventory"
            path.write_text(encrypted.stdout)
            loaded = subprocess.run(
                ["ansible-inventory", "-i", str(path), "--vault-password-file", str(password), "--list"],
                text=True, capture_output=True, env=ENV, timeout=30,
            )
            self.assertEqual(loaded.returncode, 0, loaded.stderr)
            hostvars = json.loads(loaded.stdout)["_meta"]["hostvars"]
            self.assertEqual(set(hostvars), {"destination"})
            # Newer Ansible versions redact values from encrypted inventory output.
            self.assertIn(hostvars["destination"]["ansible_host"], ("192.0.2.1", "$REDACTED$"))
            self.assertIn(hostvars["destination"]["ansible_private_key"], ("dummy-key", "$REDACTED$"))

    def test_github_secrets_stay_scoped_and_use_stdin(self):
        tasks = yaml.safe_load((DEPLOY / "github-handoff-apply.yml").read_text())
        secret_tasks = [t for t in tasks if t.get("ansible.builtin.command", {}).get("argv", [])[:3]
                        == ["gh", "secret", "set"]]
        self.assertEqual(len(secret_tasks), 2)
        for task in secret_tasks:
            self.assertTrue(task["no_log"])
            command = task["ansible.builtin.command"]
            self.assertIn("--repo", command["argv"])
            self.assertIn("--env", command["argv"])
            self.assertNotIn("--body", command["argv"])
            self.assertIn("stdin", command)
        host = next(t["ansible.builtin.set_fact"]["migration_github_host"]
                    for t in tasks if t["name"].startswith("Build a portable"))
        self.assertIn("ansible_private_key", host)
        self.assertNotIn("ansible_ssh_private_key_file", host)
        self.assertTrue(host["ansible_host_key_checking"])
        self.assertTrue(host["ansible_become"])
        self.assertEqual(host["ansible_become_flags"], '-n')
        self.assertNotIn('ansible_ssh_common_args', host)
        self.assertIn('StrictHostKeyChecking=yes', host['ansible_ssh_extra_args'])

    def test_github_inventory_alias_is_actually_rendered(self):
        tasks = yaml.safe_load((DEPLOY / "github-handoff-apply.yml").read_text())
        build = next(t for t in tasks if t["name"] == "Build the inventory with a resolved host alias")
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            out = directory / "inventory.yml"
            play = [{"hosts": "localhost", "connection": "local", "gather_facts": False,
                     "vars": {"migration_destination": "dyn1", "migration_github_host": {"ansible_host": "192.0.2.1"}},
                     "tasks": [build, {"name": "Write dummy inventory", "ansible.builtin.copy": {
                         "dest": str(out), "content": "{{ migration_github_inventory | to_nice_yaml }}", "mode": "0600",
                     }}]}]
            path = directory / "render.yml"
            path.write_text(yaml.safe_dump(play))
            result = self.run_play(path)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(set(yaml.safe_load(out.read_text())["all"]["hosts"]), {"dyn1"})

    def test_backup_rejects_missing_or_broad_target_and_unconfirmed_run(self):
        for extra in ({}, {"backup_target": "all"}, {"backup_target": "localhost"}):
            with self.subTest(extra=extra):
                result = self.run_play(DEPLOY / 'backup.yml', '-e', json.dumps(extra))
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('Reuse the infrastructure', result.stdout)
        with tempfile.TemporaryDirectory() as directory:
            inventory = Path(directory) / 'hosts.yml'
            inventory.write_text('all:\n  hosts:\n    dyn1:\n      ansible_connection: local\n')
            result = self.run_play(DEPLOY / 'backup.yml', '-i', str(inventory), '-e', 'backup_target=dyn1')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Require acknowledgement', result.stdout)
            self.assertNotIn('Reuse the infrastructure', result.stdout)

    def test_live_db_backup_rejects_local_destination_before_reading_db(self):
        with tempfile.TemporaryDirectory() as directory:
            inventory = Path(directory) / 'hosts.yml'
            inventory.write_text('all:\n  hosts:\n    dyn1:\n      ansible_connection: local\n')
            result = self.run_play(DEPLOY / 'backup-db.yml', '-i', str(inventory),
                                   '-e', 'backup_target=dyn1 backup_db_remote_root=/tmp/local')
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Require one explicit host', result.stdout)
            self.assertNotIn('Read the database once', result.stdout)

    def test_backup_wrapper_passes_only_app_paths_to_shared_role(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            role = root / 'roles/backup'
            (role / 'tasks').mkdir(parents=True)
            (role / 'defaults').mkdir()
            (role / 'defaults/main.yml').write_text(yaml.safe_dump({
                'backup_remote_name': 'backup-remote',
                'backup_dest_path': '{{ backup_remote_name }}:/backups/{{ inventory_hostname }}/{{ backup_service }}/snapshot.tar.gz',
            }))
            (role / 'tasks/main.yml').write_text(yaml.safe_dump([{
                'name': 'Assert wrapper arguments without Docker or cloud access',
                'ansible.builtin.assert': {'that': [
                    "backup_paths == ['/srv/deploy/dwman-test']",
                    "backup_service == 'dwman-test'",
                    "backup_dest_path == 'backup-remote:/backups/dyn1/dwman-test/snapshot.tar.gz'",
                ]},
            }]))
            inventory = root / 'hosts.yml'
            inventory.write_text('all:\n  hosts:\n    dyn1:\n      ansible_connection: local\n')
            extra = {'backup_target': 'dyn1', 'backup_confirm': 'dyn1:test',
                     'migration_infra_dir': str(root), 'ansible_become': False}
            result = self.run_play(DEPLOY / 'backup.yml', '-i', str(inventory), '-e', json.dumps(extra))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn('Assert wrapper arguments', result.stdout)

    def test_controller_plays_explicitly_use_ssh_for_remote_hosts(self):
        for filename in ('migrate.yml', 'github-handoff-apply.yml'):
            tasks = yaml.safe_load((DEPLOY / filename).read_text())
            if filename == 'migrate.yml':
                tasks = tasks[0]['tasks']
            transport = next(t['ansible.builtin.add_host'] for t in tasks if 'ansible.builtin.add_host' in t)
            self.assertEqual(transport['ansible_connection'], 'ssh')

    def test_plaintext_cleanup_and_dns_phase_separation(self):
        tasks = yaml.safe_load((DEPLOY / "migration-stage.yml").read_text())
        transfer = next(t for t in tasks if "block" in t)
        cleanup = transfer["always"]
        self.assertEqual(len(cleanup), 3)
        self.assertTrue(all(t["ansible.builtin.file"]["state"] == "absent" for t in cleanup))
        self.assertNotIn("duckdns.org/update", (DEPLOY / "migration-stage.yml").read_text())
        self.assertNotIn("docker, start", (DEPLOY / "migration-stage.yml").read_text())


if __name__ == "__main__":
    unittest.main()
