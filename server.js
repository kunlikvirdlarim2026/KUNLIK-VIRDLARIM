require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("virdlarim.sqlite");
const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    day TEXT NOT NULL,
    item_key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    UNIQUE(telegram_id, day, item_key),
    FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
  );
`);

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

function verifyTelegramInitData(initData) {
  if (!BOT_TOKEN || !initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const a = Buffer.from(calculated, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

function auth(req, res, next) {
  const initData = req.get("X-Telegram-Init-Data");
  const user = verifyTelegramInitData(initData);
  if (!user || !user.id) {
    return res.status(401).json({ error: "Telegram orqali ilovani oching." });
  }
  req.telegramUser = user;
  db.prepare(`INSERT INTO users (telegram_id, first_name, username)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      first_name=excluded.first_name, username=excluded.username`)
    .run(String(user.id), user.first_name || "", user.username || "");
  next();
}

const allowedItems = new Set([
  "istigfor", "salovat", "quran", "asma", "namoz", "tahajjud", "kitob"
]);

app.get("/api/me", auth, (req, res) => {
  res.json({ user: { firstName: req.telegramUser.first_name || "" } });
});

app.get("/api/day", auth, (req, res) => {
  const day = String(req.query.date || new Date().toISOString().slice(0, 10));
  const rows = db.prepare("SELECT item_key, count, completed FROM entries WHERE telegram_id=? AND day=?")
    .all(String(req.telegramUser.id), day);
  res.json({ date: day, entries: rows });
});

app.post("/api/day", auth, (req, res) => {
  const { date, item, count, completed } = req.body || {};
  const day = String(date || "");
  const key = String(item || "");
  const n = Number(count);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !allowedItems.has(key) ||
      !Number.isInteger(n) || n < 0 || n > 1000000) {
    return res.status(400).json({ error: "Ma'lumot noto'g'ri." });
  }
  db.prepare(`INSERT INTO entries (telegram_id, day, item_key, count, completed)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(telegram_id, day, item_key) DO UPDATE SET
      count=excluded.count, completed=excluded.completed`)
    .run(String(req.telegramUser.id), day, key, n, completed ? 1 : 0);
  res.json({ ok: true });
});

app.get("/health", (_, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`Kunlik Virdlarim server: http://localhost:${PORT}`));
