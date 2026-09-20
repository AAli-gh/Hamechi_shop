import { Link, useLocation } from "wouter";
import { ShoppingBag, Heart, User, Menu, LayoutDashboard } from "lucide-react";
import { useCartSession } from "@/lib/cart";
import { useGetCart, useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { categoryTree } from "@/lib/categories";
import { DesktopSearch, MobileSearchModal } from "./LiveSearch";

export function Header() {
  const [location] = useLocation();
  const { sessionId } = useCartSession();
  const { data: cart } = useGetCart({ sessionId }, { query: { queryKey: ["cart", sessionId] } });
  const { data: categoriesResponse } = useListCategories();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const categories = categoryTree(categoriesResponse || []);
  const isAdmin = user && (user.role === "admin" || user.role === "manager");

  const mobileLinks = [
    { href: "/", label: "خانه" },
    { href: "/shop", label: "فروشگاه" },
    { href: "/blog", label: "مجله" },
    { href: "/about", label: "درباره ما" },
    { href: "/contact", label: "تماس با ما" },
    { href: "/wishlist", label: "علاقه‌مندی‌ها" },
    { href: "/compare", label: "مقایسه کالاها" },
    { href: user ? "/profile" : "/login", label: user ? "حساب کاربری" : "ورود / ثبت‌نام" },
    ...(isAdmin ? [{ href: "/admin", label: "پنل مدیریت" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur-xl">
      {/* ── Top row: logo, search, account actions ── */}
      <div className="container mx-auto px-4 h-16 flex items-center gap-3">
        {/* First in the row, so it sits on the right edge in RTL */}
        <div className="lg:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl w-9 h-9" aria-label="منو">
                <Menu style={{ width: 20, height: 20 }} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[82vw] sm:w-[340px] p-0 bg-card" dir="rtl">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 p-5 border-b border-border">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="font-black text-base text-primary">بازارچه</h2>
                    <p className="text-xs text-muted-foreground">تجربه خرید هوشمند</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <p className="text-xs font-semibold text-muted-foreground px-2 mb-2">منوی اصلی</p>
                  <nav className="flex flex-col gap-1 mb-6">
                    {mobileLinks.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`px-4 py-3 rounded-xl font-medium text-sm transition-colors ${
                          location === href ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        {label}
                      </Link>
                    ))}
                  </nav>

                  {categories.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground px-2 mb-2">دسته‌بندی‌ها</p>
                      <nav className="flex flex-col gap-1">
                        {categories.map((cat) => (
                          <div key={cat.id}>
                            <Link
                              href={`/shop?category=${cat.slug}`}
                              onClick={() => setMobileMenuOpen(false)}
                              className="px-4 py-2.5 rounded-xl text-sm text-foreground/80 hover:bg-muted transition-colors flex items-center gap-2"
                            >
                              <span className="text-base">{cat.icon}</span>
                              {cat.nameFa}
                            </Link>
                            {cat.children.map((child) => (
                              <Link
                                key={child.id}
                                href={`/shop?category=${child.slug}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="pr-11 pl-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors block"
                              >
                                {child.nameFa}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </nav>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <ShoppingBag className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block leading-tight">
            <span className="block font-black text-xl text-primary tracking-tight">بازارچه</span>
            <span className="block text-[11px] text-muted-foreground">تجربه خرید هوشمند</span>
          </div>
        </Link>

        <div className="hidden lg:flex flex-1 px-6">
          <div className="w-full max-w-2xl mx-auto">
            <DesktopSearch />
          </div>
        </div>

        <div className="flex-1 lg:hidden" />

        <div className="flex items-center gap-1.5">
          <div className="lg:hidden">
            <MobileSearchModal />
          </div>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="rounded-xl w-10 h-10 relative hover:bg-muted">
              <ShoppingBag style={{ width: 19, height: 19 }} />
              {cart && cart.itemCount > 0 && (
                <span className="absolute -top-0.5 -left-0.5 flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {cart.itemCount.toLocaleString("fa-IR")}
                </span>
              )}
            </Button>
          </Link>

          <Link href="/wishlist" className="hidden sm:inline-flex">
            <Button variant="ghost" size="icon" className="rounded-xl w-10 h-10 hover:bg-muted" aria-label="علاقه‌مندی‌ها">
              <Heart style={{ width: 19, height: 19 }} />
            </Button>
          </Link>

          {isAdmin && (
            <Link href="/admin" className="hidden sm:inline-flex">
              <Button variant="ghost" size="icon" className="rounded-xl w-10 h-10 hover:bg-muted" title="پنل مدیریت">
                <LayoutDashboard style={{ width: 19, height: 19 }} />
              </Button>
            </Link>
          )}

          <Link href={user ? "/profile" : "/login"}>
            <Button variant="outline" className="rounded-xl h-10 gap-2 px-3 sm:px-4 font-medium border-border hover:border-primary/40">
              <User style={{ width: 18, height: 18 }} />
              <span className="hidden sm:inline text-sm">{user ? user.name || "حساب من" : "ورود / ثبت‌نام"}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Category row ── */}
      {categories.length > 0 && (
        <nav className="hidden lg:block border-t border-border/60 bg-card/40">
          <div className="container mx-auto px-4 flex items-center justify-center gap-1 h-12 overflow-x-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="relative group shrink-0">
                <Link
                  href={`/shop?category=${cat.slug}`}
                  className="flex items-center gap-2 px-4 h-12 text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                >
                  <span className="text-base">{cat.icon}</span>
                  {cat.nameFa}
                </Link>
                {cat.children.length > 0 && (
                  <div className="absolute top-full right-0 hidden group-hover:block pt-1 z-50">
                    <div className="min-w-48 rounded-2xl border border-border bg-popover p-2 shadow-2xl">
                      {cat.children.map((child) => (
                        <Link
                          key={child.id}
                          href={`/shop?category=${child.slug}`}
                          className="block px-3 py-2 rounded-xl text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {child.nameFa}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
