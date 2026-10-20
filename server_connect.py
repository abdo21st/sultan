# -*- coding: utf-8 -*-
"""
server_connect.py - أداة الاتصال بمخدم ordermt.ly
آخر تحديث: 2026-07-13
"""

import paramiko
import sys
import time
import os
import re
import shlex

sys.stdout.reconfigure(encoding='utf-8')

# ===== بيانات المخدم =====
SERVER = {
    "ip":       os.environ.get("SULTAN_SERVER_HOST", "102.203.201.52"),
    "user":     os.environ.get("SULTAN_SERVER_USER", "sultan-ops"),
    "ssh_key":  os.environ.get("SULTAN_SSH_KEY", os.path.expanduser("~/.ssh/id_ed25519_coolify")),
    "ssh_port": int(os.environ.get("SULTAN_SSH_PORT", "22")),
    "name":     "Recluse Native (mtserver)",
    "provider": "LibyanSpider",
    "hostname": "mt.server.ly",
}

# ===== الخدمات =====
SERVICES = {
    "coolify":       f"http://{SERVER['ip']}:8000",
    "coolify_api":   f"http://{SERVER['ip']}:8000/api",
    "n8n":           "https://n8n.ordermt.ly",
    "n8n_local":     "http://localhost:5678",
    "jsreport":      f"http://{SERVER['ip']}:5488",
    "madar_chat":    f"http://{SERVER['ip']}:3000",
    "sultan":        f"http://{SERVER['ip']}:3001",
    "dashboard":     f"http://{SERVER['ip']}:8080",
    "traefik_api":   f"http://{SERVER['ip']}:8080",
    "status":        "https://status.ordermt.ly",
}

# ===== مسارات Docker Compose =====
COMPOSE_PATHS = {
    "n8n":      "/opt/n8n",
    "jsreport": "/opt/jsreport",
    "madar":    "/opt/madar-chat",
    "sultan":   "/opt/sultan-order",
    "dashboard": "/opt/status-dashboard",
    "traefik":  "/opt/traefik",
    "coolify":  "/opt/coolify",
}

# ===== Docker Containers =====
CONTAINERS = {
    "coolify":         "coolify",
    "coolify_db":      "coolify-db",
    "coolify_redis":   "coolify-redis",
    "coolify_realtime": "coolify-realtime",
    "coolify_sentinel": "coolify-sentinel",
    "n8n":             "n8n",
    "n8n_db":          "n8n-db",
    "jsreport":        "jsreport_server",
    "madar_frontend":  "madar-frontend",
    "madar_postgres":  "madar-postgres",
    "madar_redis":     "madar-redis",
    "madar_meilisearch": "madar-meilisearch",
    "madar_minio":     "madar-minio",
    "madar_task":      "madar-task-service",
    "sultan_web":      "sultan-order-web",
    "sultan_db":       "sultan-order-db",
    "sultan_postgres": "sultan-postgres",
    "dashboard":       "status-dashboard",
    "traefik":         "traefik",
}

# ===== Docker Volumes =====
VOLUMES = {
    "coolify":         "coolify_data",
    "coolify_db":      "coolify_db_data",
    "coolify_redis":   "coolify_redis_data",
    "n8n":             "n8n_data",
    "n8n_db":          "n8n_db_data",
    "jsreport":        "jsreport_data",
    "madar_postgres":  "madar_postgres_data",
    "madar_redis":     "madar_redis_data",
    "madar_meilisearch": "madar_meilisearch_data",
    "madar_minio":     "madar_minio_data",
    "sultan_web":      "sultan_web_data",
    "sultan_db":       "sultan_db_data",
    "sultan_postgres": "sultan_postgres_data",
    "dashboard":       "dashboard_data",
    "traefik":         "traefik_data",
}


