import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// Connection pool for better performance
export const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
