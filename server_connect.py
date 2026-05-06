# -*- coding: utf-8 -*-
"""
server_connect.py - أداة الاتصال بمخدم ordermt.ly
آخر تحديث: 2026-05-05
"""

import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

# ===== بيانات المخدم =====
SERVER = {
    "ip":       "102.203.201.52",
    "user":     "root",
    "password": "Aa@12341312",
    "ssh_key":  r"C:\Users\phabd\.ssh\id_ed25519",
    "name":     "ordermt-ly",
    "provider": "LibyanSpider",
}

# ===== الخدمات =====
SERVICES = {
    "coolify":  f"http://{SERVER['ip']}:8000",
    "n8n":      "https://n8n.ordermt.ly",
    "n8n_port": "http://localhost:5678",
}

# ===== Docker Compose paths =====
COMPOSE_PATHS = {
    "n8n": "/opt/n8n",
}


def connect(use_key=True):
    """الاتصال بالمخدم عبر SSH"""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if use_key:
        client.connect(
            SERVER["ip"],
            username=SERVER["user"],
            key_filename=SERVER["ssh_key"],
            timeout=30
        )
    else:
        client.connect(
            SERVER["ip"],
            username=SERVER["user"],
            password=SERVER["password"],
            timeout=30
        )
    return client


def run(cmd, timeout=60, use_key=True):
    """تنفيذ أمر على المخدم وإرجاع (stdout, stderr, exit_code)"""
    client = connect(use_key=use_key)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="ignore").strip()
    err = stderr.read().decode("utf-8", errors="ignore").strip()
    client.close()
    return out, err, exit_code


def status():
    """عرض حالة جميع الخدمات على المخدم"""
    client = connect()
    print(f"\n{'='*50}")
    print(f"  Server Status: {SERVER['name']} ({SERVER['ip']})")
    print(f"{'='*50}")

    checks = [
        ("Docker",       "docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null | head -10"),
        ("n8n",          "docker ps --filter name=n8n --format '{{.Names}}: {{.Status}}'"),
        ("Coolify",      "docker ps --filter name=coolify --format '{{.Names}}: {{.Status}}' | head -5"),
        ("Traefik",      "docker ps --filter name=coolify-proxy --format '{{.Names}}: {{.Status}}'"),
        ("PostgreSQL",   "systemctl is-active postgresql 2>/dev/null || echo 'not active'"),
        ("Disk",         "df -h / | tail -1 | awk '{print \"Used: \"$3\" / \"$2\" (\"$5\")\"}'"),
        ("Memory",       "free -h | grep Mem | awk '{print \"Used: \"$3\" / \"$2}'"),
        ("Uptime",       "uptime -p"),
    ]

    for label, cmd in checks:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
        stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="ignore").strip()
        print(f"\n  [{label}]")
        if out:
            for line in out.split('\n'):
                print(f"    {line}")
        else:
            print("    -")

    client.close()
    print(f"\n{'='*50}\n")


def restart_n8n():
    """إعادة تشغيل n8n"""
    print("Restarting n8n...")
    out, err, code = run("cd /opt/n8n && docker compose restart", timeout=60)
    print(out if out else err)


def logs_n8n(lines=50):
    """عرض سجلات n8n"""
    out, _, _ = run(f"docker logs n8n --tail={lines} 2>&1")
    print(out)


def logs_traefik(lines=30):
    """عرض سجلات Traefik"""
    out, _, _ = run(f"docker logs coolify-proxy --tail={lines} 2>&1")
    print(out)


if __name__ == "__main__":
    # عند تشغيل الملف مباشرة: عرض حالة المخدم
    status()
    print(f"  Services:")
    for name, url in SERVICES.items():
        print(f"    {name}: {url}")
    print()
