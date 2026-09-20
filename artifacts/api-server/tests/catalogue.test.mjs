import { test } from "node:test";
import assert from "node:assert/strict";
import { call } from "./helpers.mjs";

const slugs = async (url) => ((await call("GET", url)).data.products ?? []).map((p) => p.slug);

test("Persian search folds spelling variants", async () => {
  const cases = [
    ["هدفون", "wireless-earbuds"],
    ["بی‌سیم", "wireless-earbuds"], // ZWNJ
    ["بی سیم", "wireless-earbuds"], // space
    ["بیسیم", "wireless-earbuds"], // joined
    ["هدفون بي سيم", "wireless-earbuds"], // Arabic yeh
    ["كفش", "running-shoes"], // Arabic kaf
    ["افتاب", "sunscreen"], // alef for alef-madda
    ["128", "smartphone-a55"], // Latin digits
    ["SPF۵۰", "sunscreen"], // Persian digits
    ["Coffee", "coffee-maker"], // English name
    ["سونیک", "wireless-earbuds"], // brand
    ["سیم هدفون", "wireless-earbuds"], // word order
  ];
  for (const [query, slug] of cases) {
    const live = await slugs(`/search?q=${encodeURIComponent(query)}&limit=24`);
    const list = await slugs(`/products?limit=50&q=${encodeURIComponent(query)}`);
    assert.ok(live.includes(slug), `live search "${query}" should find ${slug}`);
    assert.ok(list.includes(slug), `product list "${query}" should find ${slug}`);
  }
});

test("search requires every word and treats wildcards literally", async () => {
  assert.equal((await slugs(`/products?q=${encodeURIComponent("کفش لپ‌تاپ")}`)).length, 0);
  assert.equal((await slugs("/products?q=%25")).length, 0);
});

test("a parent category includes its sub-categories", async () => {
  const categories = (await call("GET", "/categories")).data;
  const digital = categories.find((c) => c.slug === "digital");
  const mobile = categories.find((c) => c.slug === "mobile");

  assert.equal(mobile.parentId, digital.id);
  assert.ok(digital.productCount >= mobile.productCount);

  const parent = (await call("GET", "/products?category=digital&limit=50")).data;
  const child = (await call("GET", "/products?category=mobile&limit=50")).data;
  assert.equal(parent.total, digital.productCount);
  assert.equal(child.total, mobile.productCount);
  assert.ok(parent.total > child.total, "the parent lists more than one of its children");
  assert.equal((await call("GET", "/products?category=does-not-exist")).data.total, 0);
});

test("category tree edits are guarded", async () => {
  const categories = (await call("GET", "/categories")).data;
  const digital = categories.find((c) => c.slug === "digital");
  const mobile = categories.find((c) => c.slug === "mobile");

  assert.equal((await call("POST", "/categories", { name: "X", nameFa: "ایکس", slug: "x-test", parentId: 999999 })).status, 400);
  assert.equal((await call("PATCH", `/categories/${digital.id}`, { parentId: mobile.id })).status, 400, "no loops");
  assert.equal((await call("PATCH", `/categories/${digital.id}`, { parentId: digital.id })).status, 400);
  assert.equal((await call("DELETE", `/categories/${digital.id}`)).status, 409, "it has children");
  assert.equal((await call("DELETE", `/categories/${mobile.id}`)).status, 409, "it has products");

  const temp = (await call("POST", "/categories", { name: "Temp", nameFa: "موقت", slug: "temp-test", parentId: digital.id })).data;
  assert.equal(temp.parentId, digital.id);
  assert.equal((await call("DELETE", `/categories/${temp.id}`)).status, 204);
});

test("products expose specifications and a slug lookup", async () => {
  const laptop = (await call("GET", "/products/slug/laptop-14")).data;
  assert.ok(laptop.specs.length > 0);
  assert.ok(laptop.specs.every((s) => s.name && s.value));
  assert.equal((await call("GET", "/products/slug/does-not-exist")).status, 404);
});
