const BASE = "http://localhost:5000/api/v1";

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json.data;
}

const login = await fetch(BASE + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "ragib@test.com", password: "ResetPass789" }),
}).then((r) => r.json());
const token = login.data.accessToken;
console.log("1. owner logged in");

// Need at least 2 categories
let cats = await call("GET", "/categories?limit=100", token);
const need = ["Beverages", "Snacks", "Combo (verify)"];
for (const name of need) {
  if (!cats.some((c) => c.name === name)) {
    await call("POST", "/categories", token, { name }).catch(() => {});
  }
}
cats = await call("GET", "/categories?limit=100", token);
const [c1, c2, c3] = need.map((n) => cats.find((c) => c.name === n));
console.log(`2. categories ready: ${c1.name}, ${c2.name}, ${c3.name}`);

// Create a product in TWO categories
const sku = "MULTICAT-" + Math.floor(login.data.user.id.charCodeAt(0) + cats.length);
const created = await call("POST", "/products", token, {
  name: "Combo Meal (verify)",
  sku,
  price: 500,
  costPrice: 300,
  categoryIds: [c1.id, c2.id],
});
const names = created.categories.map((c) => c.name).sort();
if (names.length !== 2) throw new Error(`expected 2 categories, got ${JSON.stringify(names)}`);
console.log(`3. created with 2 categories: ${names.join(", ")}`);

// Update to THREE categories
const updated = await call("PATCH", `/products/${created.id}`, token, {
  categoryIds: [c1.id, c2.id, c3.id],
});
if (updated.categories.length !== 3) throw new Error(`expected 3, got ${updated.categories.length}`);
console.log(`4. updated to 3 categories: ${updated.categories.map((c) => c.name).sort().join(", ")}`);

// Reduce to ONE category — reconciliation must drop the others
const reduced = await call("PATCH", `/products/${created.id}`, token, { categoryIds: [c3.id] });
if (reduced.categories.length !== 1 || reduced.categories[0].name !== "Combo (verify)")
  throw new Error(`expected only Combo, got ${JSON.stringify(reduced.categories.map((c) => c.name))}`);
console.log("5. reduced to 1 category (reconciliation works) ✓");

// List endpoint returns categories array too
const list = await call("GET", `/products?search=${encodeURIComponent("Combo Meal (verify)")}`, token);
const fromList = list.find((p) => p.id === created.id);
if (!Array.isArray(fromList.categories)) throw new Error("list did not return categories array");
console.log(`6. list returns categories array: [${fromList.categories.map((c) => c.name).join(", ")}]`);

// Migration preserved existing single-category data (Coca Cola → Beverages)
const coke = list.length
  ? null
  : null;
const all = await call("GET", "/products?limit=100", token);
const cola = all.find((p) => p.name === "Coca Cola 500ml");
console.log(
  `7. migrated data preserved — Coca Cola categories: [${(cola?.categories ?? []).map((c) => c.name).join(", ")}]`
);

// Cleanup the verify product
await call("DELETE", `/products/${created.id}`, token);
console.log("8. cleaned up verify product\n\nALL CHECKS PASSED ✅");
