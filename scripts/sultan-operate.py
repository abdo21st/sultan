#!/usr/bin/python3 -I
"""Root-owned fixed operations for the Sultan SSH operator. No caller paths or Docker arguments."""
import fcntl
import json
import os
import subprocess
import sys
import time
import urllib.request

PROJECT = "/opt/sultan-production"
APPLICATION = "sultan-production-sultan-app-1"
DATABASE = "sultan-production-sultan-db-1"
ENVIRONMENT = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C", "LC_ALL": "C"}
ALLOWED = {"status", "health", "restart", "backup"}


class OperationError(Exception):
    pass


def command(arguments, timeout=30):
    result = subprocess.run(arguments, cwd=PROJECT, env=ENVIRONMENT, capture_output=True, text=True,
                            timeout=timeout, check=False)
    if result.returncode != 0:
        raise OperationError("The Sultan operation failed; administrator diagnostics are required.")
    return result.stdout.strip()


def status():
    output = {}
    for name, container in (("application", APPLICATION), ("database", DATABASE)):
        state = json.loads(command(["/usr/bin/docker", "inspect", "--format", "{{json .State}}", container]))
        output[name] = {"state": state["Status"], "health": state.get("Health", {}).get("Status"),
                        "paused": state.get("Paused", False)}
    output["revision"] = command(["/usr/bin/docker", "inspect", "--format",
                                   '{{index .Config.Labels "org.opencontainers.image.revision"}}', APPLICATION])
    return output


def health():
    # A fixed local endpoint; caller input cannot select another host or path.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open("http://127.0.0.1:3005/api/health", timeout=10) as response:
        body = json.loads(response.read(4096))
        if response.status != 200 or body.get("status") != "ok":
            raise OperationError("The Sultan health endpoint is not healthy.")
    return {"status": "ok", "httpStatus": 200}


def dispatch(arguments):
    if len(arguments) != 1 or arguments[0] not in ALLOWED:
        raise OperationError("Use one Sultan operation: status, health, restart, or backup.")
    if os.geteuid() != 0:
        raise OperationError("This operation requires the restricted sudo entrypoint.")
    action = arguments[0]
    if action == "status":
        return status()
    if action == "health":
        return health()
    if action == "backup":
        # The service owns the backup lock; do not acquire it again here.
        command(["/usr/bin/systemctl", "start", "sultan-backup.service"], timeout=1000)
        if command(["/usr/bin/systemctl", "show", "sultan-backup.service", "--property=Result", "--value"]) != "success":
            raise OperationError("The Sultan backup did not finish successfully.")
        return {"operation": "backup", "completed": True}
    with open("/run/lock/sultan-backup.lock", "a", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise OperationError("A Sultan backup or deployment is running; retry later.") from error
        state = status()
        if state["application"]["paused"]:
            raise OperationError("The Sultan application is paused; administrator recovery is required.")
        command(["/usr/bin/docker", "restart", "--time", "15", APPLICATION], timeout=60)
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            state = status()
            if state["application"]["health"] == "healthy":
                health()
                return {"operation": "restart", "completed": True, **state}
            time.sleep(2)
        raise OperationError("The Sultan application did not become healthy after restart.")


def main():
    try:
        print(json.dumps(dispatch(sys.argv[1:]), separators=(",", ":")))
        return 0
    except (OperationError, subprocess.SubprocessError, OSError, ValueError, KeyError):
        # Never return container output, environment values, or application logs to SSH clients.
        print("Sultan operation denied or failed; use an allowed operation and check service status.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
