import { test } from "node:test";
import assert from "node:assert/strict";
import { asCustomer, call, productBySlug, query } from "./helpers.mjs";

test("public endpoints stay public for customers", async () => {
  await asCustomer(async () => {
    for (const url of ["/shipping/methods", "/sitemap.xml", "/robots.txt", "/products/best-sellers", "/categories", "/banners"]) {
      assert.equal((await call("GET", url)).status, 200, `${url} should be public`);
    }
    const subscribe = await call("POST", "/newsletter/subscribe", { email: `test-${Date.now()}@example.com` });
    assert.ok([200, 201].includes(subscribe.status));
  });
  await query(`DELETE FROM newsletters WHERE email LIKE 'test-%@example.com'`);
});

test("admin areas are closed to customers", async () => {
  await asCustomer(async () => {
    for (const url of ["/admin/stats", "/admin/reports", "/inventory", "/sms/stats", "/discounts", "/newsletter/subscribers"]) {
      assert.equal((await call("GET", url)).status, 403, `${url} should be admin-only`);
    }
    assert.equal((await call("POST", "/products", { name: "x", nameFa: "x", slug: "x", price: 1, images: [], categoryId: 1, stock: 1 })).status, 403);
    assert.equal((await call("POST", "/upload")).status, 403);
  });
});

test("a discount code can be checked but not listed", async () => {
  await asCustomer(async () => {
    const valid = await call("POST", "/discounts/validate", { code: "WELCOME10", cartTotal: 1000000 });
    assert.equal(valid.status, 200);
    assert.equal(valid.data.valid, true);

    const belowMinimum = await call("POST", "/discounts/validate", { code: "KOODAK50", cartTotal: 1000 });
    assert.equal(belowMinimum.data.valid, false);

    const unknown = await call("POST", "/discounts/validate", { code: "NOPE", cartTotal: 1000000 });
    assert.equal(unknown.data.valid, false);
  });
});

test("reviews need an account and a sane rating", async (t) => {
  const product = await productBySlug("sunscreen");
  t.after(() => query(`DELETE FROM reviews WHERE comment='نظر تست خودکار'`));

  assert.equal((await call("POST", "/reviews", { productId: product.id, authorName: "تست", rating: 10 })).status, 400);
  const created = await call("POST", "/reviews", { productId: product.id, authorName: "تست", rating: 4, comment: "نظر تست خودکار" });
  assert.equal(created.status, 201);
  assert.ok(created.data.userId, "the review is tied to the signed-in account");
});

test("saved addresses keep exactly one default", async (t) => {
  const me = (await call("GET", "/auth/me")).data;
  // Start from an empty address book so "the oldest one is promoted" is unambiguous.
  const clear = async () => {
    for (const a of (await call("GET", `/users/${me.id}/addresses`)).data) {
      await call("DELETE", `/users/${me.id}/addresses/${a.id}`);
    }
  };
  await clear();
  t.after(clear);

  const base = { province: "تهران", city: "تهران", street: "خیابان آزادی، پلاک ۱۲", postalCode: "1234567890" };
  assert.equal((await call("POST", `/users/${me.id}/addresses`, { ...base, postalCode: "12345" })).status, 400);
  assert.equal((await call("POST", `/users/${me.id}/addresses`, { ...base, street: "کوچه" })).status, 400);

  const first = (await call("POST", `/users/${me.id}/addresses`, { ...base, label: "تست ۱" })).data;
  const second = (await call("POST", `/users/${me.id}/addresses`, { ...base, label: "تست ۲", isDefault: true })).data;
  assert.equal(second.isDefault, true);

  const list = (await call("GET", `/users/${me.id}/addresses`)).data;
  assert.equal(list.filter((a) => a.isDefault).length, 1);

  assert.equal((await call("DELETE", `/users/${me.id}/addresses/${second.id}`)).status, 204);
  const after = (await call("GET", `/users/${me.id}/addresses`)).data;
  assert.equal(after.find((a) => a.id === first.id).isDefault, true, "the remaining address becomes default");
  assert.equal((await call("DELETE", `/users/${me.id}/addresses/999999`)).status, 404);

  await asCustomer(async () => {
    assert.equal((await call("GET", "/users/999999/addresses")).status, 403);
  });
});
