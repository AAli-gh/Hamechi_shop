import { Router, type IRouter } from "express";
import { db, productsTable, orderItemsTable } from "@workspace/db";
import { enrichProducts } from "../lib/products";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/products/best-sellers", async (_req, res) => {
  const soldRows = await db
    .select({ productId: orderItemsTable.productId, totalSold: sql<number>`sum(${orderItemsTable.quantity})` })
    .from(orderItemsTable)
    .groupBy(orderItemsTable.productId)
    .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
    .limit(20);

  if (soldRows.length > 0) {
    const ids = soldRows.map(r => r.productId);
    const products = await db.select().from(productsTable).where(sql`${productsTable.id} = ANY(${ids})`);
    const sorted = ids.map(id => products.find(p => p.id === id)).filter(Boolean) as typeof products;
    const enriched = await enrichProducts(sorted.slice(0, 8));
    res.json(enriched);
    return;
  }

  const flagged = await db.select().from(productsTable).where(eq(productsTable.isBestSeller, true)).limit(8);
  if (flagged.length > 0) {
    const enriched = await enrichProducts(flagged);
    res.json(enriched);
    return;
  }

  const featured = await db.select().from(productsTable).where(eq(productsTable.isFeatured, true)).orderBy(desc(productsTable.createdAt)).limit(8);
  const enriched = await enrichProducts(featured);
  res.json(enriched);
});

export default router;
