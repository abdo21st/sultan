async function main() {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local', quiet: true });
  dotenv.config({ path: '.env', quiet: true });

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Set DIRECT_URL or DATABASE_URL in a local environment file.');
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
  try {
    await pool.query('SELECT 1');
    console.log('Database connection succeeded.');
  } catch {
    console.error('Database connection failed.');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch(() => {
  console.error('Database connection check could not run.');
  process.exitCode = 1;
});
