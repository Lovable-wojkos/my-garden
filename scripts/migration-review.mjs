#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
const ACK_MARKER = "migration-review: acknowledged";

function hasAcknowledgment(lines, lineIndex) {
  const currentLine = String(lines[lineIndex] ?? "");
  const prevLine = String(lines[lineIndex - 1] ?? "");
  const nextLine = String(lines[lineIndex + 1] ?? "");
  const haystack = `${prevLine}\n${currentLine}\n${nextLine}`.toLowerCase();
  return haystack.includes(ACK_MARKER);
}

function findDropTableIssues(lines, fileName) {
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*DROP\s+TABLE\b/i.test(lines[i]) && !hasAcknowledgment(lines, i)) {
      issues.push({
        file: fileName,
        line: i + 1,
        blocking: true,
        kind: "DROP TABLE",
        statement: lines[i].trim(),
      });
    }
  }
  return issues;
}

function findColumnDropIssues(lines, fileName) {
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\s*ALTER\s+COLUMN\s+\w+\s+DROP\s+NOT\s+NULL\b/i.test(line) && !hasAcknowledgment(lines, i)) {
      issues.push({
        file: fileName,
        line: i + 1,
        blocking: true,
        kind: "ALTER COLUMN DROP NOT NULL",
        statement: line.trim(),
      });
    }

    if (/^\s*DROP\s+COLUMN\b/i.test(line) && !hasAcknowledgment(lines, i)) {
      issues.push({
        file: fileName,
        line: i + 1,
        blocking: true,
        kind: "DROP COLUMN",
        statement: line.trim(),
      });
    }
  }
  return issues;
}

function findDropPolicyWarnings(content, lines, fileName) {
  const hasCreatePolicy = /\bCREATE\s+POLICY\b/i.test(content);
  const issues = [];

  if (hasCreatePolicy) {
    return issues;
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*DROP\s+POLICY\b/i.test(lines[i])) {
      issues.push({
        file: fileName,
        line: i + 1,
        blocking: false,
        kind: "DROP POLICY without CREATE POLICY in file",
        statement: lines[i].trim(),
      });
    }
  }

  return issues;
}

function findSeedInsertWarnings(content, lines, fileName) {
  const issues = [];
  const hasInsert = /\bINSERT\s+INTO\b/i.test(content);
  const hasOnConflict = /\bON\s+CONFLICT\b/i.test(content);

  if (!hasInsert || hasOnConflict) {
    return issues;
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*INSERT\s+INTO\b/i.test(lines[i])) {
      issues.push({
        file: fileName,
        line: i + 1,
        blocking: false,
        kind: "INSERT INTO without ON CONFLICT (reset-only policy warning)",
        statement: lines[i].trim(),
      });
    }
  }

  return issues;
}

async function runReview() {
  const fileNames = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const findings = [];

  for (const fileName of fileNames) {
    const filePath = path.join(migrationsDir, fileName);
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split("\n");

    findings.push(...findDropTableIssues(lines, fileName));
    findings.push(...findColumnDropIssues(lines, fileName));
    findings.push(...findDropPolicyWarnings(content, lines, fileName));
    findings.push(...findSeedInsertWarnings(content, lines, fileName));
  }

  const blocking = findings.filter((finding) => finding.blocking);
  const warnings = findings.filter((finding) => !finding.blocking);

  if (blocking.length > 0) {
    console.error("BLOCKING findings:");
    for (const finding of blocking) {
      console.error(`  ${finding.file}:${finding.line} [${finding.kind}]`);
      console.error(`    ${finding.statement}`);
    }
    console.error("");
  }

  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const finding of warnings) {
      console.error(`  ${finding.file}:${finding.line} [${finding.kind}]`);
      console.error(`    ${finding.statement}`);
    }
    console.error("");
  }

  console.error(`Summary: ${blocking.length} blocking, ${warnings.length} warnings`);
  return blocking.length === 0 ? 0 : 1;
}

const code = await runReview();
process.exit(code);
