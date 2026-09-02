import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationPath = path.join(root, "supabase/migrations/20260902003000_identity_review_evidence_provenance.sql");
const migration = fs.readFileSync(migrationPath, "utf8");

const requiredSignals = [
  "reviewed_evidence_ref",
  "v_evidence_ref := nullif(trim(coalesce(v_profile.identity_document_path, '')), '')",
  "r.reviewed_evidence_ref = v.identity_document_path",
  "durable independent identity review for current evidence missing",
];

for (const signal of requiredSignals) {
  if (!migration.includes(signal)) {
    throw new Error(`Identity review evidence provenance contract missing: ${signal}`);
  }
}

console.log("Identity review evidence provenance contract verified.");
