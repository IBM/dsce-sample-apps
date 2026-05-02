const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || "localhost",
  port: process.env.PGPORT || process.env.DB_PORT || 5432,
  user: process.env.PGUSER || process.env.DB_USER || "retail_user",
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || "retail_password",
  database: process.env.PGDATABASE || process.env.DB_NAME || "retaildb"
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect()
};
