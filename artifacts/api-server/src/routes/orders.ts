import { Router, type IRouter } from "express";
import { eq, desc, and, sql, gte, lt, or, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartsTable, productsTable, discountsTable, shippingMethodsTable, productVariantsTable } from "@workspace/db";
import { currentPrice, variantLabel } from "../lib/products";
import { checkDiscount, findDiscountByCode, shippingCost, toAsciiDigits } from "../lib/pricing";
import { CreateOrderBody, UpdateOrderBody, ListOrdersQueryParams } from "@workspace/api-zod";
import { optionalAuth, requireAdmin, requireAuth } from "../middleware/auth";

const router: IRouter = Router();

function enrichOrder(order: typeof ordersTable.$inferSelect, items: typeof orderItemsTable.$inferSelect[]) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    discount: Number(order.discount),
    total: Number(order.total),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: items.map((i) => ({ ...i, price: Number(i.price) })),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const { userId, status, page = 1 } = params.data;
  const limit = Math.min(Number(params.data.limit ?? 10), 50);
  const conditions = [];
  const canViewAll = req.user?.role === "admin" || req.user?.role === "manager";
  const effectiveUserId = canViewAll ? userId : req.user!.id;
  if (effectiveUserId) conditions.push(eq(ordersTable.userId, effectiveUserId));
  if (status) conditions.push(eq(ordersTable.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where);
  const orders = await db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  const items = orders.length
    ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orders.map((o) => o.id)))
    : [];
  const enriched = orders.map((o) => enrichOrder(o, items.filter((i) => i.orderId === o.id)));
  res.json({ orders: enriched, total: Number(count), page: Number(page), totalPages: Math.ceil(Number(count) / Number(limit)) });
});

const MobilePhone = z.string().transform(toAsciiDigits).pipe(z.string().regex(/^09\d{9}$/, "INVALID_PHONE"));

const OrderBody = CreateOrderBody.extend({
  customerName: z.string().trim().min(2).max(80),
  customerPhone: MobilePhone,
  addressSnapshot: z.string().min(10).max(1000),
  shippingMethod: z.string().min(1).max(50),
  notes: z.string().max(1000).nullish(),
  discountCode: z.string().max(50).nullish(),
});

class OrderError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

