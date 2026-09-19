import { Router, type IRouter } from "express";
import { ilike, or, sql, eq } from "drizzle-orm";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { enrichProducts } from "../lib/products";

const router: IRouter = Router();

router.get("/search", async (req, res): Promise<void> => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || "6"), 10) || 6, 1), 24);
  if (!q) { res.json({ products: [], categories: [], total: 0 }); return; }

  const products = await db.select().from(productsTable)
    .where(or(ilike(productsTable.nameFa, `%${q}%`), ilike(productsTable.name, `%${q}%`), ilike(productsTable.brand, `%${q}%`)))
    .limit(limit);

  const cats = await db.select().from(categoriesTable)
    .where(or(ilike(categoriesTable.nameFa, `%${q}%`), ilike(categoriesTable.name, `%${q}%`)))
    .limit(3);

  const enrichedProducts = await enrichProducts(products);

  const enrichedCats = await Promise.all(cats.map(async (c) => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.categoryId, c.id));
    return { ...c, productCount: Number(count) };
  }));

  res.json({ products: enrichedProducts, categories: enrichedCats, total: enrichedProducts.length + enrichedCats.length });
});

export default router;
