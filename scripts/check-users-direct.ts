import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.ryvbdmltuskzuxppjogi:TE6Ul7uLk0Z9wUq0@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkUsers() {
    try {
        console.log("Checking users in database...");
        const res = await pool.query('SELECT username, role, password FROM "User" LIMIT 10');

        console.table(res.rows.map(row => ({
            username: row.username,
            role: row.role,
            hashPrefix: row.password ? row.password.substring(0, 10) + "..." : "NULL"
        })));

    } catch (err: unknown) {
        if (err instanceof Error) {
            console.error("Database connection error:", err.message);
        } else {
            console.error("An unknown database error occurred");
        }
    } finally {
        await pool.end();
    }
}

checkUsers();
