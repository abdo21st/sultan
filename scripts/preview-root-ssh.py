#!/usr/bin/python3 -I
"""Validate the proposed root rule without installing it or reloading SSH."""
import json
import os
from pathlib import Path
import subprocess
import tempfile


def run(arguments):
    result = subprocess.run(arguments, check=False, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError("SSH policy preview validation failed.")
    return result.stdout


def effective(user, config=None):
    arguments = ["/usr/sbin/sshd", "-T", "-C", f"user={user},host=localhost,addr=127.0.0.1"]
    if config:
        arguments.extend(["-f", config])
    return dict(line.split(" ", 1) for line in run(arguments).splitlines())


def main():
    if os.geteuid() != 0:
        raise RuntimeError("Run this preview as the server administrator.")
    root = Path(__file__).resolve().parent.parent
    policy = root / "config" / "ssh" / "80-sultan-root-key-only.conf"
    with tempfile.NamedTemporaryFile(mode="w", prefix="sultan-root-ssh-preview-", delete=False) as temporary:
        os.chmod(temporary.name, 0o600)
        temporary.write(f'Include "{policy}"\nInclude /etc/ssh/sshd_config\n')
    try:
        run(["/usr/sbin/sshd", "-t", "-f", temporary.name])
        preview = effective("root", temporary.name)
        if preview["permitrootlogin"] not in {"prohibit-password", "without-password"} or preview["passwordauthentication"] != "no" or preview["authenticationmethods"] != "publickey":
            raise RuntimeError("The root preview does not enforce key-only authentication.")
        for user in ("sultan-operator", "nobody"):
            if effective(user) != effective(user, temporary.name):
                raise RuntimeError("The root proposal changes another user policy.")
        print(json.dumps({"rootPolicyPreviewValid": True, "rootPasswordAuthentication": preview["passwordauthentication"], "rootAuthenticationMethods": preview["authenticationmethods"], "otherUserPoliciesUnchanged": True, "liveConfigurationChanged": False}))
    finally:
        Path(temporary.name).unlink()


if __name__ == "__main__":
    main()
