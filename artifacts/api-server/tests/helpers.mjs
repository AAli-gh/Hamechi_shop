/**
 * Shared helpers for the API tests.
 *
 * They run against a server started with DEV_AUTH=true and RATE_LIMITS=off,
 * on a database filled by `pnpm --filter @workspace/db run seed`:
 *
 *   pnpm --filter @workspace/api-server run test
 */
import pg from "pg";

export const API = (process.env.API_URL ?? "http://127.0.0.1:8090").replace(/\/$/, "") + "/api";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";

export async function call(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Some endpoints answer 204 with no body.
  }
  return { status: res.status, data };
}

export async function withDb(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export const query = (sql, params) => withDb((db) => db.query(sql, params).then((r) => r.rows));

/** The dev-auth user is an admin; some rules only apply to ordinary customers. */
export async function asCustomer(fn) {
  await call("GET", "/auth/me"); // make sure the dev user exists
  await query(`UPDATE users SET role='customer' WHERE mobile='09120000000'`);
  try {
    return await fn();
  } finally {
    await query(`UPDATE users SET role='admin' WHERE mobile='09120000000'`);
  }
}

export const productBySlug = async (slug) => (await call("GET", `/products/slug/${slug}`)).data;
export const stockOf = async (slug) => (await query(`SELECT stock FROM products WHERE slug=$1`, [slug]))[0].stock;
export const uniqueSession = (name) => `test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const sampleAddress = JSON.stringify({
  province: "گیلان",
  city: "رشت",
  street: "خیابان مطهری، کوچه دوم، پلاک ۱۴",
  postalCode: "1234567890",
});

export async function placeOrder(sessionId, extra = {}) {
  return call("POST", "/orders", {
    sessionId,
    addressSnapshot: sampleAddress,
    shippingMethod: "standard",
    customerName: "مشتری تست",
    customerPhone: "09123456789",
    ...extra,
  });
}

/** Removes orders created by a test and puts their stock back. */
export async function cleanupOrders(orderIds) {
  for (const id of orderIds.filter(Boolean)) {
    await query(
      `UPDATE products p SET stock = p.stock + i.qty
         FROM (SELECT product_id, sum(quantity) qty FROM order_items
                WHERE order_id = $1 GROUP BY product_id) i
        WHERE p.id = i.product_id
          AND (SELECT status FROM orders WHERE id = $1) <> 'cancelled'`,
      [id],
    );
    await query(
      `UPDATE product_variants v SET stock = v.stock + i.qty
         FROM (SELECT variant_id, sum(quantity) qty FROM order_items
                WHERE order_id = $1 AND variant_id IS NOT NULL GROUP BY variant_id) i
        WHERE v.id = i.variant_id
          AND (SELECT status FROM orders WHERE id = $1) <> 'cancelled'`,
      [id],
    );
    await query(`DELETE FROM order_items WHERE order_id=$1`, [id]);
    await query(`DELETE FROM orders WHERE id=$1`, [id]);
  }
}
