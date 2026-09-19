import { and, or, sql, type SQL, type AnyColumn } from "drizzle-orm";
import { productsTable } from "@workspace/db";

/*
 * Persian text is typed many ways: Arabic "ي"/"ك" instead of "ی"/"ک", "آ" as "ا",
 * a zero-width non-joiner or a space inside words ("بی‌سیم" / "بی سیم" / "بیسیم"),
 * and Persian or Arabic digits. Both the stored text and the query are folded to
 * one form, with spaces and ZWNJ removed, so all of these match each other.
 */
const FOLD_FROM = "يكىآأإةۀ" + "۰۱۲۳۴۵۶۷۸۹" + "٠١٢٣٤٥٦٧٨٩";
const FOLD_TO = "یکیاااهه" + "0123456789" + "0123456789";
// Characters in FROM without a counterpart in TO are deleted by translate().
const STRIP = "‌‏‎ ًٌٍَُِّْـ";

const FOLD_MAP = new Map([...FOLD_FROM].map((ch, i) => [ch, FOLD_TO[i]]));

export function foldSearchText(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase()) {
    if (STRIP.includes(ch)) continue;
    out += FOLD_MAP.get(ch) ?? ch;
  }
  return out;
}

function foldColumn(column: AnyColumn | SQL): SQL {
  return sql`translate(lower(coalesce(${column}, '')), ${FOLD_FROM + STRIP}, ${FOLD_TO})`;
}

/** Splits a query into folded words; each word must appear in the product. */
export function searchTokens(query: string): string[] {
  return query
    .split(/[\s‌]+/)
    .map(foldSearchText)
    .filter((token) => token.length > 0)
    .slice(0, 8);
}

/** Every word must match the Persian name, English name, brand or tags. */
export function productSearchCondition(query: string): SQL | undefined {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return undefined;
  const fields = [productsTable.nameFa, productsTable.name, productsTable.brand, sql`${productsTable.tags}::text`];
  return and(
    ...tokens.map((token) => {
      const pattern = `%${token.replace(/[\\%_]/g, "\\$&")}%`;
      return or(...fields.map((field) => sql`${foldColumn(field)} like ${pattern}`))!;
    }),
  );
}

/** Folded match for a single text column (used for category names). */
export function textSearchCondition(column: AnyColumn, query: string): SQL | undefined {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return undefined;
  return and(...tokens.map((token) => sql`${foldColumn(column)} like ${`%${token.replace(/[\\%_]/g, "\\$&")}%`}`));
}
