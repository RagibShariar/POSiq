import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Public pages
for (const [name, path] of [
  ["landing", "/"],
  ["login", "/login"],
  ["register", "/register"],
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: `screenshots/${name}.png` });
  console.log(`captured ${name}`);
}

// Authenticated flow: login as owner, land on dashboard
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });
await page.waitForSelector("text=Revenue — last 30 days", { timeout: 30000 });
await page.waitForTimeout(1200); // let the chart animate in
await page.screenshot({ path: "screenshots/dashboard.png" });
console.log("captured dashboard (authenticated)");

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
if (errors.length) console.log("PAGE ERRORS:", errors);

await browser.close();