def connect(use_key=True):
    """الاتصال بالمخدم عبر SSH"""
    if not use_key:
        raise ValueError("SSH password authentication is disabled; configure an SSH key.")
    if not SERVER["ip"] or not SERVER["user"]:
        raise RuntimeError("Set SULTAN_SERVER_HOST and SULTAN_SERVER_USER before connecting.")

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect(
            SERVER["ip"],
            port=SERVER["ssh_port"],
            username=SERVER["user"],
            key_filename=SERVER["ssh_key"],
            timeout=30,
            banner_timeout=30,
            auth_timeout=30,
        )
    except Exception:
        client.close()
        raise
    return client


def _build_allowed_command(action, **params):
    """Build commands only for the management operations exposed by this module."""
    if action == "restart_container":
        container = CONTAINERS.get(params.get("service_name"))
        if not container:
            raise ValueError("Unknown service.")
        return ["docker", "restart", container]
    if action == "restart_compose":
        path = COMPOSE_PATHS.get(params.get("service_name"))
        if not path:
            raise ValueError("Unknown service.")
        return ["docker", "compose", "--project-directory", path, "restart"]
    if action == "logs":
        container = CONTAINERS.get(params.get("service_name"))
        lines = params.get("lines", 50)
        if not container or not isinstance(lines, int) or not 1 <= lines <= 5000:
            raise ValueError("Invalid service or log line count.")
        return ["docker", "logs", container, f"--tail={lines}"]
    if action == "list_containers":
        return ["docker", "ps", "--format", "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"]
    if action == "prune_images":
        if os.environ.get("SULTAN_ALLOW_IMAGE_PRUNE") != "1":
            raise PermissionError("Image cleanup is disabled. Set SULTAN_ALLOW_IMAGE_PRUNE=1 to enable it.")
        return ["docker", "image", "prune", "-f"]
    if action == "backup_volume":
        volume_name = params.get("volume_name")
        dest = params.get("dest", "/tmp")
        timestamp = params.get("timestamp")
        if not isinstance(volume_name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}", volume_name):
            raise ValueError("Invalid Docker volume name.")
        if dest != "/tmp":
            raise ValueError("Backup destination is restricted to /tmp.")
        if not isinstance(timestamp, str) or not re.fullmatch(r"[0-9]{8}_[0-9]{6}", timestamp):
            raise ValueError("Invalid backup timestamp.")
        archive = f"{volume_name}_{timestamp}.tar.gz"
        return ["docker", "run", "--rm", "-v", f"{volume_name}:/src", "-v", "/tmp:/dest", "alpine", "tar", "czf", f"/dest/{archive}", "-C", "/src", "."]
    if action == "validate_coolify":
        return ["docker", "ps", "--filter", "name=coolify", "--format", "{{.Names}}: {{.Status}}"]
    raise ValueError("Remote command is not allowlisted.")


def _run_allowed(action, timeout=60, **params):
    """Execute a fixed allowlisted management action over SSH."""
    command = shlex.join(_build_allowed_command(action, **params))
    client = connect()
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore").strip()
    err = stderr.read().decode("utf-8", errors="ignore").strip()
    client.close()
    return out, err, exit_code


