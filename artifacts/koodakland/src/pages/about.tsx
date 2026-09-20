import { Link } from "wouter";
import { Heart, Shield, Truck, Star, Users, Award, Smile, Package, ChevronLeft } from "lucide-react";

const VALUES = [
  {
    icon: Heart,
    color: "bg-primary/10 text-primary",
    title: "تنوع بی‌نظیر",
    desc: "از کالای دیجیتال و پوشاک تا لوازم خانه و ورزش؛ هر چه نیاز دارید را یک‌جا پیدا می‌کنید.",
  },
  {
    icon: Shield,
    color: "bg-sky-500/15 text-sky-300",
    title: "ضمانت اصالت",
    desc: "همه‌ی کالاها از تأمین‌کنندگان معتبر تهیه می‌شوند و اصالت آن‌ها را تضمین می‌کنیم.",
  },
  {
    icon: Award,
    color: "bg-yellow-500/15 text-yellow-300",
    title: "کیفیت تضمین‌شده",
    desc: "ما فقط بهترین برندها و باکیفیت‌ترین محصولات را عرضه می‌کنیم تا خریدتان ارزش واقعی داشته باشد.",
  },
  {
    icon: Smile,
    color: "bg-emerald-500/15 text-emerald-400",
    title: "رضایت مشتری",
    desc: "رضایت شما هدف اصلی ماست. پشتیبانی ۷ روز هفته برای پاسخ به تمام سوالات شما.",
  },
];

const STATS = [
  { value: "۱۲,۰۰۰+", label: "مشتری راضی", icon: Users },
  { value: "۵,۰۰۰+", label: "کالای متنوع", icon: Package },
  { value: "۸", label: "سال تجربه", icon: Award },
  { value: "۴.۹", label: "امتیاز مشتریان", icon: Star },
];

const TEAM = [
  { name: "مریم احمدی", role: "مدیرعامل و بنیان‌گذار", emoji: "👩‍💼", bg: "bg-primary/10" },
  { name: "علی رضایی", role: "مدیر محصول", emoji: "👨‍💻", bg: "bg-sky-500/15" },
  { name: "سارا کریمی", role: "مدیر زنجیره تأمین", emoji: "👩‍🔧", bg: "bg-emerald-500/15" },
  { name: "رضا محمدی", role: "مدیر پشتیبانی", emoji: "👨‍💼", bg: "bg-violet-500/15" },
];

