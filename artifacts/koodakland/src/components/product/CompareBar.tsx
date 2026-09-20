import { Link, useLocation } from "wouter";
import { useCompare } from "@/lib/compare";
import { Button } from "@/components/ui/button";
import { Scale, X } from "lucide-react";

/** Floating reminder of the compare list; hidden on the compare page itself. */
export function CompareBar() {
  const { ids, clear } = useCompare();
  const [location] = useLocation();
  if (ids.length === 0 || location.startsWith("/compare")) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 print:hidden">
      <div className="flex items-center gap-3 rounded-full bg-card border border-border shadow-lg px-4 py-2">
        <Scale className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-medium whitespace-nowrap">
          {ids.length.toLocaleString("fa-IR")} کالا برای مقایسه
        </span>
        <Link href="/compare">
          <Button size="sm" className="rounded-full font-bold h-8">مقایسه</Button>
        </Link>
        <button type="button" onClick={clear} aria-label="پاک کردن فهرست مقایسه" className="text-muted-foreground hover:text-destructive">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
