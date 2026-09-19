import { inArray, sql } from "drizzle-orm";
import { db, productsTable, categoriesTable, reviewsTable } from "@workspace/db";

type ProductRow = typeof productsTable.$inferSelect;

/**
 * Shapes product rows for the API, loading category names and review stats
 * for the whole batch in two queries instead of two queries per product.
 */
export async function enrichProducts(products: ProductRow[]) {
  if (products.length === 0) return [];

  const productIds = [...new Set(products.map((p) => p.id))];
  const categoryIds = [...new Set(products.map((p) => p.categoryId))];

  const [categories, reviewStats] = await Promise.all([
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

/** The price a customer pays right now. */
export function currentPrice(product: Pick<ProductRow, "price" | "salePrice">): number {
  return Number(product.salePrice ?? product.price);
}
