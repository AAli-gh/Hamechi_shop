import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, productsTable, productVariantsTable, categoriesTable, reviewsTable, type VariantOption } from "@workspace/db";

type ProductRow = typeof productsTable.$inferSelect;
type VariantRow = typeof productVariantsTable.$inferSelect;
type Executor = Pick<typeof db, "select" | "update">;

export function variantLabel(options: VariantOption[]): string {
  return options.map((o) => o.value).join(" / ");
}

/**
 * A variant's own prices win. A variant with its own base price does not inherit the
 * product's sale price (it was set against a different base); one without does.
 */
function variantPricing(product: Pick<ProductRow, "price" | "salePrice">, variant: Pick<VariantRow, "price" | "salePrice">) {
  const price = Number(variant.price ?? product.price);
  const inheritedSale = variant.price == null ? product.salePrice : null;
  const sale = variant.salePrice ?? inheritedSale;
  return { price, salePrice: sale != null ? Number(sale) : null };
}

function shapeVariant(product: ProductRow, variant: VariantRow) {
  return {
    id: variant.id,
    options: variant.options,
    label: variantLabel(variant.options),
    sku: variant.sku,
    ...variantPricing(product, variant),
    ownPrice: variant.price != null ? Number(variant.price) : null,
    ownSalePrice: variant.salePrice != null ? Number(variant.salePrice) : null,
    stock: variant.stock,
  };
}

/**
 * Shapes product rows for the API, loading category names, review stats and
 * variants for the whole batch in three queries instead of several per product.
 */
export async function enrichProducts(products: ProductRow[]) {
  if (products.length === 0) return [];

  const productIds = [...new Set(products.map((p) => p.id))];
  const categoryIds = [...new Set(products.map((p) => p.categoryId))];

  const [categories, reviewStats, variants] = await Promise.all([
    db
      .select({ id: categoriesTable.id, nameFa: categoriesTable.nameFa })
      .from(categoriesTable)
      .where(inArray(categoriesTable.id, categoryIds)),
    db
      .select({
        productId: reviewsTable.productId,
        avgRating: sql<number>`avg(${reviewsTable.rating})`,
        count: sql<number>`count(*)`,
      })
      .from(reviewsTable)
      .where(inArray(reviewsTable.productId, productIds))
      .groupBy(reviewsTable.productId),
    db
      .select()
      .from(productVariantsTable)
      .where(inArray(productVariantsTable.productId, productIds))
      .orderBy(asc(productVariantsTable.sortOrder), asc(productVariantsTable.id)),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.nameFa]));
  const statsByProduct = new Map(reviewStats.map((s) => [s.productId, s]));

  return products.map((product) => {
    const stats = statsByProduct.get(product.id);
    return {
      ...product,
      price: Number(product.price),
      salePrice: product.salePrice ? Number(product.salePrice) : null,
      weight: product.weight ? Number(product.weight) : null,
      images: (product.images as string[]) || [],
      tags: (product.tags as string[]) || [],
      categoryName: categoryNames.get(product.categoryId) ?? null,
      avgRating: stats?.avgRating ? Number(stats.avgRating) : null,
      reviewCount: Number(stats?.count ?? 0),
      flashSaleEndsAt: product.flashSaleEndsAt ? product.flashSaleEndsAt.toISOString() : null,
      createdAt: product.createdAt.toISOString(),
      variants: variants.filter((v) => v.productId === product.id).map((v) => shapeVariant(product, v)),
    };
  });
}

export async function enrichProduct(product: ProductRow) {
  const [enriched] = await enrichProducts([product]);
  return enriched;
}

export type EnrichedProduct = Awaited<ReturnType<typeof enrichProducts>>[number];

/** Loads products by id and returns them enriched, keyed by id. */
export async function loadEnrichedProducts(ids: number[]): Promise<Map<number, EnrichedProduct>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(productsTable).where(inArray(productsTable.id, [...new Set(ids)]));
  const enriched = await enrichProducts(rows);
  return new Map(enriched.map((p) => [p.id, p]));
}

/** The price a customer pays right now, for the product or one of its variants. */
export function currentPrice(
  product: Pick<ProductRow, "price" | "salePrice">,
  variant?: Pick<VariantRow, "price" | "salePrice"> | null,
): number {
  const { price, salePrice } = variant
    ? variantPricing(product, variant)
    : { price: Number(product.price), salePrice: product.salePrice != null ? Number(product.salePrice) : null };
  return salePrice ?? price;
}

/**
 * For a product with variants, products.stock mirrors the sum of variant stock so
 * listings, "in stock" filters and low-stock reports keep working unchanged.
 */
export async function syncProductStock(productId: number, executor: Executor = db): Promise<void> {
  const [{ total, count }] = await executor
    .select({ total: sql<number>`coalesce(sum(${productVariantsTable.stock}), 0)`, count: sql<number>`count(*)` })
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId));
  if (Number(count) === 0) return;
  await executor
    .update(productsTable)
    .set({ stock: Number(total), updatedAt: new Date() })
    .where(eq(productsTable.id, productId));
}
