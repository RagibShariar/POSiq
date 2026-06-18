import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "karim@test.com");
await page.fill("#password", "ManagerPass123");
await page.click("button[type=submit]");
await page.waitForURL("**/pos", { timeout: 30000 });

await page.waitForSelector("text=Lays Original", { timeout: 30000 });
await page.click("text=Lays Original"); // plain product → adds directly
await page.click('button:has-text("Charge")');
await page.waitForSelector("text=Take payment", { timeout: 10000 });
console.log("1. payment dialog open");

// Generic sources show a text label…
for (const label of ["Cash", "Due", "Compliment", "Others"]) {
  await page.waitForSelector(`button:has-text("${label}")`, { timeout: 5000 });
}
// …branded sources show their real logo (img alt)
for (const alt of ["Visa", "Mastercard", "Amex", "bKash", "Nagad", "Rocket", "Foodi"]) {
  await page.waitForSelector(`img[alt="${alt}"]`, { timeout: 5000 });
}
console.log("2. all payment sources rendered (logos + icons)");
await page.screenshot({ path: "screenshots/payment-sources.png" });

// Pay with bKash + TrxID
const dialog = page.locator('[role="dialog"]:has-text("Take payment")');
await dialog.locator('button:has(img[alt="bKash"])').click();
await dialog.locator('input[placeholder="e.g. 9HJ2KX1LM4"]').fill("BKASH-TRX-99");
await dialog.locator('button:has-text("Complete sale")').click();
await page.waitForSelector("text=Thank you for your purchase!", { timeout: 30000 });
const receipt = await page.locator("#receipt").innerText();
if (!receipt.includes("bKash")) throw new Error("receipt missing bKash label");
if (!receipt.includes("BKASH-TRX-99")) throw new Error("receipt missing TrxID");
console.log("3. paid with bKash; receipt shows bKash + TrxID");
await page.screenshot({ path: "screenshots/payment-receipt-bkash.png" });

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("4. no console errors");

await browser.close();
