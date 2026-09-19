import { useState } from "react";
import type { ProductVariant, ProductVariantInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Wand2 } from "lucide-react";

export type VariantRow = {
  id: number | null;
  values: string[];
  price: string;
  salePrice: string;
  stock: string;
  sku: string;
};

export type VariantDraft = { optionNames: string[]; rows: VariantRow[] };

const MAX_OPTIONS = 3;
const inputClass = "h-8 w-full rounded-md bg-muted border-none px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Splits "رنگ، سایز" or "رنگ, سایز" into option names. */
function splitList(text: string): string[] {
  return text.split(/[,،]/).map((t) => t.trim()).filter(Boolean);
}

export function draftFromVariants(variants: ProductVariant[]): VariantDraft {
  return {
    optionNames: variants[0]?.options.map((o) => o.name) ?? [],
    rows: variants.map((v) => ({
      id: v.id,
      values: v.options.map((o) => o.value),
      // Empty means "inherit the product's price", so edits to the product price still apply.
      price: v.ownPrice != null ? String(v.ownPrice) : "",
      salePrice: v.ownSalePrice != null ? String(v.ownSalePrice) : "",
      stock: String(v.stock),
      sku: v.sku ?? "",
    })),
  };
}

/** Returns an error message, or the payload for PUT /products/{id}/variants. */
export function draftToInput(draft: VariantDraft): { error: string } | { variants: ProductVariantInput[] } {
  if (draft.rows.length === 0) return { variants: [] };
  if (draft.optionNames.length === 0) return { error: "نام ویژگی‌ها (مثلاً رنگ، سایز) را وارد کنید" };
  for (const row of draft.rows) {
    if (row.values.some((v) => !v.trim())) return { error: "مقدار همه‌ی ویژگی‌ها را برای هر ردیف وارد کنید" };
    if (!/^\d+$/.test(row.stock)) return { error: "موجودی هر ردیف باید عدد صحیح باشد" };
  }
  return {
    variants: draft.rows.map((row) => ({
      id: row.id,
      options: draft.optionNames.map((name, i) => ({ name, value: row.values[i].trim() })),
      price: row.price ? Number(row.price) : null,
      salePrice: row.salePrice ? Number(row.salePrice) : null,
      stock: Number(row.stock),
      sku: row.sku || null,
    })),
  };
}

export function VariantEditor({ draft, onChange }: { draft: VariantDraft; onChange: (draft: VariantDraft) => void }) {
  const [namesText, setNamesText] = useState(draft.optionNames.join("، "));
  const [valuesText, setValuesText] = useState<string[]>([]);
  const { optionNames, rows } = draft;

  const setNames = (text: string) => {
    setNamesText(text);
    const names = splitList(text).slice(0, MAX_OPTIONS);
    onChange({ optionNames: names, rows: rows.map((r) => ({ ...r, values: names.map((_, i) => r.values[i] ?? "") })) });
  };

  const updateRow = (index: number, patch: Partial<VariantRow>) =>
    onChange({ optionNames, rows: rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) });

  const emptyRow = (values: string[]): VariantRow => ({ id: null, values, price: "", salePrice: "", stock: "0", sku: "" });

  /** Builds every combination of the listed values, keeping rows that already exist. */
  const generate = () => {
    const lists = optionNames.map((_, i) => splitList(valuesText[i] ?? ""));
    if (lists.length === 0 || lists.some((l) => l.length === 0)) return;
    const combos = lists.reduce<string[][]>((acc, list) => acc.flatMap((c) => list.map((v) => [...c, v])), [[]]);
    const key = (values: string[]) => values.join("|");
    const existing = new Map(rows.map((r) => [key(r.values), r]));
    onChange({ optionNames, rows: combos.map((c) => existing.get(key(c)) ?? emptyRow(c)) });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">ویژگی‌ها (حداکثر ۳، با ویرگول جدا کنید)</label>
        <input value={namesText} onChange={(e) => setNames(e.target.value)} placeholder="مثلاً: رنگ، سایز" className={inputClass + " h-9 text-sm"} />
      </div>

      {optionNames.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">ساخت خودکار همه‌ی ترکیب‌ها:</p>
          {optionNames.map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <span className="text-xs font-semibold w-16 shrink-0">{name}</span>
              <input
                value={valuesText[i] ?? ""}
                onChange={(e) => setValuesText((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                placeholder="مقادیر، مثلاً: مشکی، سفید"
                className={inputClass}
              />
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="w-fit gap-1 text-xs" onClick={generate}>
            <Wand2 className="w-3.5 h-3.5" /> ساخت ترکیب‌ها
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                {optionNames.map((n) => <th key={n} className="text-right font-medium pb-1 px-1">{n}</th>)}
                <th className="text-right font-medium pb-1 px-1">قیمت (خالی = قیمت محصول)</th>
                <th className="text-right font-medium pb-1 px-1">قیمت تخفیف</th>
                <th className="text-right font-medium pb-1 px-1 w-16">موجودی</th>
                <th className="text-right font-medium pb-1 px-1">SKU</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {optionNames.map((_, i) => (
                    <td key={i} className="p-1">
                      <input value={row.values[i] ?? ""} onChange={(e) => updateRow(index, { values: row.values.map((v, j) => (j === i ? e.target.value : v)) })} className={inputClass} />
                    </td>
                  ))}
                  <td className="p-1"><input type="number" min={0} value={row.price} onChange={(e) => updateRow(index, { price: e.target.value })} className={inputClass} /></td>
                  <td className="p-1"><input type="number" min={0} value={row.salePrice} onChange={(e) => updateRow(index, { salePrice: e.target.value })} className={inputClass} /></td>
                  <td className="p-1"><input type="number" min={0} value={row.stock} onChange={(e) => updateRow(index, { stock: e.target.value })} className={inputClass} /></td>
                  <td className="p-1"><input value={row.sku} onChange={(e) => updateRow(index, { sku: e.target.value })} className={inputClass} dir="ltr" /></td>
                  <td className="p-1">
                    <button type="button" aria-label="حذف ردیف" onClick={() => onChange({ optionNames, rows: rows.filter((_, i) => i !== index) })} className="text-destructive p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {optionNames.length > 0 && (
        <Button type="button" size="sm" variant="ghost" className="w-fit gap-1 text-xs" onClick={() => onChange({ optionNames, rows: [...rows, emptyRow(optionNames.map(() => ""))] })}>
          <Plus className="w-3.5 h-3.5" /> افزودن ردیف
        </Button>
      )}
    </div>
  );
}
