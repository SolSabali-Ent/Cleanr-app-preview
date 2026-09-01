import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const helperPath = path.join(root, "src/lib/cspActivation.ts");
const migrationPath = path.join(root, "supabase/migrations/20260901007000_provider_approval_requires_durable_independent_reviews.sql");

const helper = fs.readFileSync(helperPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");

const requiredHelperSignals = [
  "identity_document_path",
  "identityVerifiedReview",
  "backgroundClearReview",
  "Independent identity review recorded",
  "Independent background review recorded",
  "reviewEvidence.identityVerifiedReview === true",
  "reviewEvidence.backgroundClearReview === true",
];

const requiredMigrationSignals = [
  "review_type = 'identity'",
  "outcome = 'verified'",
  "review_type = 'background'",
  "outcome = 'clear'",
  "reviewed_by <> p_provider_id",
  "durable independent identity review missing",
  "durable independent background review missing",
];

const missing = [];
for (const signal of requiredHelperSignals) {
  if (!helper.includes(signal)) missing.push(`app helper: ${signal}`);
}
for (const signal of requiredMigrationSignals) {
  if (!migration.includes(signal)) missing.push(`DB approval boundary: ${signal}`);
}

if (missing.length > 0) {
  console.error("CSP approval readiness contract drift detected:");
  for (const item of missing) console.error(`- missing ${item}`);
  process.exit(1);
}

console.log("CSP approval readiness contract is aligned: durable independent identity/background reviews are required on both app and DB boundaries.");
