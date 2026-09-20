import { Truck, ShieldCheck, RotateCcw, Headphones } from "lucide-react";

const BADGES = [
  { icon: Truck, title: "ارسال رایگان", sub: "برای خرید بالای ۲ میلیون تومان" },
  { icon: ShieldCheck, title: "گارانتی اصالت", sub: "ضمانت اصل بودن همه‌ی کالاها" },
  { icon: RotateCcw, title: "بازگشت کالا", sub: "تا ۱۴ روز پس از تحویل" },
  { icon: Headphones, title: "پشتیبانی ۲۴/۷", sub: "پاسخگویی در تمام روزهای هفته" },
];

/** The four guarantees shown under the hero and on the product page. */
export function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}>
      {BADGES.map(({ icon: Icon, title, sub }) => (
        <li key={title} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-sm">{title}</span>
            <span className="block text-[11px] text-muted-foreground leading-relaxed">{sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
