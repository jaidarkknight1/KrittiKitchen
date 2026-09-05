const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const JSON_PATH = path.join(DATA_DIR, "responses.json");
const CSV_PATH = path.join(DATA_DIR, "responses.csv");
const AUTO_PUSH = process.env.AUTO_PUSH !== "0";

const REQUIRED = [
  "taste_of_the_food",
  "quality_and_freshness",
  "hygiene_and_packaging",
  "service_and_delivery",
  "overall_experience"
];

const CSV_HEADER =
  "timestamp,taste_of_the_food,quality_and_freshness,hygiene_and_packaging,service_and_delivery,overall_experience,suggestion";

app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(express.static(ROOT));

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(JSON_PATH)) fs.writeFileSync(JSON_PATH, "[]\n", "utf8");
  if (!fs.existsSync(CSV_PATH)) fs.writeFileSync(CSV_PATH, CSV_HEADER + "\n", "utf8");
}

function readResponses() {
  ensureDataFiles();
  try {
    const raw = fs.readFileSync(JSON_PATH, "utf8").trim() || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsvRow(entry) {
  return [
    entry.timestamp,
    entry.taste_of_the_food,
    entry.quality_and_freshness,
    entry.hygiene_and_packaging,
    entry.service_and_delivery,
    entry.overall_experience,
    entry.suggestion || ""
  ]
    .map(csvEscape)
    .join(",");
}

function scoreOk(n) {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "kritti-kitchen-feedback" });
});

app.get("/api/responses", (_req, res) => {
  res.json({ count: readResponses().length, responses: readResponses() });
});

app.post("/api/feedback", (req, res) => {
  const body = req.body || {};

  for (const key of REQUIRED) {
    const value = Number(body[key]);
    if (!scoreOk(value)) {
      return res.status(400).json({
        error: `Missing or invalid rating for ${key} (need 1–10)`
      });
    }
  }

  const entry = {
    timestamp: body.timestamp || new Date().toISOString(),
    taste_of_the_food: Number(body.taste_of_the_food),
    quality_and_freshness: Number(body.quality_and_freshness),
    hygiene_and_packaging: Number(body.hygiene_and_packaging),
    service_and_delivery: Number(body.service_and_delivery),
    overall_experience: Number(body.overall_experience),
    suggestion: String(body.suggestion || "").slice(0, 1000)
  };

  const responses = readResponses();
  responses.push(entry);
  fs.writeFileSync(JSON_PATH, JSON.stringify(responses, null, 2) + "\n", "utf8");

  ensureDataFiles();
  let csv = fs.readFileSync(CSV_PATH, "utf8");
  if (!csv.trim()) csv = CSV_HEADER + "\n";
  if (!csv.endsWith("\n")) csv += "\n";
  fs.appendFileSync(CSV_PATH, toCsvRow(entry) + "\n", "utf8");

  if (AUTO_PUSH) {
    execFile(
      "git",
      ["add", "data/responses.json", "data/responses.csv"],
      { cwd: ROOT },
      (addErr) => {
        if (addErr) return;
        execFile(
          "git",
          ["commit", "-m", "chore: record customer feedback"],
          { cwd: ROOT },
          (commitErr) => {
            if (commitErr) return;
            execFile("git", ["push"], { cwd: ROOT }, () => {});
          }
        );
      }
    );
  }

  res.status(201).json({ ok: true, saved: entry, total: responses.length });
});

ensureDataFiles();

app.listen(PORT, () => {
  console.log(`Kritti Kitchen feedback running at http://localhost:${PORT}`);
  console.log(`Responses file: ${JSON_PATH}`);
});
