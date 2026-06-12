import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", "ragib@test.com");
await page.fill("#password", "ResetPass789");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard", { timeout: 30000 });
console.log("1. owner login");

await page.goto(`${BASE}/ai`, { waitUntil: "networkidle" });
await page.waitForSelector("text=AI Assistant", { timeout: 30000 });
console.log("2. AI page loaded (history preloaded if any)");

// Ask a live question — goes through Gemini
await page.fill('input[placeholder*="restock"]', "How much revenue did I make this week and what should I restock?");
await page.click('button[type="submit"]');
console.log("3. question sent, waiting for Gemini…");

// Wait for the pending dots to appear, then resolve into a real answer
await page.waitForSelector('[aria-label="Thinking"]', { timeout: 15000 });
await page.waitForSelector('[aria-label="Thinking"]', { state: "detached", timeout: 90000 });
await page.waitForTimeout(500);
const lastBubble = await page.locator(".bg-muted").last().innerText();
if (!lastBubble.trim()) throw new Error("Assistant bubble is empty");
console.log("4. live answer received:");
console.log("   " + lastBubble.split("\n").slice(0, 4).join("\n   "));
await page.screenshot({ path: "screenshots/ai-chat.png" });
console.log("5. screenshot saved");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("6. no console errors");

await browser.close();
