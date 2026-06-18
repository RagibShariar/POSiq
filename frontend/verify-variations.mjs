import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Cashier login → /pos
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
await page.fill("#email", "karim@test.com");
await page.fill("#password", "ManagerPass123");
await page.click("button[type=submit]");
await page.waitForURL("**/pos", { timeout: 30000 });
console.log("1. cashier login → /pos");

// Coca Cola now has a variation + modifier group, so clicking opens the config dialog
await page.waitForSelector("text=Coca Cola 500ml", { timeout: 30000 });
await page.click("text=Coca Cola 500ml");
await page.waitForSelector("text=Choose option", { timeout: 15000 });
console.log("2. item config dialog opened (variation + modifiers)");

// Pick the Large variation + Extra Shot modifier + special note
await page.click("text=Large (verify)");
await page.click("text=Extra Shot");
await page.fill("textarea", "no ice, extra cold");
await page.screenshot({ path: "screenshots/pos-config-dialog.png" });
console.log("3. screenshot: pos-config-dialog.png");

await page.click('button:has-text("Add to cart")');
await page.waitForSelector("text=Large (verify)", { timeout: 10000 }); // appears in cart line
console.log("4. configured line added to cart");
await page.screenshot({ path: "screenshots/pos-configured-cart.png" });

// Products → Modifiers tab
await page.goto(`${BASE}/products`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
// Owner-only? karim is MANAGER — products is visible. Click Modifiers tab.
await page.click('button:has-text("Modifiers")');
await page.waitForSelector("text=New modifier group", { timeout: 15000 });
await page.screenshot({ path: "screenshots/products-modifiers-tab.png" });
console.log("5. screenshot: products-modifiers-tab.png");

if (errors.length) console.log("PAGE ERRORS:", errors);
else console.log("6. no console errors");

await browser.close();
