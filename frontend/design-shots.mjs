import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });

for (const opt of ["option-a", "option-b", "option-c"]) {
  await page.goto(`${BASE}/design/${opt}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `screenshots/design-${opt}.png` });
  console.log(`captured ${opt}`);
}

await browser.close();
