"""Safe unit coverage: subprocesses and elevated operations are mocked."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import types
import unittest
from unittest.mock import mock_open, patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sultan_operate", ROOT / "scripts" / "sultan-operate.py")
operate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operate)


class OperatorTests(unittest.TestCase):
    def test_exactly_four_fixed_operations(self):
        self.assertEqual(operate.ALLOWED, {"status", "health", "restart", "backup"})

    def test_invalid_arguments_fail_before_any_subprocess(self):
        with patch.object(operate.subprocess, "run") as run:
            for arguments in ([], ["status", "extra"], ["status; id"], ["docker"], ["backup --root /"], ["../health"]):
                with self.assertRaises(operate.OperationError):
                    operate.dispatch(arguments)
            run.assert_not_called()

    def test_unprivileged_direct_access_is_denied(self):
        with patch.object(operate.os, "geteuid", return_value=1001), patch.object(operate, "command") as command:
            with self.assertRaises(operate.OperationError):
                operate.dispatch(["health"])
            command.assert_not_called()

    def test_status_references_only_fixed_sultan_containers(self):
        state = '{"Status":"running","Health":{"Status":"healthy"},"Paused":false}'
        with patch.object(operate, "command", side_effect=[state, state, "e6f3a63"]) as command:
            result = operate.status()
            self.assertEqual(result["application"]["health"], "healthy")
            self.assertEqual(command.call_args_list[0].args[0][-1], operate.APPLICATION)
            self.assertEqual(command.call_args_list[1].args[0][-1], operate.DATABASE)
            self.assertEqual(command.call_args_list[2].args[0][-1], operate.APPLICATION)

    def test_subprocess_uses_fixed_environment_and_project(self):
        with patch.object(operate.subprocess, "run", return_value=types.SimpleNamespace(returncode=0, stdout="success\n")) as run:
            self.assertEqual(operate.command(["/usr/bin/true"]), "success")
            self.assertEqual(run.call_args.kwargs["env"], operate.ENVIRONMENT)
            self.assertEqual(run.call_args.kwargs["cwd"], "/opt/sultan-production")
            self.assertNotIn("shell", run.call_args.kwargs)

    def test_backup_uses_only_its_existing_service(self):
        with patch.object(operate.os, "geteuid", return_value=0), patch.object(operate, "command", side_effect=["", "success"]) as command:
            self.assertEqual(operate.dispatch(["backup"]), {"operation": "backup", "completed": True})
            self.assertEqual(command.call_args_list[0].args[0], ["/usr/bin/systemctl", "start", "sultan-backup.service"])

    def test_restart_is_denied_while_backup_or_deployment_owns_lock(self):
        with patch.object(operate.os, "geteuid", return_value=0), patch("builtins.open", mock_open()), patch.object(operate.fcntl, "flock", side_effect=BlockingIOError), patch.object(operate, "command") as command:
            with self.assertRaisesRegex(operate.OperationError, "backup or deployment"):
                operate.dispatch(["restart"])
            command.assert_not_called()

    def test_paused_application_cannot_be_restarted_by_operator(self):
        with patch.object(operate.os, "geteuid", return_value=0), patch("builtins.open", mock_open()), patch.object(operate.fcntl, "flock"), patch.object(operate, "status", return_value={"application": {"paused": True}}), patch.object(operate, "command") as command:
            with self.assertRaisesRegex(operate.OperationError, "paused"):
                operate.dispatch(["restart"])
            command.assert_not_called()

    def test_successful_restart_targets_only_the_sultan_application(self):
        state = {"application": {"paused": False, "health": "healthy"}, "database": {"health": "healthy"}}
        with patch.object(operate.os, "geteuid", return_value=0), patch("builtins.open", mock_open()), patch.object(operate.fcntl, "flock"), patch.object(operate, "status", return_value=state), patch.object(operate, "health") as health, patch.object(operate, "command") as command:
            self.assertTrue(operate.dispatch(["restart"])["completed"])
            command.assert_called_once_with(["/usr/bin/docker", "restart", "--time", "15", operate.APPLICATION], timeout=60)
            health.assert_called_once()

    def test_failed_subprocess_does_not_expose_output(self):
        with patch.object(operate.sys, "argv", ["sultan-operate", "status"]), patch.object(operate.os, "geteuid", return_value=0), patch.object(operate.subprocess, "run", return_value=types.SimpleNamespace(returncode=1, stdout="PRIVATE_TEST_VALUE", stderr="PRIVATE_TEST_VALUE")):
            output = io.StringIO()
            with contextlib.redirect_stderr(output):
                self.assertEqual(operate.main(), 1)
            self.assertNotIn("PRIVATE_TEST_VALUE", output.getvalue())

    def test_ssh_entrypoint_rejects_shell_and_extra_arguments(self):
        for value in ("", "id", "printf SULTAN_UNSCOPED_ACCESS", "status; id", "backup --root /", "sudo -n /usr/bin/true"):
            result = subprocess.run(["/bin/sh", str(ROOT / "config" / "ssh" / "sultan-ssh-entrypoint.sh")], env={"SSH_ORIGINAL_COMMAND": value}, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("SULTAN_UNSCOPED_ACCESS", result.stdout)


if __name__ == "__main__":
    unittest.main()
