import { test } from "node:test";
import assert from "node:assert/strict";
import { call, productBySlug, uniqueSession } from "./helpers.mjs";

test("cart rejects invalid quantities", async () => {
  const session = uniqueSession("qty");
  const product = await productBySlug("sunscreen");
  for (const quantity of [-4, 0, 1.5, 999]) {
    const res = await call("POST", "/cart", { productId: product.id, quantity, sessionId: session });
    assert.equal(res.status, 400, `quantity ${quantity} should be rejected`);
  }
});

test("cart refuses more than the available stock", async () => {
  const session = uniqueSession("stock");
  const outOfStock = await productBySlug("perfume-100");
  assert.equal(outOfStock.stock, 0);
  assert.equal((await call("POST", "/cart", { productId: outOfStock.id, quantity: 1, sessionId: session })).status, 409);

  const limited = await productBySlug("coffee-maker");
  const tooMany = await call("POST", "/cart", { productId: limited.id, quantity: limited.stock + 1, sessionId: session });
  assert.equal(tooMany.status, 409);
});

test("a cart item belongs to its session", async () => {
  const session = uniqueSession("owner");
  const other = uniqueSession("other");
  const product = await productBySlug("sunscreen");

  const cart = (await call("POST", "/cart", { productId: product.id, quantity: 2, sessionId: session })).data;
  assert.equal(cart.itemCount, 2);
  const itemId = cart.items[0].id;

  assert.equal((await call("PATCH", `/cart/${itemId}?sessionId=${other}`, { quantity: 5 })).status, 404);
  assert.equal((await call("DELETE", `/cart/${itemId}?sessionId=${other}`)).status, 404);
  assert.equal((await call("PATCH", `/cart/${itemId}`, { quantity: 5 })).status, 400, "sessionId is required");

  const updated = await call("PATCH", `/cart/${itemId}?sessionId=${session}`, { quantity: 3 });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.itemCount, 3);
  assert.equal((await call("PATCH", `/cart/${itemId}?sessionId=${session}`, { quantity: -2 })).status, 400);
  assert.equal((await call("DELETE", `/cart/${itemId}?sessionId=${session}`)).status, 200);
});

test("cart lines carry the current price", async () => {
  const session = uniqueSession("price");
  const product = await productBySlug("coffee-maker");
  const cart = (await call("POST", "/cart", { productId: product.id, quantity: 1, sessionId: session })).data;
  assert.equal(cart.items[0].price, product.salePrice ?? product.price);
  assert.equal(cart.items[0].availableStock, product.stock);
});
