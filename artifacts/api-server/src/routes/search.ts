import { Router, type IRouter } from "express";
import { sql, eq, desc } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { enrichProducts } from "../lib/products";
import { productSearchCondition, textSearchCondition } from "../lib/search";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "6"), 10) || 6, 1), 24);
  const productMatch = productSearchCondition(q);
  const categoryMatch = textSearchCondition(categoriesTable.nameFa, q);
  if (!productMatch || !categoryMatch) { res.json({ products: [], categories: [], total: 0 }); return; }

  const products = await db.select().from(productsTable)
    .where(productMatch)
    .orderBy(desc(sql`${productsTable.stock} > 0`), desc(productsTable.isFeatured), desc(productsTable.createdAt))
    .limit(limit);

  const cats = await db.select().from(categoriesTable).where(categoryMatch).limit(3);

  const enrichedProducts = await enrichProducts(products);

  const enrichedCats = await Promise.all(cats.map(async (c) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.categoryId, c.id));
    return { ...c, productCount: Number(count) };
  }));

  res.json({ products: enrichedProducts, categories: enrichedCats, total: enrichedProducts.length + enrichedCats.length });
});

export default router;
