import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, ordersTable, shippingMethodsTable } from "@workspace/db";

const router: IRouter = Router();

const STATUS_FA: Record<string, string> = {
  pending: "سفارش ثبت شد",
  processing: "در حال پردازش",
  shipped: "ارسال شد",
  delivered: "تحویل داده شد",
  cancelled: "لغو شد",
};

router.get("/shipping/methods", async (_req, res): Promise<void> => {
  const methods = await db.select().from(shippingMethodsTable);
  res.json(methods.map((m) => ({ ...m, price: Number(m.price), minOrderForFree: m.minOrderForFree ? Number(m.minOrderForFree) : null })));
});

// Looks up a real order by its order number or carrier tracking code. Only the
// order's status is returned, never the customer's name, phone or address.
router.get("/shipping/track/:trackingCode", async (req, res): Promise<void> => {
  const code = String(req.params.trackingCode).trim();
  if (!code || code.length > 64) { res.status(404).json({ error: "کد پیگیری یافت نشد" }); return; }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(or(eq(ordersTable.orderNumber, code), eq(ordersTable.trackingCode, code)));
  if (!order) { res.status(404).json({ error: "کد پیگیری یافت نشد" }); return; }

  const [method] = order.shippingMethod
    ? await db.select().from(shippingMethodsTable).where(eq(shippingMethodsTable.name, order.shippingMethod))
    : [];

  // Newest first: the page highlights the first event as the current state.
  const events = [
    { timestamp: order.createdAt.toISOString(), status: "pending", statusFa: STATUS_FA.pending, location: null },
  ];
  if (order.status !== "pending") {
    events.unshift({
      timestamp: order.updatedAt.toISOString(),
      status: order.status,
      statusFa: STATUS_FA[order.status] ?? order.status,
      location: null,
    });
  }

  const inTransit = order.status === "pending" || order.status === "processing" || order.status === "shipped";
  const estimatedDelivery = method && inTransit
    ? new Date(order.createdAt.getTime() + method.estimatedDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  res.json({
    trackingCode: order.trackingCode ?? order.orderNumber,
    status: order.status,
    statusFa: STATUS_FA[order.status] ?? order.status,
    carrier: method?.nameFa ?? null,
    estimatedDelivery,
    events,
  });
});

export default router;
