import { test } from "node:test";
import assert from "node:assert/strict";
import { asCustomer, call, cleanupOrders, placeOrder, productBySlug, query, sampleAddress, stockOf, uniqueSession } from "./helpers.mjs";

test("order pricing: current prices, discount rules, shipping from the database", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("order");
  const product = await productBySlug("sunscreen"); // 480,000, plenty in stock
  await call("POST", "/cart", { productId: product.id, quantity: 3, sessionId: session });

  await query(`INSERT INTO discounts (code, type, value) VALUES ('TESTHUGE','fixed',99999999) ON CONFLICT (code) DO NOTHING`);
  t.after(() => query(`DELETE FROM discounts WHERE code='TESTHUGE'`));

  const before = await stockOf("sunscreen");
  const res = await placeOrder(session, { discountCode: "TESTHUGE" });
  assert.equal(res.status, 201);
  created.push(res.data.id);

  const order = res.data;
  assert.equal(order.subtotal, 3 * (product.salePrice ?? product.price));
  assert.equal(order.discount, order.subtotal, "a fixed discount is capped at the subtotal");
  assert.equal(order.shippingCost, 30000, "standard shipping comes from the shipping method");
  assert.equal(order.total, 30000);
  assert.equal(order.customerPhone, "09123456789");
  assert.equal(await stockOf("sunscreen"), before - 3);
});

test("free shipping above the method's threshold", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("freeship");
  const product = await productBySlug("coffee-maker"); // 8,750,000 > 2,000,000
  await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session });

  const res = await placeOrder(session);
  assert.equal(res.status, 201);
  created.push(res.data.id);
  assert.equal(res.data.shippingCost, 0);
});

test("orders validate phone, shipping method and discount limits", async (t) => {
  const session = uniqueSession("invalid");
  const product = await productBySlug("sunscreen");
  await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session });

  const badPhone = await call("POST", "/orders", {
    sessionId: session, addressSnapshot: sampleAddress, shippingMethod: "standard",
    customerName: "تست", customerPhone: "12345",
  });
  assert.equal(badPhone.status, 400);
  assert.equal((await placeOrder(session, { shippingMethod: "teleport" })).status, 400);

  await query(`INSERT INTO discounts (code, type, value, max_uses, used_count) VALUES ('TESTUSED','fixed',10000,1,1) ON CONFLICT (code) DO NOTHING`);
  t.after(() => query(`DELETE FROM discounts WHERE code='TESTUSED'`));
  assert.equal((await placeOrder(session, { discountCode: "testused" })).status, 400, "an exhausted code is refused");

  assert.equal(await stockOf("sunscreen") >= 0, true);
});

test("customers cancel pending orders and stock returns", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("cancel");
  const product = await productBySlug("yoga-mat");
  await call("POST", "/cart", { productId: product.id, quantity: 2, sessionId: session });

  const before = await stockOf("yoga-mat");
  const order = (await placeOrder(session)).data;
  created.push(order.id);
  assert.equal(await stockOf("yoga-mat"), before - 2);

  const cancelled = await call("POST", `/orders/${order.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.status, "cancelled");
  assert.equal(await stockOf("yoga-mat"), before, "cancelling puts the stock back");

  assert.equal((await call("POST", `/orders/${order.id}/cancel`)).status, 400, "cancelling twice is refused");
  assert.equal(await stockOf("yoga-mat"), before, "the refused cancel changed nothing");
});

test("shipped orders need the shop, and returns follow the 14-day window", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("return");
  const product = await productBySlug("yoga-mat");
  await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session });
  const order = (await placeOrder(session)).data;
  created.push(order.id);

  assert.equal((await call("POST", `/orders/${order.id}/return`, { reason: "هنوز تحویل نشده" })).status, 400);

  await call("PATCH", `/orders/${order.id}`, { status: "shipped" });
  await asCustomer(async () => {
    assert.equal((await call("POST", `/orders/${order.id}/cancel`)).status, 400, "a shipped order is not customer-cancellable");
  });

  await call("PATCH", `/orders/${order.id}`, { status: "delivered" });
  assert.equal((await call("POST", `/orders/${order.id}/return`, { reason: "کم" })).status, 400, "the reason must be meaningful");

  const accepted = await call("POST", `/orders/${order.id}/return`, { reason: "کالا با توضیحات سایت مطابقت ندارد" });
  assert.equal(accepted.status, 200);
  assert.ok(accepted.data.returnRequestedAt);
  assert.equal((await call("POST", `/orders/${order.id}/return`, { reason: "درخواست دوباره‌ی مرجوعی" })).status, 400);

  await query(`UPDATE orders SET return_requested_at=NULL, updated_at=now() - interval '20 days' WHERE id=$1`, [order.id]);
  assert.equal((await call("POST", `/orders/${order.id}/return`, { reason: "خیلی دیر اقدام کردم" })).status, 400, "outside the window");
});

test("orders belong to their customer", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("owner");
  const product = await productBySlug("yoga-mat");
  await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session });
  const order = (await placeOrder(session)).data;
  created.push(order.id);
  await query(`UPDATE orders SET user_id=99999 WHERE id=$1`, [order.id]);

  await asCustomer(async () => {
    assert.equal((await call("GET", `/orders/${order.id}`)).status, 403);
    assert.equal((await call("POST", `/orders/${order.id}/cancel`)).status, 403);
  });
});

test("tracking reports a real order and 404s otherwise", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("track");
  const product = await productBySlug("yoga-mat");
  await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session });
  const order = (await placeOrder(session)).data;
  created.push(order.id);

  const tracking = await call("GET", `/shipping/track/${order.orderNumber}`);
  assert.equal(tracking.status, 200);
  assert.equal(tracking.data.status, "pending");
  assert.equal((await call("GET", "/shipping/track/NOPE123")).status, 404);
});
