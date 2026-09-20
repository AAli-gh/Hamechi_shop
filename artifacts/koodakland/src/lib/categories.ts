import type { Category } from "@workspace/api-client-react";

export type CategoryNode = Category & { children: Category[] };

/**
 * Groups a flat category list into top-level categories with their children.
 * A category whose parent is missing is treated as top-level so nothing disappears.
 */
export function categoryTree(categories: Category[] | undefined): CategoryNode[] {
  const list = categories ?? [];
  const ids = new Set(list.map((c) => c.id));
  const roots = list.filter((c) => c.parentId == null || !ids.has(c.parentId));
  return roots.map((root) => ({ ...root, children: list.filter((c) => c.parentId === root.id) }));
}

/** Flat list with depth, for indented pickers and admin lists. */
export function flattenTree(categories: Category[] | undefined): Array<Category & { depth: number }> {
  return categoryTree(categories).flatMap((root) => [
    { ...root, depth: 0 },
    ...root.children.map((child) => ({ ...child, depth: 1 })),
  ]);
}
