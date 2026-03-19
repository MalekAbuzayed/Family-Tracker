import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

// Use DATABASE_URL from environment
const db = new pg.Client(process.env.DATABASE_URL);
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;

// Initialize database schema
async function initializeDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(50) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS countries (
        country_code VARCHAR(2) PRIMARY KEY,
        country_name VARCHAR(100) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS visited_countries (
        id SERIAL PRIMARY KEY,
        country_code VARCHAR(2) REFERENCES countries(country_code),
        user_id INTEGER REFERENCES users(id)
      );
    `);
    console.log("Database initialized");

    // Insert default user if none exists
    const userCheck = await db.query("SELECT COUNT(*) FROM users");
    if (userCheck.rows[0].count === "0") {
      await db.query("INSERT INTO users (name, color) VALUES ($1, $2)", ["Default User", "teal"]);
      console.log("Default user created");
    }
  } catch (err) {
    console.log("Database initialization error:", err);
  }
}

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1;", [currentUserId]);
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function getCurrentUserColor() {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [currentUserId]);
  return result.rows[0]?.color || "teal"; // Default color if user not found
}

app.get("/", async (req, res) => {
  const result = await db.query("SELECT * FROM users");
  let users = result.rows;
  const countries = await checkVisisted();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: await getCurrentUserColor(),
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()]
    );

    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
        [countryCode, currentUserId]
      );
      res.redirect("/");
    } catch (err) {
      console.log(err);
    }
  } catch (err) {
    console.log(err);
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  console.log(name);
  const color = req.body.color;
  console.log(color);
  db.query("INSERT INTO users (name, color) VALUES ($1, $2)", [name, color]);
  res.redirect("/");
});

// Initialize database and start server
await initializeDatabase();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
