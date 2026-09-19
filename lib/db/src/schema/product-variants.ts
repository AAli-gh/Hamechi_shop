import { pgTable, serial, text, integer, numeric, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type VariantOption = { name: string; value: string };

/**
 * A purchasable version of a product, e.g. [{name: "رنگ", value: "مشکی"}, {name: "سایز", value: "۴۲"}].
 * Options are an ordered array because jsonb does not keep object key order.
 * When a product has variants, stock lives on the variants and
 * products.stock holds their sum (kept in sync by the API).
 */
export const productVariantsTable = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  options: jsonb("options").$type<VariantOption[]>().notNull(),
  sku: text("sku"),
  // Overrides the product's price/salePrice when set.
  price: numeric("price", { precision: 12, scale: 0 }),
  salePrice: numeric("sale_price", { precision: 12, scale: 0 }),
  stock: integer("stock").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("product_variants_product_id_idx").on(table.productId)]);

export const insertProductVariantSchema = createInsertSchema(productVariantsTable).omit({ id: true, createdAt: true });
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type ProductVariant = typeof productVariantsTable.$inferSelect;
