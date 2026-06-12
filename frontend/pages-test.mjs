import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });

// ── Owner pages ──
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`owner: ${e.message}`));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForLoadState("networkidle");
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });

const checks = [
  ["/orders", "ORD-2026-00001"],
  ["/team", "Karim Manager"],
  ["/branches", "Gulshan Branch"],
  ["/reports", "Top sellers"],
  ["/settings", "Business profile"],
];
for (const [path, marker] of checks) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector(`text=${marker}`, { timeout: 30000 });
  console.log(`OK ${path} (found "${marker}")`);
}
await page.goto(`${BASE}/orders`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("text=ORD-2026-00001", { timeout: 15000 });
await page.screenshot({ path: "screenshots/orders.png" });

// ── Super admin ──
const admin = await browser.newPage({ viewport: { width: 1366, height: 800 } });
admin.on("pageerror", (e) => errors.push(`admin: ${e.message}`));
await admin.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await admin.waitForLoadState("networkidle");
await admin.fill("#email", "admin@smartpos.dev");
await admin.fill("#password", "SuperAdminPass2026!");
await admin.click("button[type=submit]");
await admin.waitForURL("**/admin", { timeout: 30000 });
await admin.waitForSelector("text=Test Cafe", { timeout: 30000 });
await admin.waitForSelector("text=GMV this month", { timeout: 15000 });
console.log("OK /admin (stats + business table)");
await admin.screenshot({ path: "screenshots/admin-panel.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("ALL PAGES OK — no console errors");

await browser.close();