def status():
    """عرض حالة جميع الخدمات على المخدم"""
    client = connect()
    print(f"\n{'='*60}")
    print(f"  Server Status: {SERVER['name']} ({SERVER['ip']})")
    print(f"  Provider: {SERVER['provider']} | Hostname: {SERVER['hostname']}")
    print(f"{'='*60}")

    checks = [
        ("Docker",       "docker ps --format '{{.Names}}\\t{{.Status}}' 2>/dev/null | head -25"),
        ("Coolify",      "docker ps --filter name=coolify --format '{{.Names}}: {{.Status}}'"),
        ("n8n",          "docker ps --filter name=n8n --format '{{.Names}}: {{.Status}}'"),
        ("jsreport",     "docker ps --filter name=jsreport --format '{{.Names}}: {{.Status}}'"),
        ("Madar Chat",   "docker ps --filter name=madar --format '{{.Names}}: {{.Status}}'"),
        ("Sultan",       "docker ps --filter name=sultan --format '{{.Names}}: {{.Status}}'"),
        ("Dashboard",    "docker ps --filter name=status-dashboard --format '{{.Names}}: {{.Status}}'"),
        ("Traefik",      "docker ps --filter name=traefik --format '{{.Names}}: {{.Status}}'"),
        ("PostgreSQL",   "systemctl is-active postgresql 2>/dev/null || echo 'not active'"),
        ("Disk",         "df -h / | tail -1 | awk '{print \"Used: \"$3\" / \"$2\" (\"$5\")\"}'"),
        ("Memory",       "free -h | grep Mem | awk '{print \"Used: \"$3\" / \"$2}'"),
        ("Uptime",       "uptime -p"),
        ("SSH Status",   "systemctl is-active sshd 2>/dev/null || systemctl is-active ssh 2>/dev/null || echo 'unknown'"),
    ]

    for label, cmd in checks:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
        stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="ignore").strip()
        print(f"\n  [{label}]")
        if out:
            for line in out.split('\\n'):
                print(f"    {line}")
        else:
            print("    -")

    client.close()
    print(f"\n{'='*60}\n")


def restart_service(service_name):
    """إعادة تشغيل خدمة Docker"""
    container = CONTAINERS.get(service_name)
    if not container:
        print(f"Unknown service: {service_name}")
        return
    print(f"Restarting {service_name} ({container})...")
    out, err, code = _run_allowed("restart_container", timeout=60, service_name=service_name)
    print(out if out else err)
    if code == 0:
        print(f"  {service_name} restarted successfully!")
    else:
        print(f"  Error restarting {service_name}")


def restart_compose(service_name):
    """إعادة تشغيل Docker Compose service"""
    path = COMPOSE_PATHS.get(service_name)
    if not path:
        print(f"Unknown service: {service_name}")
        return
    print(f"Restarting {service_name} via compose...")
    out, err, code = _run_allowed("restart_compose", timeout=120, service_name=service_name)
    print(out if out else err)


def logs(service_name, lines=50):
    """عرض سجلات خدمة"""
    container = CONTAINERS.get(service_name)
    if not container:
        print(f"Unknown service: {service_name}")
        return
    out, err, _ = _run_allowed("logs", service_name=service_name, lines=lines)
    print(f"\n{'='*60}")
    print(f"  Logs: {service_name} ({container})")
    print(f"{'='*60}\n")
    print(out if out else err)


def ps():
    """عرض جميع الحاويات"""
    out, err, _ = _run_allowed("list_containers")
    print(out if out else err)


def prune():
    """Opt-in cleanup of unused images only; containers and volumes are never pruned."""
    if os.environ.get("SULTAN_ALLOW_IMAGE_PRUNE") != "1":
        print("Image cleanup is disabled. Set SULTAN_ALLOW_IMAGE_PRUNE=1 to enable it.")
        return
    print("Removing unused Docker images only...")
    try:
        out, err, _ = _run_allowed("prune_images", timeout=300)
    except PermissionError as error:
        print(str(error))
        return
    print(out if out else err)


def backup_volume(volume_name, dest="/tmp"):
    """نسخ احتياطي لـ Docker Volume"""
    ts = time.strftime("%Y%m%d_%H%M%S")
    out, err, code = _run_allowed("backup_volume", timeout=300, volume_name=volume_name, dest=dest, timestamp=ts)
    if code == 0:
        print(f"Backup created: {dest}/{volume_name}_{ts}.tar.gz")
    else:
        print(f"Backup failed: {err}")


def validate_coolify():
    """Validate Coolify server connection"""
    out, err, code = _run_allowed("validate_coolify")
    if "coolify" in out:
        print("Coolify is running!")
    else:
        print("Coolify is NOT running!")
        print("Error:", err)


if __name__ == "__main__":
    # عند تشغيل الملف مباشرة: عرض حالة المخدم
    status()
    print(f"  Services:")
    for name, url in SERVICES.items():
        print(f"    {name}: {url}")
    print()
