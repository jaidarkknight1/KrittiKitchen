const fs = require("fs");
const path = require("path");

const MANTLE_URL = "https://mantledb.sh/v2/kritti-kitchen-fb-43939/responses";
const ROOT = path.join(__dirname, "..");
const JSON_PATH = path.join(ROOT, "data", "responses.json");
const CSV_PATH = path.join(ROOT, "data", "responses.csv");
const CSV_HEADER =
  "timestamp,taste_of_the_food,quality_and_freshness,hygiene_and_packaging,service_and_delivery,overall_experience,suggestion";

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

async function main() {
  const res = await fetch(MANTLE_URL + "?ts=" + Date.now(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch live store: ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Live store did not return an array");
  }

  const sorted = data.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(JSON_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  fs.writeFileSync(CSV_PATH, toCsv(sorted), "utf8");

  console.log(`Synced ${sorted.length} responses to data/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
