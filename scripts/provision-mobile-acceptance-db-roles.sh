#!/bin/bash
set -euo pipefail
umask 077

root=/opt/sultan-mobile-acceptance
env_file="$root/.env"
test "$(id -u)" = 0
test "$(cat "$root/.managed-by-sultan")" = 'sultan-mobile-acceptance-v1'
test -f "$env_file" && test ! -L "$env_file"
test "$(stat -c '%a' "$env_file")" = 600
set -a
source "$env_file"
set +a
[[ "${QA_APP_DB_PASSWORD:-}" =~ ^[a-f0-9]{64}$ ]]
[[ "${QA_MIGRATION_DB_PASSWORD:-}" =~ ^[a-f0-9]{64}$ ]]
verifiers=$(node --input-type=module <<'NODE'
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
function scramVerifier(password) {
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, 'sha256');
  const hmac = (key, value) => createHmac('sha256', key).update(value).digest();
  const storedKey = createHash('sha256').update(hmac(salted, 'Client Key')).digest('base64');
  const serverKey = hmac(salted, 'Server Key').toString('base64');
  return `SCRAM-SHA-256$4096:${salt.toString('base64')}$${storedKey}:${serverKey}`;
}
process.stdout.write(`${scramVerifier(process.env.QA_APP_DB_PASSWORD)}\n${scramVerifier(process.env.QA_MIGRATION_DB_PASSWORD)}\n`);
NODE
)
app_verifier=$(printf '%s\n' "$verifiers" | sed -n '1p')
migrator_verifier=$(printf '%s\n' "$verifiers" | sed -n '2p')
test "$(printf '%s' "$app_verifier" | cut -d '$' -f 1)" = SCRAM-SHA-256
test "$(printf '%s' "$migrator_verifier" | cut -d '$' -f 1)" = SCRAM-SHA-256

cd "$root"
docker compose -f compose.yml exec -T sultan-db psql -v ON_ERROR_STOP=1 -U sultan_mobile_user -d sultan_mobile_acceptance <<SQL
DO \$roles\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sultan_mobile_runtime') THEN
    EXECUTE format('ALTER ROLE sultan_mobile_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${app_verifier}');
  ELSE
    EXECUTE format('CREATE ROLE sultan_mobile_runtime WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${app_verifier}');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sultan_mobile_migrator') THEN
    EXECUTE format('ALTER ROLE sultan_mobile_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${migrator_verifier}');
  ELSE
    EXECUTE format('CREATE ROLE sultan_mobile_migrator WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', '${migrator_verifier}');
  END IF;
END
\$roles\$;

ALTER DATABASE sultan_mobile_acceptance OWNER TO sultan_mobile_migrator;
ALTER SCHEMA public OWNER TO sultan_mobile_migrator;
DO \$transfer_application_objects\$
DECLARE
  object_record record;
  object_kind text;
BEGIN
  FOR object_record IN
    SELECT c.relkind, n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  LOOP
    object_kind := CASE object_record.relkind
      WHEN 'S' THEN 'SEQUENCE'
      WHEN 'v' THEN 'VIEW'
      WHEN 'm' THEN 'MATERIALIZED VIEW'
      WHEN 'f' THEN 'FOREIGN TABLE'
      ELSE 'TABLE'
    END;
    EXECUTE format('ALTER %s %I.%I OWNER TO sultan_mobile_migrator', object_kind, object_record.nspname, object_record.relname);
  END LOOP;

  FOR object_record IN
    SELECT n.nspname, t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
  LOOP
    EXECUTE format('ALTER TYPE %I.%I OWNER TO sultan_mobile_migrator', object_record.nspname, object_record.typname);
  END LOOP;
END
\$transfer_application_objects\$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE sultan_mobile_acceptance TO sultan_mobile_runtime;
GRANT USAGE ON SCHEMA public TO sultan_mobile_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sultan_mobile_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sultan_mobile_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sultan_mobile_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sultan_mobile_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE sultan_mobile_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sultan_mobile_runtime;
DO \$revoke_migrations\$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM sultan_mobile_runtime';
  END IF;
END
\$revoke_migrations\$;
SQL

role_flags=$(docker compose -f compose.yml exec -T sultan-db psql -v ON_ERROR_STOP=1 -U sultan_mobile_user -d sultan_mobile_acceptance -Atqc \
  "SELECT count(*) FROM pg_roles WHERE rolname IN ('sultan_mobile_runtime','sultan_mobile_migrator') AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole")
test "$role_flags" = 2
runtime_schema=$(docker compose -f compose.yml exec -T sultan-db psql -v ON_ERROR_STOP=1 -U sultan_mobile_user -d sultan_mobile_acceptance -Atqc \
  "SELECT has_schema_privilege('sultan_mobile_runtime','public','USAGE') AND NOT has_schema_privilege('sultan_mobile_runtime','public','CREATE')")
test "$runtime_schema" = t
echo 'QA database roles provisioned and least-privilege checks passed.'
