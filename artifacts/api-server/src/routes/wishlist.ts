import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, wishlistTable, productsTable } from "@workspace/db";
import { enrichProduct, loadEnrichedProducts } from "../lib/products";
import { AddToWishlistBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/wishlist", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const items = await db.select().from(wishlistTable).where(eq(wishlistTable.userId, userId));
  const products = await loadEnrichedProducts(items.map((item) => item.productId));
  res.json(items
    .filter((item) => products.has(item.productId))
    .map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), product: products.get(item.productId)! })));
});

router.post("/wishlist", requireAuth, async (req, res): Promise<void> => {
  const parsed = AddToWishlistBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const userId = req.user!.id;
  const existing = await db.select().from(wishlistTable)
    .where(and(eq(wishlistTable.userId, userId), eq(wishlistTable.productId, parsed.data.productId)));
  if (existing.length > 0) { res.status(400).json({ error: "Already in wishlist" }); return; }
  const [item] = await db.insert(wishlistTable).values({ userId, productId: parsed.data.productId }).returning();
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString(), product: product ? await enrichProduct(product) : null });
});

router.delete("/wishlist/:productId", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const userId = req.user!.id;
  await db.delete(wishlistTable).where(and(eq(wishlistTable.productId, productId), eq(wishlistTable.userId, userId)));
  res.sendStatus(204);
});

export default router;
