import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import { db, productsTable, productVariantsTable, cartItemsTable, categoriesTable } from "@workspace/db";
import { enrichProduct, enrichProducts, syncProductStock } from "../lib/products";
import { productSearchCondition } from "../lib/search";
import { onStockChanged } from "../lib/notifications";
import {
  ListProductsQueryParams,
  SetProductVariantsBody,
  CreateProductBody,
  GetProductParams,
  UpdateProductParams,
  UpdateProductBody,
  DeleteProductParams,
  GetRelatedProductsParams,
} from "@workspace/api-zod";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router: IRouter = Router();

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { q, category, minPrice, maxPrice, sort, page = 1, inStock, featured, flashSale, ageGroup } = params.data;
  const limit = Math.min(Math.max(Number(params.data.limit ?? 12), 1), 100);

  const conditions = [];
  const searchMatch = q ? productSearchCondition(q) : undefined;
  if (searchMatch) conditions.push(searchMatch);
  if (category) {
    const [cat] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.slug, category));
    if (cat) conditions.push(eq(productsTable.categoryId, cat.id));
  }
  if (minPrice !== undefined) conditions.push(gte(productsTable.price, String(minPrice)));
  if (maxPrice !== undefined) conditions.push(lte(productsTable.price, String(maxPrice)));
  if (inStock) conditions.push(gte(productsTable.stock, 1));
  if (featured) conditions.push(eq(productsTable.isFeatured, true));
  if (flashSale) conditions.push(eq(productsTable.isFlashSale, true));
  if (ageGroup) conditions.push(eq(productsTable.ageGroup, ageGroup));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  let orderBy;
  if (sort === "price_asc") orderBy = asc(productsTable.price);
  else if (sort === "price_desc") orderBy = desc(productsTable.price);
  else if (sort === "newest") orderBy = desc(productsTable.createdAt);
  else orderBy = desc(productsTable.createdAt);

  const offset = (Number(page) - 1) * Number(limit);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(whereClause);
  const products = await db.select().from(productsTable).where(whereClause).orderBy(orderBy).limit(Number(limit)).offset(offset);
  const enriched = await enrichProducts(products);

  res.json({ products: enriched, total: Number(count), page: Number(page), totalPages: Math.ceil(Number(count) / Number(limit)) });
});

router.get("/products/featured", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.isFeatured, true)).limit(8);
  const enriched = await enrichProducts(products);
  res.json(enriched);
});

router.get("/products/flash-sale", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.isFlashSale, true)).limit(8);
  const enriched = await enrichProducts(products);
  res.json(enriched);
});

router.get("/products/new-arrivals", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt)).limit(8);
  const enriched = await enrichProducts(products);
  res.json(enriched);
});

router.get("/products/slug/:slug", async (req, res): Promise<void> => {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, String(req.params.slug)));
  if (!product) { res.status(404).json({ error: "محصول یافت نشد" }); return; }
  res.json(await enrichProduct(product));
});