router.post("/orders", optionalAuth, async (req, res): Promise<void> => {
  const parsed = OrderBody.safeParse(req.body);
  if (!parsed.success) {
    const invalidPhone = parsed.error.issues.some((issue) => issue.message === "INVALID_PHONE");
    res.status(400).json({ error: invalidPhone ? "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)" : "اطلاعات سفارش کامل یا معتبر نیست" });
    return;
  }
  const body = parsed.data;

  try {
    const orderWithItems = await db.transaction(async (tx) => {
      const [cart] = await tx.select().from(cartsTable).where(eq(cartsTable.sessionId, body.sessionId));
      if (!cart) throw new OrderError(400, "سبد خرید پیدا نشد");

      const cartItems = await tx.select().from(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
      if (cartItems.length === 0) throw new OrderError(400, "سبد خرید خالی است");

      const [method] = await tx.select().from(shippingMethodsTable).where(eq(shippingMethodsTable.name, body.shippingMethod));
      if (!method) throw new OrderError(400, "روش ارسال نامعتبر است");

      // Reserve stock first; each line is charged the product's price at order time,
      // not the price it had when it was added to the cart.
      const lines = [];
      for (const ci of cartItems) {
        // A variant line is limited by the variant's stock; products.stock (their sum) moves with it.
        let variant: typeof productVariantsTable.$inferSelect | undefined;
        if (ci.variantId != null) {
          [variant] = await tx
            .update(productVariantsTable)
            .set({ stock: sql`${productVariantsTable.stock} - ${ci.quantity}` })
            .where(and(eq(productVariantsTable.id, ci.variantId), gte(productVariantsTable.stock, ci.quantity)))
            .returning();
          if (!variant) throw new OrderError(409, "یکی از کالاهای سبد موجودی کافی ندارد");
        }
        const [product] = await tx
          .update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${ci.quantity}`, updatedAt: new Date() })
          .where(and(eq(productsTable.id, ci.productId), gte(productsTable.stock, ci.quantity)))
          .returning();
        if (!product) throw new OrderError(409, "یکی از کالاهای سبد موجودی کافی ندارد");
        lines.push({ product, variant, quantity: ci.quantity, price: currentPrice(product, variant) });
      }

      const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

      let discount = 0;
      if (body.discountCode) {
        const code = await findDiscountByCode(body.discountCode, tx);
        const check = checkDiscount(code, subtotal);
        if (!check.valid) throw new OrderError(400, check.message);
        // Conditional increment so two simultaneous orders cannot both take the last use.
        const [claimed] = await tx.update(discountsTable)
          .set({ usedCount: sql`${discountsTable.usedCount} + 1` })
          .where(and(
            eq(discountsTable.id, code!.id),
            or(isNull(discountsTable.maxUses), lt(discountsTable.usedCount, discountsTable.maxUses)),
          ))
          .returning({ id: discountsTable.id });
        if (!claimed) throw new OrderError(400, "ظرفیت کد تخفیف پر شده است");
        discount = check.amount;
      }

      const shipping = shippingCost(method, subtotal);
      const total = subtotal - discount + shipping;
      const orderNumber = `BZ${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;

      const [order] = await tx.insert(ordersTable).values({
        userId: req.user?.id ?? null, orderNumber, status: "pending", inventoryReserved: true,
        subtotal: String(subtotal), shippingCost: String(shipping), discount: String(discount), total: String(total),
        addressSnapshot: body.addressSnapshot, shippingMethod: method.name,
        notes: body.notes ?? null, customerName: body.customerName, customerPhone: body.customerPhone,
      }).returning();

      const orderItems = await tx.insert(orderItemsTable).values(lines.map(({ product, variant, quantity, price }) => ({
        orderId: order.id,
        productId: product.id,
        variantId: variant?.id ?? null,
        variantName: variant ? variantLabel(variant.options) : null,
        productName: product.nameFa || product.name || "محصول",
        quantity,
        price: String(price),
        image: (product.images as string[])[0] || null,
      }))).returning();

      await tx.delete(cartItemsTable).where(eq(cartItemsTable.cartId, cart.id));
      return enrichOrder(order, orderItems);
    });

    res.status(201).json(orderWithItems);
  } catch (error) {
    if (error instanceof OrderError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "order creation failed");
    res.status(500).json({ error: "ثبت سفارش انجام نشد" });
  }
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const canView = req.user?.role === "admin" || req.user?.role === "manager" || order.userId === req.user?.id;
  if (!canView) { res.status(403).json({ error: "دسترسی غیرمجاز" }); return; }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  res.json(enrichOrder(order, items));
});

router.patch("/orders/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!current) return null;

    if (parsed.data.status === "cancelled" && current.status !== "cancelled" && current.inventoryReserved) {
      const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
      for (const item of items) {
        if (item.variantId != null) {
          await tx.update(productVariantsTable)
            .set({ stock: sql`${productVariantsTable.stock} + ${item.quantity}` })
            .where(eq(productVariantsTable.id, item.variantId));
        }
        await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${item.quantity}`, updatedAt: new Date() })
          .where(eq(productsTable.id, item.productId));
      }
    }

    const [order] = await tx.update(ordersTable)
      .set({
        ...parsed.data,
        inventoryReserved: parsed.data.status === "cancelled" ? false : current.inventoryReserved,
        updatedAt: new Date(),
      })
      .where(eq(ordersTable.id, id))
      .returning();
    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    return enrichOrder(order, items);
  });

  if (!result) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(result);
});

export default router;
