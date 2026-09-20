import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";
import { categoryUsage, categoryWithCount, isValidParent, listCategoriesWithCounts } from "../lib/categories";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  res.json(await listCategoriesWithCounts());
});

router.post("/categories", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!(await isValidParent(null, parsed.data.parentId))) {
    res.status(400).json({ error: "دسته‌بندی والد نامعتبر است" }); return;
  }
  const [cat] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(await categoryWithCount(cat));
});

router.patch("/categories/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const parsed = UpdateCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  // Guards against loops: a category may not sit under itself or its own descendant.
  if ("parentId" in parsed.data && !(await isValidParent(id, parsed.data.parentId))) {
    res.status(400).json({ error: "دسته‌بندی والد نامعتبر است" }); return;
  }
  const [cat] = await db.update(categoriesTable).set(parsed.data).where(eq(categoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Category not found" }); return; }
  res.json(await categoryWithCount(cat));
});

router.delete("/categories/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const { children, products } = await categoryUsage(id);
  if (children > 0 || products > 0) {
    // Deleting would orphan products or sub-categories, which would hide them from the shop.
    res.status(409).json({
      error: children > 0
        ? "ابتدا زیردسته‌های این دسته‌بندی را حذف یا جابه‌جا کنید"
        : "این دسته‌بندی محصول دارد؛ ابتدا محصولات را به دسته‌بندی دیگری منتقل کنید",
    });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

export default router;
