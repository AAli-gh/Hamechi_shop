import { useEffect, useMemo, useState } from "react";
import type { ProductVariant } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

type Selection = Record<string, string>;

function matches(variant: ProductVariant, selection: Selection): boolean {
  return variant.options.every((o) => selection[o.name] === undefined || selection[o.name] === o.value);
}

/**
 * Tracks which option values (e.g. رنگ, سایز) are chosen and which variant they
 * point to. Starts on the first in-stock variant so the page shows a real price.
 */
export function useVariantSelection(variants: ProductVariant[]) {
  const optionNames = useMemo(() => variants[0]?.options.map((o) => o.name) ?? [], [variants]);
  const valuesByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const name of optionNames) {
      const values: string[] = [];
      for (const v of variants) {
        const value = v.options.find((o) => o.name === name)?.value;
        if (value && !values.includes(value)) values.push(value);
      }
      map.set(name, values);
    }
    return map;
  }, [variants, optionNames]);

  const initial = (): Selection => {
    const start = variants.find((v) => v.stock > 0) ?? variants[0];
    return start ? Object.fromEntries(start.options.map((o) => [o.name, o.value])) : {};
  };
  const [selection, setSelection] = useState<Selection>(initial);
  useEffect(() => setSelection(initial()), [variants]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVariant = optionNames.length > 0 && optionNames.every((n) => selection[n] !== undefined)
    ? variants.find((v) => v.options.every((o) => selection[o.name] === o.value))
    : undefined;

  /** Choosing a value keeps the other choices when that combination exists, otherwise resets them. */
  const select = (name: string, value: string) => {
    const next = { ...selection, [name]: value };
    const exact = variants.find((v) => matches(v, next) && v.options.every((o) => next[o.name] === o.value));
    if (exact) { setSelection(next); return; }
    const fallback = variants.find((v) => v.stock > 0 && v.options.some((o) => o.name === name && o.value === value))
      ?? variants.find((v) => v.options.some((o) => o.name === name && o.value === value));
    setSelection(fallback ? Object.fromEntries(fallback.options.map((o) => [o.name, o.value])) : next);
  };

  /** In stock together with the choices already made for the other options. */
  const isAvailable = (name: string, value: string) => {
    const others = Object.fromEntries(Object.entries(selection).filter(([n]) => n !== name));
    return variants.some((v) => v.stock > 0 && matches(v, { ...others, [name]: value }));
  };

  return { optionNames, valuesByName, selection, select, selectedVariant, isAvailable };
}

export function VariantPicker({ picker }: { picker: ReturnType<typeof useVariantSelection> }) {
  const { optionNames, valuesByName, selection, select, isAvailable } = picker;
  return (
    <div className="flex flex-col gap-4">
      {optionNames.map((name) => (
        <div key={name}>
          <p className="text-sm font-bold mb-2">
            {name}: <span className="font-medium text-muted-foreground">{selection[name] ?? "انتخاب کنید"}</span>
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={name}>
            {valuesByName.get(name)!.map((value) => {
              const active = selection[name] === value;
              const available = isAvailable(name, value);
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => select(name, value)}
                  aria-label={available ? value : `${value} (ناموجود)`}
                  className={cn(
                    "min-w-11 h-10 px-4 rounded-xl border-2 text-sm font-semibold transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                    !available && "text-muted-foreground line-through decoration-2 opacity-60",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
