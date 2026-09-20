import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { getProduct, type Product } from "@workspace/api-client-react";
import { useCompare } from "@/lib/compare";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { imageUrl } from "@/lib/utils";
import { Scale, X } from "lucide-react";

/** Every specification name used by any of the compared products, in first-seen order. */
function specNames(products: Product[]): string[] {
  const names: string[] = [];
  for (const product of products) {
    for (const spec of product.specs) if (!names.includes(spec.name)) names.push(spec.name);
  }
  return names;
}

const price = (p: Product) => p.salePrice ?? p.price;

export default function Compare() {
  const { ids, remove, clear } = useCompare();
  useSEO({ title: "مقایسه کالاها", description: "مقایسه‌ی مشخصات، قیمت و موجودی کالاهای انتخابی در بازارچه." });

  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: ["product", id], queryFn: () => getProduct(id) })),
  });
  const isLoading = results.some((r) => r.isLoading);
  const products = results.map((r) => r.data).filter((p): p is Product => !!p);
  const rows = specNames(products);
  const cheapest = products.length > 1 ? Math.min(...products.map(price)) : null;

  if (ids.length === 0) return (
    <div className="container mx-auto px-4 py-24 text-center max-w-md" dir="rtl">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Scale className="w-10 h-10 text-primary" />
      </div>
      <h1 className="text-xl font-black mb-2">فهرست مقایسه خالی است</h1>
      <p className="text-muted-foreground mb-6">از صفحه‌ی هر کالا می‌توانید آن را به مقایسه اضافه کنید.</p>
      <Link href="/shop"><Button className="rounded-full font-bold px-8">رفتن به فروشگاه</Button></Link>
    </div>
  );

  if (isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-5xl" dir="rtl"><Skeleton className="h-96 rounded-3xl" /></div>
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black">مقایسه کالاها</h1>
          <Button variant="outline" size="sm" className="rounded-full" onClick={clear}>پاک کردن همه</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-right p-3 w-28 sticky right-0 bg-background"></th>
                {products.map((product) => (
                  <th key={product.id} className="p-3 min-w-44 align-top">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Link href={`/product/${product.slug}`} className="block w-24 h-24 rounded-xl overflow-hidden bg-muted">
                        {product.images[0] && <img src={imageUrl(product.images[0], 160)} alt="" className="w-full h-full object-cover" />}
                      </Link>
                      <Link href={`/product/${product.slug}`} className="font-bold hover:text-primary transition-colors line-clamp-2">
                        {product.nameFa}
                      </Link>
                      <button type="button" onClick={() => remove(product.id)} className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                        <X className="w-3 h-3" /> حذف
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="text-right p-3 text-muted-foreground font-medium sticky right-0 bg-background">قیمت</th>
                {products.map((product) => (
                  <td key={product.id} className="p-3 text-center border-t border-border/50">
                    <span className={`font-black ${cheapest === price(product) ? "text-green-600" : "text-foreground"}`}>
                      {price(product).toLocaleString("fa-IR")} تومان
                    </span>
                    {product.salePrice != null && (
                      <div className="text-xs text-muted-foreground line-through">{product.price.toLocaleString("fa-IR")}</div>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="text-right p-3 text-muted-foreground font-medium sticky right-0 bg-background">موجودی</th>
                {products.map((product) => (
                  <td key={product.id} className="p-3 text-center border-t border-border/50">
                    {product.stock > 0
                      ? <span className="text-green-600 font-medium">موجود</span>
                      : <span className="text-destructive font-medium">ناموجود</span>}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="text-right p-3 text-muted-foreground font-medium sticky right-0 bg-background">امتیاز</th>
                {products.map((product) => (
                  <td key={product.id} className="p-3 text-center border-t border-border/50">
                    {product.avgRating
                      ? `${product.avgRating.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} از ۵ (${product.reviewCount.toLocaleString("fa-IR")})`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <th className="text-right p-3 text-muted-foreground font-medium sticky right-0 bg-background">برند</th>
                {products.map((product) => (
                  <td key={product.id} className="p-3 text-center border-t border-border/50">{product.brand || "—"}</td>
                ))}
              </tr>
              {rows.map((name) => (
                <tr key={name}>
                  <th className="text-right p-3 text-muted-foreground font-medium sticky right-0 bg-background">{name}</th>
                  {products.map((product) => (
                    <td key={product.id} className="p-3 text-center border-t border-border/50">
                      {product.specs.find((s) => s.name === name)?.value ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
