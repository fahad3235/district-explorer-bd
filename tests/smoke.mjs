// Headless-Chrome smoke test via raw CDP (no deps). Run: node tests/smoke.mjs [mobile]
// Uses /opt/meta-chromium/chrome + built-in WebSocket. Pure ASCII source.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = "file://" + path.join(DIR, "..", "index.html");
const PORT = 9224 + Math.floor(Math.random() * 500);
const MOBILE = process.argv[2] === "mobile";
const chrome = spawn("/opt/meta-chromium/chrome", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--remote-debugging-port=" + PORT, "--remote-debugging-address=127.0.0.1",
  "about:blank",
], { stdio: "ignore" });

let checks = 0, failures = [];
function check(name, cond, extra) {
  checks++;
  if (cond) console.log("ok - " + name);
  else { failures.push(name); console.log("FAIL - " + name + (extra ? " :: " + extra : "")); }
}

async function waitForWs() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch("http://127.0.0.1:" + PORT + "/json/list");
      if (r.ok) {
        const targets = await r.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("chrome did not start");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;
const pending = new Map();
let ws;
const consoleErrors = [];
const pageErrors = [];
const netRequests = [];
let loadResolve; const loaded = new Promise((r) => (loadResolve = r));

function send(method, params) {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}
async function evaluate(expr) {
  const res = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (res.result && res.result.exceptionDetails) {
    pageErrors.push(JSON.stringify(res.result.exceptionDetails).slice(0, 300));
    return undefined;
  }
  return res.result && res.result.result ? res.result.result.value : undefined;
}
const q = (sel) => evaluate("document.querySelector('" + sel + "') ? 1 : 0");

try {
  const url = await waitForWs();
  ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Page.loadEventFired") loadResolve();
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      consoleErrors.push(JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === "Runtime.exceptionThrown")
      pageErrors.push((m.params.exceptionDetails.exception?.description || "exception").slice(0, 300));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error")
      consoleErrors.push(m.params.entry.text.slice(0, 300));
    if (m.method === "Network.requestWillBeSent" && /^https?:/.test(m.params.request.url))
      netRequests.push(m.params.request.url);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Log.enable");
  await send("Network.enable");
  if (MOBILE) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: PAGE });
  await loaded;
  await sleep(700);

  check("title", (await evaluate("document.title"))?.includes("District Explorer"));
  check("64 cards rendered", (await evaluate("document.querySelectorAll('.card').length")) === 64,
    await evaluate("document.querySelectorAll('.card').length"));
  check("8 division groups", (await evaluate("document.querySelectorAll('.divgroup').length")) === 8);
  check("dhaka group has 13 cards", (await evaluate("document.querySelectorAll('#divgroup-2 .card').length")) === 13);
  check("stats 64 districts", (await evaluate("document.getElementById('statDistricts').textContent"))?.includes("64"));
  check("stats 8 divisions", (await evaluate("document.getElementById('statDivisions').textContent"))?.includes("8"));

  // Search: English
  await evaluate("var s=document.getElementById('searchInput'); s.value='sylhet'; s.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  check("search 'sylhet' -> 1 card", (await evaluate("document.querySelectorAll('.card').length")) === 1,
    await evaluate("document.querySelectorAll('.card').length"));
  // Search: Bengali name of Dhaka
  await evaluate("var s=document.getElementById('searchInput'); s.value='\\u09A2\\u09BE\\u0995\\u09BE'; s.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  check("search bengali dhaka -> 1 card", (await evaluate("document.querySelectorAll('.card').length")) === 1);
  // Search: old spelling
  await evaluate("var s=document.getElementById('searchInput'); s.value='chittagong'; s.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  check("search old spelling 'chittagong' -> 1 card", (await evaluate("document.querySelectorAll('.card').length")) === 1);
  // Search: no match -> empty state
  await evaluate("var s=document.getElementById('searchInput'); s.value='zzz-nothing'; s.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  check("no-match empty state", (await q("#emptyState")) === 1);
  // clear search
  await evaluate("var s=document.getElementById('searchInput'); s.value=''; s.dispatchEvent(new Event('input',{bubbles:true}));");
  await sleep(200);
  check("clear search restores 64", (await evaluate("document.querySelectorAll('.card').length")) === 64);

  // Division chip filter (Dhaka = div:2)
  await evaluate("document.querySelector('[data-filter=\"div:2\"]').click();");
  await sleep(200);
  check("dhaka chip -> 13 flat cards", (await evaluate("document.querySelectorAll('.card').length")) === 13);
  check("dhaka chip flat mode (no groups)", (await evaluate("document.querySelectorAll('.divgroup').length")) === 0);
  await evaluate("document.querySelector('[data-filter=\"all\"]').click();");
  await sleep(200);

  // Modal: open first card (Barguna)
  await evaluate("document.querySelector('.card').click();");
  await sleep(250);
  check("modal opens", (await evaluate("document.getElementById('modalWrap').hidden")) === false);
  check("modal shows district name", (await evaluate("document.querySelector('.mname').textContent")) === "Barguna");
  check("modal shows old division spelling", (await evaluate("document.getElementById('modalBody').textContent"))?.includes("Barisal"));
  const mateCount = await evaluate("document.querySelectorAll('.mate').length");
  check("modal lists 5 division mates", mateCount === 5, mateCount);
  // click a mate -> modal switches district
  await evaluate("document.querySelector('.mate').click();");
  await sleep(250);
  check("mate click switches district", (await evaluate("document.querySelector('.mname').textContent")) !== "Barguna");
  // escape closes
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", windowsVirtualKeyCode: 27 });
  await sleep(200);
  check("escape closes modal", (await evaluate("document.getElementById('modalWrap').hidden")) === true);

  // Favorite via card star (first card = Barguna)
  await evaluate("document.querySelector('.card .star').click();");
  await sleep(200);
  check("star fav count = 1", (await evaluate("document.getElementById('statFavs').textContent"))?.includes("1"));
  check("fav persisted", (await evaluate("JSON.parse(localStorage.getItem('dx-favs')).length")) === 1);
  // Favorites chip view
  await evaluate("document.querySelector('[data-filter=\"fav\"]').click();");
  await sleep(200);
  check("fav chip shows 1 card", (await evaluate("document.querySelectorAll('.card').length")) === 1);
  // clear favorites: wrong word first
  await evaluate("document.getElementById('clearInput').value='nope'; document.getElementById('clearBtn').click();");
  await sleep(200);
  check("wrong word does not clear", (await evaluate("document.getElementById('statFavs').textContent"))?.includes("1"));
  await evaluate("document.getElementById('clearInput').value='DELETE'; document.getElementById('clearBtn').click();");
  await sleep(200);
  check("DELETE clears favorites", (await evaluate("document.getElementById('statFavs').textContent"))?.includes("0"));

  // Surprise
  await evaluate("document.querySelector('[data-filter=\"all\"]').click();");
  await sleep(200);
  await evaluate("document.getElementById('surpriseBtn').click();");
  await sleep(250);
  check("surprise opens modal", (await evaluate("document.getElementById('modalWrap').hidden")) === false);
  const mname = await evaluate("document.querySelector('.mname').textContent");
  check("surprise shows a real district name", typeof mname === "string" && mname.length >= 3, mname);
  await evaluate("document.getElementById('mClose').click();");
  await sleep(200);

  // BN toggle
  await evaluate("document.getElementById('langBtn').click();");
  await sleep(250);
  check("BN title", (await evaluate("document.querySelector('h1').textContent")) === "\u099c\u09c7\u09b2\u09be \u0985\u09a8\u09cd\u09ac\u09c7\u09b7\u0995");
  check("BN lang persisted", (await evaluate("localStorage.getItem('dx-lang')")) === "bn");
  check("BN bengali digits in stats", (await evaluate("document.getElementById('statDistricts').textContent"))?.includes("\u09ec\u09ea"));
  await evaluate("document.getElementById('langBtn').click();");
  await sleep(250);
  check("EN toggle back", (await evaluate("document.querySelector('h1').textContent")) === "District Explorer");

  if (MOBILE) {
    check("390px no horizontal overflow", (await evaluate("document.documentElement.scrollWidth")) <= 390,
      "scrollWidth=" + (await evaluate("document.documentElement.scrollWidth")));
    await evaluate("document.querySelector('.card').click();");
    await sleep(250);
    check("modal works on mobile", (await evaluate("document.getElementById('modalWrap').hidden")) === false);
  }

  check("zero network requests", netRequests.length === 0, netRequests.join(" | "));
  check("zero console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  check("zero page exceptions", pageErrors.length === 0, pageErrors.join(" | "));
} catch (e) {
  failures.push("harness: " + e.message);
  console.log("FAIL - harness: " + e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill();
}

console.log("\n" + (checks - failures.length) + "/" + checks + " smoke checks passed" + (MOBILE ? " (mobile)" : " (desktop)"));
if (failures.length) { console.log("FAILURES: " + failures.join(", ")); process.exit(1); }
