const fs = require("fs");
const path = require("path");

const MANTLE_URL = "https://mantledb.sh/v2/kritti-kitchen-fb-43939/responses";
const ROOT = path.join(__dirname, "..");
const JSON_PATH = path.join(ROOT, "data", "responses.json");
const CSV_PATH = path.join(ROOT, "data", "responses.csv");
const CSV_HEADER =
  "timestamp,taste_of_the_food,quality_and_freshness,hygiene_and_packaging,service_and_delivery,overall_experience,suggestion";

function scoreOk(n) {
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = {
    timestamp: raw.timestamp || new Date().toISOString(),
    taste_of_the_food: Number(raw.taste_of_the_food),
    quality_and_freshness: Number(raw.quality_and_freshness),
    hygiene_and_packaging: Number(raw.hygiene_and_packaging),
    service_and_delivery: Number(raw.service_and_delivery),
    overall_experience: Number(raw.overall_experience),
    suggestion: String(raw.suggestion || "").slice(0, 1000)
  };
  const keys = [
    "taste_of_the_food",
    "quality_and_freshness",
    "hygiene_and_packaging",
    "service_and_delivery",
    "overall_experience"
  ];
  if (!keys.every((k) => scoreOk(entry[k]))) return null;
  return entry;
}

function keyOf(entry) {
  return `${entry.timestamp}|${entry.overall_experience}|${entry.suggestion}`;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows) {
  const lines = [CSV_HEADER];
  for (const entry of rows) {
    lines.push(
      [
        entry.timestamp,
        entry.taste_of_the_food,
        entry.quality_and_freshness,
        entry.hygiene_and_packaging,
        entry.service_and_delivery,
        entry.overall_experience,
        entry.suggestion || ""
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n") + "\n";
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data.map(normalizeEntry).filter(Boolean);
  const one = normalizeEntry(data);
  return one ? [one] : [];
}

function loadLocal() {
  if (!fs.existsSync(JSON_PATH)) return [];
  try {
    return normalizeRows(JSON.parse(fs.readFileSync(JSON_PATH, "utf8") || "[]"));
  } catch {
    return [];
  }
}

async function loadStore() {
  const res = await fetch(MANTLE_URL + "?ts=" + Date.now(), {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`Store fetch failed: ${res.status}`);
  return normalizeRows(await res.json());
}

async function main() {
  const local = loadLocal();
  const remote = await loadStore();
  const map = new Map();
  [...local, ...remote].forEach((entry) => map.set(keyOf(entry), entry));
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8");
  fs.writeFileSync(CSV_PATH, toCsv(merged), "utf8");
  console.log(`Synced ${merged.length} responses (${remote.length} from live store)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
