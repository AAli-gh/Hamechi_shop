import { useListProducts, useListCategories, useGetFeaturedProducts, useGetFlashSaleProducts, useGetNewArrivals } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/product/ProductCard";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, ChevronLeft, Wallet, LayoutGrid } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSEO } from "@/hooks/useSEO";

function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${className}`} {...props}>{children}</div>;
}

function SectionHeader({ title, href, emoji }: { title: string; href: string; emoji?: string }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
        {emoji && <span>{emoji}</span>}{title}
      </h2>
      <Link href={href}>
        <Button variant="ghost" size="sm" className="text-primary font-medium group">
          مشاهده همه <ArrowLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
        </Button>
      </Link>
    </div>
  );
}

function ProductSkeletons({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </>
  );
}

const CATEGORY_COLORS = [
  "from-amber-50 to-orange-100 border-orange-200",
  "from-sky-50 to-blue-100 border-blue-200",
  "from-emerald-50 to-green-100 border-green-200",
  "from-amber-50 to-yellow-100 border-yellow-200",
  "from-violet-50 to-purple-100 border-purple-200",
  "from-cyan-50 to-teal-100 border-teal-200",
];

const BUDGET_GROUPS = [
  { label: "زیر ۵۰۰ هزار تومان", max: 500000, emoji: "💰", color: "from-green-50 to-emerald-100", border: "border-green-200" },
  { label: "۵۰۰ هزار تا ۲ میلیون", min: 500000, max: 2000000, emoji: "🛍️", color: "from-sky-50 to-blue-100", border: "border-blue-200" },
  { label: "۲ تا ۱۰ میلیون", min: 2000000, max: 10000000, emoji: "🎁", color: "from-violet-50 to-purple-100", border: "border-purple-200" },
  { label: "بالای ۱۰ میلیون", min: 10000000, emoji: "💎", color: "from-amber-50 to-yellow-100", border: "border-yellow-200" },
];

function budgetHref({ min, max }: { min?: number; max?: number }) {
  const query = new URLSearchParams();
  if (min) query.set("minPrice", String(min));
  if (max) query.set("maxPrice", String(max));
  return `/shop?${query}`;
}

function fetchBestSellers() {
  return fetch("/api/products/best-sellers").then(r => r.json());
}

export default function Home() {
  useSEO({
    title: "بازارچه — فروشگاه اینترنتی همه‌چیز",
    description: "خرید آنلاین کالای دیجیتال، مد و پوشاک، خانه و آشپزخانه، زیبایی و سلامت، ورزش و کالای کودک با ضمانت اصالت، ارسال سریع و بازگشت آسان.",
    keywords: "فروشگاه اینترنتی، خرید آنلاین، کالای دیجیتال، پوشاک، لوازم خانگی، بازارچه",
    type: "website",
  });

  const { data: featuredProducts, isLoading: featuredLoading } = useGetFeaturedProducts();
  const { data: flashSaleProducts, isLoading: flashSaleLoading } = useGetFlashSaleProducts();
  const { data: newArrivals, isLoading: newLoading } = useGetNewArrivals();
  const { data: bestSellers, isLoading: bestSellersLoading } = useQuery({ queryKey: ["best-sellers"], queryFn: fetchBestSellers });
  const { data: recommendedData, isLoading: recommendedLoading } = useListProducts({ featured: true, limit: 4 });
  const { data: categories, isLoading: categoriesLoading } = useListCategories();

  const flashItems = (flashSaleProducts as unknown[] | undefined) || [];
  const bestSellerItems = (bestSellers as unknown[] | undefined) || [];
  const recommendedItems = (recommendedData?.products || []).slice(0, 4);

  return (
    <div className="flex flex-col gap-12 sm:gap-16 pb-12">
      {/* ── Hero ── */}
      <section className="relative w-full h-[300px] sm:h-[400px] md:h-[500px] bg-primary/10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,hsl(var(--primary)/0.18),transparent)]" />
        <div className="container mx-auto px-4 h-full flex flex-col justify-center max-w-2xl text-right relative z-10">
          <Badge className="w-fit mb-4 bg-primary/20 text-primary hover:bg-primary/30 border-none">جشنواره فروش ۱۴۰۵</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-foreground mb-4 leading-tight">
            هر چه نیاز دارید، <br className="hidden sm:block" />
            <span className="text-primary">یک‌جا در بازارچه</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mb-8 max-w-md">
            از کالای دیجیتال و پوشاک تا لوازم خانه و ورزش؛ با ضمانت اصالت کالا و ارسال سریع به سراسر ایران.
          </p>
          <Link href="/shop">
            <Button size="lg" className="w-fit rounded-full font-bold shadow-md shadow-primary/20">
              مشاهده محصولات <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Featured Products ── */}
      <section className="container mx-auto px-4">
        <SectionHeader title="محصولات ویژه" href="/shop?featured=true" emoji="✨" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {featuredLoading ? <ProductSkeletons count={4} /> : featuredProducts?.slice(0, 4).map((product: any) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ── Best Selling Products ── */}
      <section className="container mx-auto px-4">
        <SectionHeader title="پرفروش‌ترین محصولات" href="/shop" emoji="🏆" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {bestSellersLoading ? <ProductSkeletons count={4} /> : bestSellerItems.slice(0, 4).map((product: any) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ── Shop by Category ── */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            خرید بر اساس دسته‌بندی
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categoriesLoading
            ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
            : categories?.filter((cat) => !cat.parentId).map((cat, i) => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`}>
                <div className={`bg-gradient-to-br ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} border rounded-3xl p-5 text-center cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group`}>
                  <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">{cat.icon}</div>
                  <p className="font-black text-sm text-foreground">{cat.nameFa}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(cat.productCount ?? 0).toLocaleString("fa-IR")} کالا</p>
                </div>
              </Link>
            ))}
        </div>
      </section>

      {/* ── Flash Sale ── */}
      {flashItems.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="bg-gradient-to-l from-orange-50 to-red-50 border border-orange-100 rounded-3xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white font-black text-xs">٪</div>
                <div>
                  <h2 className="text-xl font-black text-foreground">فروش ویژه</h2>
                  <p className="text-xs text-muted-foreground">تا اتمام موجودی</p>
                </div>
              </div>
              <Link href="/shop?flashSale=true">
                <Button variant="outline" size="sm" className="rounded-xl border-orange-200 hover:bg-orange-50 font-medium text-xs">
                  همه تخفیف‌ها <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {flashSaleLoading ? <ProductSkeletons count={4} /> : flashItems.slice(0, 4).map((product: any) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Shop by Budget ── */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            خرید بر اساس بودجه
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {BUDGET_GROUPS.map((group) => (
            <Link key={group.label} href={budgetHref(group)}>
              <div className={`bg-gradient-to-br ${group.color} border ${group.border} rounded-3xl p-5 sm:p-8 text-center cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group`}>
                <div className="text-4xl sm:text-5xl mb-3 group-hover:scale-110 transition-transform duration-200">{group.emoji}</div>
                <p className="font-black text-foreground text-sm sm:text-base">{group.label}</p>
                <p className="text-xs text-muted-foreground mt-1">مشاهده محصولات</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── New Arrivals ── */}
      <section className="container mx-auto px-4">
        <SectionHeader title="تازه‌های فروشگاه" href="/shop?sort=newest" emoji="🆕" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {newLoading ? <ProductSkeletons count={4} /> : ((newArrivals as unknown[] | undefined) || []).slice(0, 4).map((product: any) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ── Recommended Products ── */}
      <section className="container mx-auto px-4">
        <SectionHeader title="پیشنهاد ما برای شما" href="/shop?featured=true" emoji="💝" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {recommendedLoading ? <ProductSkeletons count={4} /> : recommendedItems.map((product: any) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>

      {/* ── Buying Guide CTA ── */}
      <section className="container mx-auto px-4">
        <div className="bg-gradient-to-l from-primary/10 to-primary/5 border border-primary/15 rounded-3xl p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-6 sm:gap-10 text-right">
          <div className="text-6xl flex-shrink-0">🧭</div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-foreground mb-2">نمی‌دانید چه بخرید؟</h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md">
              راهنماهای خرید و مقایسه‌های بازارچه کمک می‌کنند بهترین انتخاب را متناسب با نیاز و بودجه‌تان داشته باشید.
            </p>
            <Link href="/blog">
              <Button className="mt-4 rounded-full font-bold shadow-md shadow-primary/20">
                مشاهده راهنماهای خرید <ChevronLeft className="w-4 h-4 mr-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
