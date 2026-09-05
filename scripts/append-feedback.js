const fs = require("fs");
const path = require("path");

const jsonPath = path.join(__dirname, "..", "data", "responses.json");
const csvPath = path.join(__dirname, "..", "data", "responses.csv");
const header =
  "timestamp,taste_of_the_food,quality_and_freshness,hygiene_and_packaging,service_and_delivery,overall_experience,suggestion";

const payload = JSON.parse(process.env.PAYLOAD || "{}");

function scoreOk(n) {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

const required = [
  "taste_of_the_food",
  "quality_and_freshness",
  "hygiene_and_packaging",
  "service_and_delivery",
  "overall_experience"
];

for (const key of required) {
  const value = Number(payload[key]);
  if (!scoreOk(value)) {
    console.error(`Invalid rating: ${key}`);
    process.exit(1);
  }
}

const entry = {
  timestamp: payload.timestamp || new Date().toISOString(),
  taste_of_the_food: Number(payload.taste_of_the_food),
  quality_and_freshness: Number(payload.quality_and_freshness),
  hygiene_and_packaging: Number(payload.hygiene_and_packaging),
  service_and_delivery: Number(payload.service_and_delivery),
  overall_experience: Number(payload.overall_experience),
  suggestion: String(payload.suggestion || "").slice(0, 1000)
};

let responses = [];
if (fs.existsSync(jsonPath)) {
  try {
    responses = JSON.parse(fs.readFileSync(jsonPath, "utf8") || "[]");
    if (!Array.isArray(responses)) responses = [];
  } catch {
    responses = [];
  }
}

responses.push(entry);
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(responses, null, 2) + "\n");

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

const row = [
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

let csv = fs.existsSync(csvPath) ? fs.readFileSync(csvPath, "utf8") : header + "\n";
if (!csv.trim()) csv = header + "\n";
if (!csv.endsWith("\n")) csv += "\n";
if (!csv.startsWith("timestamp,")) csv = header + "\n" + csv;
fs.writeFileSync(csvPath, csv + row + "\n");

console.log(`Saved feedback. Total responses: ${responses.length}`);
