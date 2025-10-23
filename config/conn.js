const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    debug: true,  // shows query logs / false if deployment
    trace: true   // traces connection calls / false if deployment
  });
  

// Add connection error handling
pool.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
});

module.exports = pool; 