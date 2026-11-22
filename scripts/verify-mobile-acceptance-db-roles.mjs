import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL || !/^[a-f0-9]{64}$/.test(process.env.QA_APP_DB_PASSWORD || '')) {
  throw new Error('The QA database role check requires the isolated QA connection settings.');
}

const url = new URL(process.env.DATABASE_URL);
if (url.hostname !== 'sultan-db' || url.pathname !== '/sultan_mobile_acceptance') {
  throw new Error('The role check may only connect to the isolated QA database.');
}
url.username = 'sultan_mobile_runtime';
url.password = process.env.QA_APP_DB_PASSWORD;

const pool = new Pool({ connectionString: url.href, max: 1 });
try {
  const { rows: [role] } = await pool.query(`
    SELECT current_user,
           r.rolsuper,
           r.rolcreatedb,
           r.rolcreaterole,
           has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
           has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
           (has_table_privilege(current_user, 'public."User"', 'SELECT') AND
            has_table_privilege(current_user, 'public."User"', 'INSERT') AND
            has_table_privilege(current_user, 'public."User"', 'UPDATE') AND
            has_table_privilege(current_user, 'public."User"', 'DELETE')) AS users_dml,
           (has_table_privilege(current_user, 'public.login_attempts', 'SELECT') AND
            has_table_privilege(current_user, 'public.login_attempts', 'INSERT') AND
            has_table_privilege(current_user, 'public.login_attempts', 'UPDATE') AND
            has_table_privilege(current_user, 'public.login_attempts', 'DELETE')) AS login_attempts_dml,
           has_table_privilege(current_user, 'public."_prisma_migrations"', 'SELECT') AS migration_history_read
      FROM pg_roles r WHERE r.rolname = current_user
  `);
  if (!role || role.current_user !== 'sultan_mobile_runtime' || role.rolsuper || role.rolcreatedb || role.rolcreaterole ||
      !role.schema_usage || role.schema_create || !role.users_dml || !role.login_attempts_dml || role.migration_history_read) {
    throw new Error('The application runtime role does not match the least-privilege policy.');
  }

  let ddlDenied = false;
  try {
    await pool.query('CREATE TABLE public.__qa_runtime_ddl_probe (id integer)');
  } catch (error) {
    ddlDenied = error?.code === '42501';
  }
  if (!ddlDenied) throw new Error('The application runtime role was able to create a table.');

  const probeHash = randomBytes(32).toString('hex');
  await pool.query('BEGIN');
  try {
    await pool.query(
      'INSERT INTO public.login_attempts (bucket_hash, window_started_at, failure_count, last_failure_at) VALUES ($1, NOW(), 1, NOW())',
      [probeHash],
    );
  } finally {
    await pool.query('ROLLBACK');
  }
  console.log('Runtime database role has DML access, no DDL/superuser privileges, and no migration-history access.');
} finally {
  await pool.end();
}
