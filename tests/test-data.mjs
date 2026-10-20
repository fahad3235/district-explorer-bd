// Node unit tests for District Explorer BD data + pure functions.
// Run: node tests/test-data.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = (p) => fs.readFileSync(path.join(DIR, "..", p), "utf8");

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("ok - " + name); }
  else { failed++; console.log("FAIL - " + name + (extra ? " :: " + extra : "")); }
}

// 1. sources are pure ASCII (push-safety)
for (const p of ["js/data.js", "js/app.js", "js/i18n.js", "css/style.css", "index.html"]) {
  check("ascii: " + p, !/[^\x00-\x7F]/.test(SRC(p)));
}

// 2. load dataset in a sandbox
const vm = await import("node:vm");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(SRC("js/data.js") + "\n;globalThis.DIVISIONS = DIVISIONS;", ctx);
vm.runInContext(SRC("js/i18n.js") + "\n;globalThis.I18N = I18N;", ctx);
const { DIVISIONS, I18N } = ctx;

check("8 divisions", DIVISIONS.length === 8, DIVISIONS.length);
const EXPECTED = { Barishal: 6, Chattogram: 11, Dhaka: 13, Khulna: 10, Mymensingh: 4, Rajshahi: 8, Rangpur: 8, Sylhet: 4 };
let total = 0;
for (const d of DIVISIONS) {
  check("division count " + d.en, d.dist.length === EXPECTED[d.en], d.dist.length);
  total += d.dist.length;
}
check("64 districts total", total === 64, total);

// 3. district names unique (case-insensitive), bn present
const names = new Set(), bns = new Set();
let bnOk = true, oldOk = true;
for (const d of DIVISIONS) {
  check("division has bn name: " + d.en, typeof d.bn === "string" && d.bn.length > 0);
  for (const x of d.dist) {
    const k = x.en.toLowerCase();
    if (names.has(k)) check("unique en: " + x.en, false);
    names.add(k);
    if (bns.has(x.bn)) check("unique bn: " + x.bn, false);
    bns.add(x.bn);
    if (!/^[\u0980-\u09FF''\s]+$/.test(x.bn)) { bnOk = false; console.log("  bad bn: " + x.en); }
    if (x.old !== undefined && typeof x.old !== "string") { oldOk = false; }
  }
}
check("all en names unique", names.size === 64, names.size);
check("all bn names unique", bns.size === 64, bns.size);
check("bn names are Bengali script", bnOk);
check("old spellings are strings when present", oldOk);

// 4. known old spellings (official 2018 renames)
const oldPairs = [["Chattogram", "Chittagong"], ["Cumilla", "Comilla"], ["Jashore", "Jessore"],
                  ["Bogura", "Bogra"], ["Barishal", "Barisal"]];
const byName = {};
for (const d of DIVISIONS) for (const x of d.dist) byName[x.en] = x;
for (const [neu, alt] of oldPairs) check("old spelling " + neu + "=" + alt, byName[neu] && byName[neu].old === alt);
check("division Barishal old=Barisal", DIVISIONS[0].old === "Barisal");
check("division Chattogram old=Chittagong", DIVISIONS[1].old === "Chittagong");

// 5. i18n parity: every en key exists in bn
const enKeys = Object.keys(I18N.en).sort();
const bnKeys = Object.keys(I18N.bn).sort();
check("i18n keys match", JSON.stringify(enKeys) === JSON.stringify(bnKeys),
  enKeys.filter(k => !bnKeys.includes(k)).join(",") || bnKeys.filter(k => !enKeys.includes(k)).join(","));
check("bn strings non-empty", Object.values(I18N.bn).every(v => typeof v === "string" && v.length > 0));
check("bn title differs from en (localized)", I18N.bn.title !== I18N.en.title);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
