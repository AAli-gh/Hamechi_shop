import type { ProductSpec } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

const inputClass = "h-8 w-full rounded-md bg-muted border-none px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Ordered name/value rows shown as the product's "مشخصات فنی" table. */
export function SpecEditor({ specs, onChange }: { specs: ProductSpec[]; onChange: (specs: ProductSpec[]) => void }) {
  const update = (index: number, patch: Partial<ProductSpec>) =>
    onChange(specs.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-2">
      {specs.map((spec, index) => (
        <div key={index} className="flex items-center gap-2">
          <input value={spec.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="ویژگی، مثلاً حافظه" className={`${inputClass} w-40 shrink-0`} />
          <input value={spec.value} onChange={(e) => update(index, { value: e.target.value })} placeholder="مقدار، مثلاً ۱۲۸ گیگابایت" className={inputClass} />
          <button type="button" aria-label="حذف مشخصه" onClick={() => onChange(specs.filter((_, i) => i !== index))} className="text-destructive p-1 shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" className="w-fit gap-1 text-xs" onClick={() => onChange([...specs, { name: "", value: "" }])}>
        <Plus className="w-3.5 h-3.5" /> افزودن مشخصه
      </Button>
    </div>
  );
}

/** Drops incomplete rows and trims the rest. */
export function cleanSpecs(specs: ProductSpec[]): ProductSpec[] {
  return specs
    .map((s) => ({ name: s.name.trim(), value: s.value.trim() }))
    .filter((s) => s.name && s.value);
}