// Replaces the product's variant list: rows with an id are updated, rows without
// one are created, and variants missing from the list are deleted.
router.put("/products/:id/variants", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const productId = parseInt(String(req.params.id), 10);
  const parsed = SetProductVariantsBody.safeParse(req.body);
  if (isNaN(productId) || !parsed.success) { res.status(400).json({ error: "اطلاعات تنوع‌ها معتبر نیست" }); return; }
  const input = parsed.data.variants.map((v) => ({
    ...v,
    options: v.options.map((o) => ({ name: o.name.trim(), value: o.value.trim() })),
  }));

  // Every variant must use the same option names in the same order, and each
  // combination of values may appear only once.
  const optionNames = input[0]?.options.map((o) => o.name).join("|");
  if (input.some((v) => v.options.map((o) => o.name).join("|") !== optionNames)) {
    res.status(400).json({ error: "همه‌ی تنوع‌ها باید ویژگی‌های یکسانی داشته باشند" }); return;
  }
  const combos = input.map((v) => v.options.map((o) => o.value).join("|"));
  if (new Set(combos).size !== combos.length) {
    res.status(400).json({ error: "ترکیب تکراری در تنوع‌ها وجود دارد" }); return;
  }
  if (input.some((v) => !Number.isInteger(v.stock) || v.stock < 0 || (v.price != null && v.price < 0))) {
    res.status(400).json({ error: "قیمت و موجودی نمی‌توانند منفی باشند" }); return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "محصول یافت نشد" }); return; }

  const ok = await db.transaction(async (tx) => {
    const existing = await tx.select({ id: productVariantsTable.id }).from(productVariantsTable)
      .where(eq(productVariantsTable.productId, productId));
    const existingIds = new Set(existing.map((v) => v.id));
    if (input.some((v) => v.id != null && !existingIds.has(v.id))) return false;

    const keptIds = new Set(input.filter((v) => v.id != null).map((v) => v.id!));
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
    if (removedIds.length > 0) {
      // Order items keep their own snapshot, but open carts must not point at deleted variants.
      await tx.delete(cartItemsTable).where(inArray(cartItemsTable.variantId, removedIds));
      await tx.delete(productVariantsTable).where(inArray(productVariantsTable.id, removedIds));
    }

    for (const [sortOrder, v] of input.entries()) {
      const values = {
        options: v.options,
        sku: v.sku || null,
        price: v.price != null ? String(v.price) : null,
        salePrice: v.salePrice != null ? String(v.salePrice) : null,
        stock: v.stock,
        sortOrder,
      };
      if (v.id != null) {
        await tx.update(productVariantsTable).set(values).where(eq(productVariantsTable.id, v.id));
      } else {
        await tx.insert(productVariantsTable).values({ ...values, productId });
      }
    }
    await syncProductStock(productId, tx);
    return true;
  });
  if (!ok) { res.status(400).json({ error: "تنوع انتخاب‌شده متعلق به این محصول نیست" }); return; }

  const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  onStockChanged(productId, product.stock, updated.stock);
  res.json(await enrichProduct(updated));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(await enrichProduct(product));
});

router.patch("/products/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  const [variantCount] = await db.select({ count: sql<number>`count(*)` }).from(productVariantsTable)
    .where(eq(productVariantsTable.productId, id));
  // With variants, stock is the sum of variant stock and is maintained by syncProductStock.
  if (Number(variantCount?.count ?? 0) > 0) delete updateData.stock;
  if (parsed.data.images) updateData.images = parsed.data.images;
  if (parsed.data.flashSaleEndsAt) updateData.flashSaleEndsAt = new Date(parsed.data.flashSaleEndsAt);
  const [before] = await db.select({ stock: productsTable.stock }).from(productsTable).where(eq(productsTable.id, id));
  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  onStockChanged(id, before?.stock ?? 0, product.stock);
  res.json(await enrichProduct(product));
});

router.delete("/products/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.transaction(async (tx) => {
    await tx.delete(cartItemsTable).where(eq(cartItemsTable.productId, id));
    await tx.delete(productVariantsTable).where(eq(productVariantsTable.productId, id));
    await tx.delete(productsTable).where(eq(productsTable.id, id));
  });
  res.sendStatus(204);
});

router.get("/products/:id/related", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) { res.json([]); return; }
  const related = await db.select().from(productsTable)
    .where(and(eq(productsTable.categoryId, product.categoryId), sql`${productsTable.id} != ${id}`))
    .limit(4);
  res.json(await enrichProducts(related));
});

router.post("/products", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data: Record<string, unknown> = {
    ...parsed.data,
    price: String(parsed.data.price),
    salePrice: parsed.data.salePrice != null ? String(parsed.data.salePrice) : null,
    flashSaleEndsAt: parsed.data.flashSaleEndsAt ? new Date(parsed.data.flashSaleEndsAt) : null,
  };
  const [product] = await db.insert(productsTable).values(data as typeof productsTable.$inferInsert).returning();
  res.status(201).json(await enrichProduct(product));
});

export default router;
