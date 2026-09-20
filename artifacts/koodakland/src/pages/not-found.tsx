import { Link } from "wouter";
import { Home, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/useSEO";

export default function NotFound() {
  useSEO({ title: "صفحه پیدا نشد" });

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-4" dir="rtl">
      {/* Night sky: a soft glow and a few scattered stars. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        {[
          { top: "18%", left: "12%", size: 3 }, { top: "28%", left: "82%", size: 2 },
          { top: "62%", left: "20%", size: 2 }, { top: "72%", left: "70%", size: 3 },
          { top: "12%", left: "58%", size: 2 }, { top: "82%", left: "42%", size: 2 },
        ].map((star, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-foreground/50"
            style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
          />
        ))}
      </div>

      <div className="relative text-center max-w-xl">
        <p className="text-[110px] sm:text-[150px] leading-none font-black tracking-tight text-primary drop-shadow-[0_0_35px_hsl(var(--primary)/0.45)]">
          ۴۰۴
        </p>
        <div className="text-6xl mb-4" aria-hidden>🚀</div>

        <h1 className="text-2xl sm:text-3xl font-black mb-3">صفحه‌ی موردنظر پیدا نشد!</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          متأسفانه صفحه‌ای که دنبال آن هستید وجود ندارد یا جابه‌جا شده است.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button className="w-full sm:w-auto rounded-xl gap-2 font-bold px-8">
              <Home className="w-4 h-4" />
              بازگشت به صفحه اصلی
            </Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline" className="w-full sm:w-auto rounded-xl gap-2 font-bold px-8">
              <ShoppingBag className="w-4 h-4" />
              رفتن به فروشگاه
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