export default function About() {
  return (
    <div className="min-h-screen" dir="rtl">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-primary/10 via-card to-amber-50 py-20 px-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 right-16 text-6xl opacity-20 animate-bounce" style={{ animationDuration: "3s" }}>🛍️</div>
          <div className="absolute top-20 left-24 text-5xl opacity-15 animate-bounce" style={{ animationDuration: "4s", animationDelay: "1s" }}>🎧</div>
          <div className="absolute bottom-10 right-1/3 text-4xl opacity-20 animate-bounce" style={{ animationDuration: "5s", animationDelay: "0.5s" }}>⭐</div>
          <div className="absolute bottom-16 left-16 text-5xl opacity-15 animate-bounce" style={{ animationDuration: "3.5s", animationDelay: "2s" }}>👟</div>
          <div className="absolute top-1/2 left-8 text-4xl opacity-10 animate-bounce" style={{ animationDuration: "4.5s" }}>🏠</div>
        </div>

        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Heart className="w-4 h-4" />
            <span>درباره بازارچه</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground mb-6 leading-tight">
            داستان ما از{" "}
            <span className="text-primary">یک بازارچه کوچک</span>
            {" "}شروع شد
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            بازارچه در سال ۱۳۹۵ با یک هدف ساده آغاز شد: جایی مطمئن برای خرید اینترنتی هر چیزی که نیاز دارید. امروز بیش از ۱۲,۰۰۰ مشتری به ما اعتماد کرده‌اند.
          </p>
        </div>
      </section>

      {/* ── Story ── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
                داستان ما
              </div>
              <h2 className="text-3xl font-black text-foreground mb-4 leading-tight">
                از یک ایده ساده تا یک برند مورد اعتماد
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  همه چیز از این دغدغه شروع شد که پیدا کردن کالای اصل با قیمت منصفانه نباید سخت باشد. مریم احمدی، بنیان‌گذار بازارچه، تصمیم گرفت فروشگاهی بسازد که در آن همه‌چیز شفاف، مطمئن و در دسترس باشد.
                </p>
                <p>
                  در سال ۱۳۹۵، با انبار کوچکی در تهران و چند صد محصول انتخاب‌شده با دقت، بازارچه تأسیس شد. امروز ما بیش از ۵,۰۰۰ کالا در ده‌ها دسته‌بندی از بهترین برندهای داخلی و خارجی ارائه می‌دهیم.
                </p>
                <p>
                  تیم ما از کارشناسان خرید، متخصصان کنترل کیفیت و پشتیبانی تشکیل شده که هر کالا را پیش از عرضه بررسی می‌کنند.
                </p>
              </div>
            </div>

            <div className="order-1 md:order-2 flex justify-center">
              <div className="relative w-72 h-72">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-amber-200 rotate-6 opacity-60" />
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tl from-primary/10 to-purple-100 -rotate-3 opacity-70" />
                <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-primary/10 to-amber-50 flex flex-col items-center justify-center border border-border shadow-xl">
                  <div className="text-7xl mb-2">🛍️</div>
                  <p className="text-primary font-bold text-lg">بازارچه</p>
                  <p className="text-muted-foreground text-sm">از ۱۳۹۵ تا امروز</p>
                  <div className="flex gap-1 mt-3">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-14 px-4 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl font-black text-foreground mb-1">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-primary text-xs font-semibold mb-4">
            مأموریت ما
          </div>
          <h2 className="text-3xl font-black text-foreground mb-4">ما اینجاییم تا...</h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12">
            بهترین تجربه‌ی خرید اینترنتی را برای ایرانیان فراهم کنیم — با کالاهای اصل، قیمت منصفانه و ارسال سریع.
          </p>

          <div className="grid md:grid-cols-2 gap-6 text-right">
            {[
              { emoji: "🌟", title: "انتخاب هوشمند", desc: "هر محصول قبل از ورود به فروشگاه توسط تیم متخصص ما بررسی می‌شود." },
              { emoji: "🚀", title: "تحویل سریع", desc: "سفارش‌های تهران در ۲۴ ساعت و سایر شهرها در ۳-۵ روز کاری تحویل داده می‌شوند." },
              { emoji: "💝", title: "قیمت منصفانه", desc: "ما معتقدیم کیفیت نباید گران باشد. بهترین قیمت‌ها را برای شما تضمین می‌کنیم." },
              { emoji: "🔄", title: "بازگشت آسان", desc: "اگر از خریدتان راضی نبودید، بدون سوال در ۱۴ روز آن را پس می‌گیریم." },
            ].map(({ emoji, title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-amber-50/40 border border-border">
                <div className="text-3xl flex-shrink-0">{emoji}</div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-16 px-4 bg-gradient-to-b from-card to-primary/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              ارزش‌های ما
            </div>
            <h2 className="text-3xl font-black text-foreground">آنچه ما را متمایز می‌کند</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="text-center p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 text-violet-300 text-xs font-semibold mb-4">
              تیم ما
            </div>
            <h2 className="text-3xl font-black text-foreground">افرادی که بازارچه را می‌سازند</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {TEAM.map(({ name, role, emoji, bg }) => (
              <div key={name} className="text-center p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-20 h-20 rounded-full ${bg} flex items-center justify-center mx-auto mb-4 text-4xl`}>
                  {emoji}
                </div>
                <h3 className="font-bold text-foreground mb-1">{name}</h3>
                <p className="text-sm text-muted-foreground">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/10 via-amber-50 to-primary/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-foreground mb-3">چرا مشتریان به ما اعتماد می‌کنند؟</h2>
            <p className="text-muted-foreground">نظر مشتریان واقعی ما</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "فاطمه م.", text: "تنوع کالا عالیه و همه‌چیز رو یک‌جا پیدا کردم. تحویل هم خیلی سریع بود.", stars: 5 },
              { name: "رضا ک.", text: "خیلی راحت و مطمئن خرید کردم. پشتیبانی عالی داشتن و جواب سوالاتم رو سریع دادن.", stars: 5 },
              { name: "نرگس ش.", text: "هدفونی که خریدم اصل بود و قیمتش از بقیه جاها بهتر بود. به همه پیشنهاد می‌دم.", stars: 5 },
            ].map(({ name, text, stars }) => (
              <div key={name} className="bg-card rounded-2xl p-6 border border-border shadow-sm">
                <div className="flex gap-1 mb-3">
                  {Array(stars).fill(0).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">«{text}»</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-foreground">{name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="text-5xl mb-4">🛍️</div>
          <h2 className="text-3xl font-black text-foreground mb-4">آماده خرید هستید؟</h2>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            بیایید بهترین کالا را متناسب با نیاز و بودجه‌تان پیدا کنید
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop">
              <button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                <span>مشاهده محصولات</span>
                <ChevronLeft className="w-4 h-4 -rotate-180" />
              </button>
            </Link>
            <Link href="/contact">
              <button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl border-2 border-primary/20 text-primary font-bold hover:bg-primary/10 transition-colors">
                تماس با ما
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
