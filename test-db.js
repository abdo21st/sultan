const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:B6e6WwpMQ2UczFQdpTEKDHzXSFGHr474wZ9MDla8JW5iBp64nRV6HJBxEXMHf6BW@102.203.201.52:3000/postgres?sslmode=disable",
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Connection error:', err);
  } else {
    console.log('Connection successful:', res.rows[0]);
  }
  pool.end();
});
