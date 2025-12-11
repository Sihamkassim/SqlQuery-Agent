import pkg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pkg;

const client = new Client({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASS,
});

async function test() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL!");

    const res = await client.query("SELECT * FROM users;");
    console.log("Users:", res.rows);

    await client.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
