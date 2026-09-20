import { test } from "node:test";
import assert from "node:assert/strict";
import { call, cleanupOrders, placeOrder, productBySlug, query, uniqueSession } from "./helpers.mjs";

const variantStock = async (id) => (await query(`SELECT stock FROM product_variants WHERE id=$1`, [id]))[0].stock;

test("variants carry options, labels and prices", async () => {
  const shoes = await productBySlug("running-shoes");
  assert.equal(shoes.variants.length, 8);
  assert.equal(shoes.variants[0].label, "مشکی / ۴۰", "option order is preserved");
  assert.equal(shoes.stock, shoes.variants.reduce((sum, v) => sum + v.stock, 0), "product stock mirrors the variants");
  assert.equal(shoes.variants[0].ownPrice, null);
  assert.equal(shoes.variants[0].salePrice, shoes.salePrice, "a variant without its own price inherits the product's");

  const phone = await productBySlug("smartphone-a55");
  const bigger = phone.variants.find((v) => v.label.startsWith("۲۵۶"));
  assert.equal(bigger.price, bigger.ownPrice, "a variant may cost more than the product");
  assert.ok(bigger.price > phone.price);
});

test("a product with variants needs one chosen", async () => {
  const session = uniqueSession("variant");
  const shoes = await productBySlug("running-shoes");
  const plain = await productBySlug("sunscreen");
  const soldOut = shoes.variants.find((v) => v.stock === 0);
  const available = shoes.variants.find((v) => v.stock > 0);

  assert.equal((await call("POST", "/cart", { productId: shoes.id, quantity: 1, sessionId: session })).status, 400);
  assert.equal((await call("POST", "/cart", { productId: plain.id, variantId: available.id, quantity: 1, sessionId: session })).status, 400);
  assert.equal((await call("POST", "/cart", { productId: shoes.id, variantId: soldOut.id, quantity: 1, sessionId: session })).status, 409);

  const added = await call("POST", "/cart", { productId: shoes.id, variantId: available.id, quantity: 1, sessionId: session });
  assert.equal(added.status, 200);
  assert.equal(added.data.items[0].variantLabel, available.label);
  assert.equal(added.data.items[0].availableStock, available.stock);

  const tooMany = await call("POST", "/cart", { productId: shoes.id, variantId: available.id, quantity: available.stock });
  assert.notEqual(tooMany.status, 200);
});

test("ordering moves variant stock and records the label", async (t) => {
  const created = [];
  t.after(() => cleanupOrders(created));

  const session = uniqueSession("variant-order");
  const shoes = await productBySlug("running-shoes");
  const variant = shoes.variants.find((v) => v.stock > 1);
  await call("POST", "/cart", { productId: shoes.id, variantId: variant.id, quantity: 2, sessionId: session });

  const before = { variant: await variantStock(variant.id), product: shoes.stock };
  const order = (await placeOrder(session)).data;
  created.push(order.id);

  assert.equal(order.items[0].variantName, variant.label);
  assert.equal(await variantStock(variant.id), before.variant - 2);
  assert.equal((await productBySlug("running-shoes")).stock, before.product - 2);

  const cancelled = await call("POST", `/orders/${order.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.equal(await variantStock(variant.id), before.variant, "cancelling restores variant stock");
});

test("admin variant editing keeps the data consistent", async () => {
  const shirt = await productBySlug("men-shirt");
  const toInput = (v) => ({ id: v.id, options: v.options, price: v.ownPrice, salePrice: v.ownSalePrice, stock: v.stock, sku: v.sku });

  const duplicate = await call("PUT", `/products/${shirt.id}/variants`, {
    variants: [...shirt.variants.map(toInput), { options: shirt.variants[0].options, stock: 1 }],
  });
  assert.equal(duplicate.status, 400, "the same combination twice is refused");

  const mismatched = await call("PUT", `/products/${shirt.id}/variants`, {
    variants: [...shirt.variants.map(toInput), { options: [{ name: "رنگ", value: "آبی" }], stock: 1 }],
  });
  assert.equal(mismatched.status, 400, "every variant needs the same option names");

  const replaced = await call("PUT", `/products/${shirt.id}/variants`, {
    variants: [{ ...toInput(shirt.variants[0]), stock: 20 }, { options: [{ name: "سایز", value: "S" }], stock: 3 }],
  });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.data.variants.length, 2);
  assert.equal(replaced.data.stock, 23, "product stock is recomputed");

  assert.equal((await call("PATCH", `/inventory/${shirt.id}/stock`, { stock: 99 })).status, 409, "stock is per variant");

  // Restore the seeded variants. The replaced rows are gone, so they are recreated
  // without ids rather than updated.
  const restore = await call("PUT", `/products/${shirt.id}/variants`, {
    variants: shirt.variants.map((v) => ({ ...toInput(v), id: null })),
  });
  assert.equal(restore.status, 200);
  assert.equal(restore.data.stock, shirt.stock);
});
