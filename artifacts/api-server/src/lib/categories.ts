import { eq, inArray, sql } from "drizzle-orm";
import { db, categoriesTable, productsTable } from "@workspace/db";

type CategoryRow = typeof categoriesTable.$inferSelect;

/** All descendants of `rootId`, including itself. Category trees here are small, so this walks them in memory. */
export function descendantIds(categories: Pick<CategoryRow, "id" | "parentId">[], rootId: number): number[] {
  const ids = [rootId];
  for (const id of ids) {
    for (const cat of categories) {
      if (cat.parentId === id && !ids.includes(cat.id)) ids.push(cat.id);
    }
  }
  return ids;
}

/** The category with this slug plus its sub-categories, for filtering products. */
export async function categoryFilterIds(slug: string): Promise<number[] | null> {
  const categories = await db.select({ id: categoriesTable.id, parentId: categoriesTable.parentId, slug: categoriesTable.slug }).from(categoriesTable);
  const root = categories.find((c) => c.slug === slug);
  return root ? descendantIds(categories, root.id) : null;
}

/**
 * Categories with a product count that includes their sub-categories, so a parent
 * shows the total a shopper sees when they open it.
 */
export async function listCategoriesWithCounts() {
  const [categories, counts] = await Promise.all([
    db.select().from(categoriesTable).orderBy(categoriesTable.id),
    db
      .select({ categoryId: productsTable.categoryId, count: sql<number>`count(*)` })
      .from(productsTable)
      .groupBy(productsTable.categoryId),
  ]);
  const directCount = new Map(counts.map((c) => [c.categoryId, Number(c.count)]));
  return categories.map((cat) => ({
    ...cat,
    productCount: descendantIds(categories, cat.id).reduce((sum, id) => sum + (directCount.get(id) ?? 0), 0),
  }));
}

export async function categoryWithCount(cat: CategoryRow) {
  const categories = await db.select({ id: categoriesTable.id, parentId: categoriesTable.parentId }).from(categoriesTable);
  const ids = descendantIds(categories, cat.id);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable)
    .where(inArray(productsTable.categoryId, ids));
  return { ...cat, productCount: Number(count) };
}

/** A category cannot be its own ancestor, and a parent must exist. */
export async function isValidParent(categoryId: number | null, parentId: number | null | undefined): Promise<boolean> {
  if (parentId == null) return true;
  if (parentId === categoryId) return false;
  const categories = await db.select({ id: categoriesTable.id, parentId: categoriesTable.parentId }).from(categoriesTable);
  if (!categories.some((c) => c.id === parentId)) return false;
  return categoryId == null || !descendantIds(categories, categoryId).includes(parentId);
}

export async function categoryUsage(id: number): Promise<{ children: number; products: number }> {
  const [[{ children }], [{ products }]] = await Promise.all([
    db.select({ children: sql<number>`count(*)` }).from(categoriesTable).where(eq(categoriesTable.parentId, id)),
    db.select({ products: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.categoryId, id)),
  ]);
  return { children: Number(children), products: Number(products) };
}
