import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { checkDiscount, findDiscountByCode } from "../lib/pricing";
import { db, discountsTable } from "@workspace/db";
import { CreateDiscountBody, ValidateDiscountBody } from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

function enrichDiscount(d: typeof discountsTable.$inferSelect) {
  return { ...d, value: Number(d.value), minOrder: d.minOrder ? Number(d.minOrder) : null, expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null };
}

router.post("/discounts/validate", async (req, res): Promise<void> => {
  const parsed = ValidateDiscountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { code, cartTotal } = parsed.data;
  const discount = await findDiscountByCode(code);
  const check = checkDiscount(discount, Math.max(0, cartTotal));
  if (!check.valid) { res.json({ valid: false, discountAmount: 0, message: check.message }); return; }
  res.json({ valid: true, discount: enrichDiscount(discount!), discountAmount: check.amount, message: null });
});

router.get("/discounts", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const discounts = await db.select().from(discountsTable);
  res.json(discounts.map(enrichDiscount));
});

router.post("/discounts", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDiscountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data: Record<string, unknown> = {
    ...parsed.data,
    value: String(parsed.data.value),
    minOrder: parsed.data.minOrder != null ? String(parsed.data.minOrder) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
  };
  const [disc] = await db.insert(discountsTable).values(data as typeof discountsTable.$inferInsert).returning();
  res.status(201).json(enrichDiscount(disc));
});

router.delete("/discounts/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(discountsTable).where(eq(discountsTable.id, id));
  res.sendStatus(204);
});

export default router;
