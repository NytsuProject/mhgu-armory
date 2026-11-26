#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditBowBranches } from "../js/bow-branch-audit.js";

const args = process.argv.slice(2);
const inputArg = args.find(arg => arg.startsWith("--bows="));
const outputArg = args.find(arg => arg.startsWith("--out="));
const input = resolve(inputArg ? inputArg.slice(7) : "data/weapons/bow.json");
const report = auditBowBranches(JSON.parse(readFileSync(input, "utf8")));
const json = JSON.stringify(report, null, 2) + "\n";

if (outputArg) {
  const output = resolve(outputArg.slice(6));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, json, "utf8");
}
if (args.includes("--summary")) {
  process.stdout.write(JSON.stringify(report.metadata, null, 2) + "\n");
} else {
  process.stdout.write(json);
}
