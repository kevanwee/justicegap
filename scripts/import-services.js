import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse/sync";
import Ajv from "ajv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const inputArg = args.find((arg) => arg.startsWith("--input="));
const outputArg = args.find((arg) => arg.startsWith("--output="));

const inputPath = inputArg ? inputArg.split("=")[1] : path.join(root, "data", "services.sample.json");
const outputPath = outputArg ? outputArg.split("=")[1] : path.join(root, "data", "services.json");

const schemaPath = path.join(root, "data", "services.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

function toIssues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[;,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function normalizeService(raw) {
  return {
    id: String(raw.id || raw.ID || "").trim(),
    name: String(raw.name || raw.Name || "").trim(),
    type: String(raw.type || raw.Type || "other").trim().toLowerCase(),
    lat: toNumber(raw.lat || raw.latitude || raw.Latitude),
    lng: toNumber(raw.lng || raw.longitude || raw.Longitude),
    issues: toIssues(raw.issues || raw.Issues),
    hours: {
      weekdays: String(raw.hours_weekdays || raw.weekdays || raw.Weekdays || "").trim(),
      weekend: String(raw.hours_weekend || raw.weekend || raw.Weekend || "").trim(),
    },
    phone: raw.phone ? String(raw.phone).trim() : undefined,
    url: raw.url ? String(raw.url).trim() : undefined,
    eligibility: raw.eligibility ? String(raw.eligibility).trim() : undefined,
    address: raw.address ? String(raw.address).trim() : undefined,
    serviceArea: raw.service_area ? String(raw.service_area).trim() : undefined,
  };
}

function loadInput(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".csv") {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records.map(normalizeService);
  }

  const json = JSON.parse(content);
  if (Array.isArray(json)) {
    return json.map(normalizeService);
  }

  if (Array.isArray(json?.services)) {
    return json.services.map(normalizeService);
  }

  throw new Error("Unsupported input format. Provide CSV or JSON array.");
}

function validateData(data) {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(data);
  if (!valid) {
    const errorText = ajv.errorsText(validate.errors, { separator: "\n" });
    throw new Error(`Schema validation failed:\n${errorText}`);
  }
}

try {
  const services = loadInput(inputPath);
  validateData(services);
  fs.writeFileSync(outputPath, JSON.stringify(services, null, 2));
  console.log(`Imported ${services.length} services to ${outputPath}`);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
