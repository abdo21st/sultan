import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || "postgresql://postgres.ryvbdmltuskzuxppjogi:TE6Ul7uLk0Z9wUq0@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function verifyPassword() {
    try {
        const usernameToCheck = 'master';
        const testPasswords = ['123', 'admin', 'master', '123456', 'password'];

        const res = await pool.query('SELECT password FROM "User" WHERE username = $1', [usernameToCheck]);

        if (res.rows.length === 0) {
            console.log(`User ${usernameToCheck} not found.`);
            return;
        }

        const hashed = res.rows[0].password;
        console.log(`Checking password for ${usernameToCheck}...`);
        console.log(`Hash in DB: ${hashed}`);

        for (const pass of testPasswords) {
            const match = await bcrypt.compare(pass, hashed);
            console.log(`- Attempt with "${pass}": ${match ? '✅ MATCH' : '❌ NO MATCH'}`);
        }

    } catch (err: any) {
        console.error("Error:", err.message);
    } finally {
        await pool.end();
    }
}

verifyPassword();
