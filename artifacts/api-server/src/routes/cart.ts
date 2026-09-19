import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, cartsTable, cartItemsTable, productsTable } from "@workspace/db";
import { AddToCartBody, UpdateCartItemBody } from "@workspace/api-zod";
import { currentPrice, loadEnrichedProducts } from "../lib/products";

const router: IRouter = Router();

// Per-line upper bound, on top of the product's stock.
const MAX_QUANTITY_PER_ITEM = 20;
const Quantity = z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM);
const SessionId = z.string().min(8).max(128);

async function getCartWithItems(sessionId: string) {
  let [cart] = await db.select().from(cartsTable).where(eq(cartsTable.sessionId, sessionId));
  if (!cart) {
    [cart] = await db.insert(cartsTable).values({ sessionId }).returning();
  }
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
  const products = await loadEnrichedProducts(items.map((item) => item.productId));
  const validItems = items
    .filter((item) => products.has(item.productId))
    .map((item) => ({ ...item, price: Number(item.price), product: products.get(item.productId)! }));
  const subtotal = validItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = validItems.reduce((s, i) => s + i.quantity, 0);
  return { id: cart.id, sessionId: cart.sessionId, items: validItems, subtotal, itemCount };
}

/**
 * Cart items are only reachable through the cart's session id, so one visitor
 * cannot change another visitor's cart by guessing item ids.
 */
async function findOwnedItem(req: Request, res: Response) {
  const itemId = parseInt(String(req.params.itemId), 10);
  const sessionId = SessionId.safeParse(req.query.sessionId);
  if (isNaN(itemId) || !sessionId.success) {
    res.status(400).json({ error: "sessionId required" });
    return null;
  }
  const [row] = await db
    .select({ item: cartItemsTable, sessionId: cartsTable.sessionId })
    .from(cartItemsTable)
    .innerJoin(cartsTable, eq(cartsTable.id, cartItemsTable.cartId))
    .where(and(eq(cartItemsTable.id, itemId), eq(cartsTable.sessionId, sessionId.data)));
  if (!row) {
    res.status(404).json({ error: "Item not found" });
    return null;
  }
  return row;
}

function stockError(res: Response, stock: number) {
  res.status(409).json({
    error: stock > 0
      ? `از این کالا فقط ${stock.toLocaleString("fa-IR")} عدد موجود است`
      : "این کالا موجود نیست",
  });
}

router.get("/cart", async (req, res): Promise<void> => {
  const sessionId = SessionId.safeParse(req.query.sessionId);
  if (!sessionId.success) { res.status(400).json({ error: "sessionId required" }); return; }
  res.json(await getCartWithItems(sessionId.data));
});

router.post("/cart", async (req, res): Promise<void> => {
  const parsed = AddToCartBody.extend({ quantity: Quantity, sessionId: SessionId }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "تعداد نامعتبر است" }); return; }
  const { productId, quantity, sessionId } = parsed.data;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  let [cart] = await db.select().from(cartsTable).where(eq(cartsTable.sessionId, sessionId));
  if (!cart) [cart] = await db.insert(cartsTable).values({ sessionId }).returning();

  const [existing] = await db.select().from(cartItemsTable).where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.productId, productId)));
  const newQuantity = (existing?.quantity ?? 0) + quantity;
  if (newQuantity > product.stock) { stockError(res, product.stock); return; }
  if (newQuantity > MAX_QUANTITY_PER_ITEM) { res.status(400).json({ error: "تعداد درخواستی بیش از حد مجاز است" }); return; }

  const price = String(currentPrice(product));
  if (existing) {
    await db.update(cartItemsTable).set({ quantity: newQuantity, price }).where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({ cartId: cart.id, productId, quantity, price });
  }
  res.json(await getCartWithItems(sessionId));
});

router.patch("/cart/:itemId", async (req, res): Promise<void> => {
  const parsed = UpdateCartItemBody.extend({ quantity: Quantity }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "تعداد نامعتبر است" }); return; }
  const owned = await findOwnedItem(req, res);
  if (!owned) return;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, owned.item.productId));
  if (product && parsed.data.quantity > product.stock) { stockError(res, product.stock); return; }

  await db.update(cartItemsTable).set({ quantity: parsed.data.quantity }).where(eq(cartItemsTable.id, owned.item.id));
  res.json(await getCartWithItems(owned.sessionId));
});

router.delete("/cart/:itemId", async (req, res): Promise<void> => {
  const owned = await findOwnedItem(req, res);
  if (!owned) return;
  await db.delete(cartItemsTable).where(eq(cartItemsTable.id, owned.item.id));
  res.json(await getCartWithItems(owned.sessionId));
});

export default router;
