// End-to-end check for Feature 1 (Variations & Modifiers) against the running API.
const BASE = "http://localhost:5000/api/v1";

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

const me = await call("GET", "/users/me", token);
const branch = me.branches[0];
console.log(`2. branch: ${branch.name} (${branch.code})`);

// Ensure register is open
try {
  await call("POST", `/registers/${branch.id}/open`, token, { openingBalance: 1000 });
} catch {
  /* already open */
}

// Pick a product and give it stock
const products = await call("GET", "/products?limit=5", token);
const product = products[0];
console.log(`3. product: ${product.name} (${product.id})`);
await call("POST", `/inventory/${branch.id}/restock`, token, {
  items: [{ productId: product.id, quantity: 20, note: "verify-variations" }],
});

// Create a variation (price 100) and a modifier group + item (Extra Shot +75)
const variation = await call("POST", `/products/${product.id}/variations`, token, {
  name: "Large (verify)",
  price: 100,
});
console.log(`4. variation created: ${variation.name} ৳${variation.price}`);

const group = await call("POST", "/modifier-groups", token, {
  name: "Add-Ons (verify)",
  type: "ADDON",
  maxSelect: 3,
});
const modItem = await call("POST", `/modifier-groups/${group.id}/items`, token, {
  name: "Extra Shot",
  price: 75,
});
console.log(`5. modifier group + item: ${group.name} / ${modItem.name} +৳${modItem.price}`);

await call("POST", `/products/${product.id}/modifier-groups`, token, {
  modifierGroupId: group.id,
});

// Verify product detail returns variations + linked modifier group with items
const detail = await call("GET", `/products/${product.id}`, token);
if (!detail.variations.some((v) => v.id === variation.id)) throw new Error("variation missing in detail");
if (!detail.modifierGroups.some((l) => l.modifierGroup.id === group.id))
  throw new Error("modifier group not linked in detail");
if (detail.hasVariations !== true) throw new Error("hasVariations not set");
console.log("6. product detail includes variation + linked modifier group ✓");

// Create an order: 2× product (Large variation + Extra Shot, special note)
// Expected line price = (100 + 75) * 2 = 350
const expectedTotal = 350;
const order = await call("POST", "/orders", token, {
  branchId: branch.id,
  items: [
    {
      productId: product.id,
      quantity: 2,
      variationId: variation.id,
      modifiers: [{ modifierItemId: modItem.id, quantity: 1 }],
      specialNote: "extra hot",
    },
  ],
  payments: [{ method: "CASH", amount: expectedTotal, tendered: 500 }],
});
console.log(`7. order created: ${order.orderNumber} total ৳${order.totalAmount}`);

if (Number(order.totalAmount) !== expectedTotal)
  throw new Error(`total mismatch: got ${order.totalAmount}, expected ${expectedTotal}`);
const item = order.items[0];
if (item.variationName !== "Large (verify)") throw new Error("variationName not snapshotted");
if (item.specialNote !== "extra hot") throw new Error("specialNote not saved");
if (!item.modifiers?.some((m) => m.name === "Extra Shot" && Number(m.price) === 75))
  throw new Error("modifier not saved on order item");
const change = order.payments[0].changeGiven;
console.log(
  `8. line: ${item.productName} — ${item.variationName} ×${item.quantity}, +${item.modifiers[0].name}, note "${item.specialNote}", change ৳${change} ✓`
);

console.log("\nALL CHECKS PASSED ✅");
