import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;

const DEFAULT_SERVICE_PATH = path.join(root, "data", "services.json");
const FALLBACK_SERVICE_PATH = path.join(root, "data", "services.sample.json");

const ONEMAP_AUTH_URL =
  process.env.ONEMAP_AUTH_URL ||
  "https://developers.onemap.sg/privateapi/auth/post/getToken";
const ONEMAP_THEMES_URL =
  process.env.ONEMAP_THEMES_URL ||
  "https://developers.onemap.sg/privateapi/commonsvc/getAllThemes";
const ONEMAP_THEME_DETAIL_URL =
  process.env.ONEMAP_THEME_DETAIL_URL ||
  "https://developers.onemap.sg/privateapi/themesvc/retrieveTheme";

let cachedToken = null;
let tokenExpiry = 0;

function readJsonFile(filePath, fallbackPath) {
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }
  return JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
}

async function getOneMapToken() {
  if (process.env.ONEMAP_TOKEN) {
    return process.env.ONEMAP_TOKEN;
  }

  const now = Date.now();
  if (cachedToken && tokenExpiry > now + 60_000) {
    return cachedToken;
  }

  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) {
    throw new Error("OneMap credentials missing. Set ONEMAP_EMAIL and ONEMAP_PASSWORD.");
  }

  const payload = JSON.stringify({ email, password });
  const response = await fetchJson(ONEMAP_AUTH_URL, {
    method: "POST",
    body: payload,
  });

  const token = response?.access_token || response?.token;
  if (!token) {
    throw new Error("Unable to obtain OneMap token.");
  }

  cachedToken = token;
  const expires = response?.expiry_timestamp || response?.expiry || 0;
  tokenExpiry = expires || now + 60 * 60 * 1000;

  return token;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/services", (_req, res) => {
  try {
    const services = readJsonFile(DEFAULT_SERVICE_PATH, FALLBACK_SERVICE_PATH);
    res.json({ services });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to read services." });
  }
});

app.get("/api/onemap/themes", async (_req, res) => {
  try {
    const token = await getOneMapToken();
    const url = new URL(ONEMAP_THEMES_URL);
    url.searchParams.set("token", token);

    const data = await fetchJson(url.toString());
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch themes." });
  }
});

app.get("/api/onemap/theme", async (req, res) => {
  try {
    const queryName = req.query.queryName;
    if (!queryName) {
      res.status(400).json({ error: "Missing queryName." });
      return;
    }

    const token = await getOneMapToken();
    const url = new URL(ONEMAP_THEME_DETAIL_URL);
    url.searchParams.set("token", token);
    url.searchParams.set("queryName", queryName);

    const data = await fetchJson(url.toString());
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch theme detail." });
  }
});

app.listen(PORT, () => {
  console.log(`JusticeGap API server running on http://localhost:${PORT}`);
});
