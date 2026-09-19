import { sql } from "drizzle-orm";
import { db, discountsTable, shippingMethodsTable } from "@workspace/db";

type Discount = typeof discountsTable.$inferSelect;
type ShippingMethod = typeof shippingMethodsTable.$inferSelect;
type Executor = Pick<typeof db, "select">;

export async function findDiscountByCode(code: string, executor: Executor = db): Promise<Discount | undefined> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return undefined;
  const [discount] = await executor
    .select()
    .from(discountsTable)
    .where(sql`upper(${discountsTable.code}) = ${normalized}`);
  return discount;
}

export type DiscountCheck =
  | { valid: true; amount: number }
  | { valid: false; message: string };

/** Applies every rule of a discount code to a cart subtotal. The amount never exceeds the subtotal. */
export function checkDiscount(discount: Discount | undefined, subtotal: number, now = new Date()): DiscountCheck {
  if (!discount || !discount.isActive) return { valid: false, message: "کد تخفیف نامعتبر است" };
  if (discount.expiresAt && discount.expiresAt < now) return { valid: false, message: "کد تخفیف منقضی شده است" };
  if (discount.maxUses != null && discount.usedCount >= discount.maxUses) {
    return { valid: false, message: "ظرفیت کد تخفیف پر شده است" };
  }
  if (discount.minOrder && subtotal < Number(discount.minOrder)) {
    return { valid: false, message: `حداقل خرید ${Number(discount.minOrder).toLocaleString("fa-IR")} تومان الزامی است` };
  }
  const raw = discount.type === "percent" ? (subtotal * Number(discount.value)) / 100 : Number(discount.value);
  return { valid: true, amount: Math.min(Math.round(raw), subtotal) };
}

/** Shipping is free for "free" methods and once the subtotal reaches the method's threshold. */
export function shippingCost(method: ShippingMethod, subtotal: number): number {
  if (method.isFree) return 0;
  if (method.minOrderForFree != null && subtotal >= Number(method.minOrderForFree)) return 0;
  return Number(method.price);
}

/** Converts Persian and Arabic-Indic digits to ASCII so "۰۹۱۲..." validates like "0912...". */
export function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
