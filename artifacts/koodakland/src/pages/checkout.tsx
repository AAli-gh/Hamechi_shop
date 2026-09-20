import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetCart, useCreateOrder, useListShippingMethods, useValidateDiscount, useGetUserAddresses, useAddUserAddress, type ShippingMethod, type Address } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage, imageUrl } from "@/lib/utils";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import { useCartSession } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Truck, Shield, CheckCircle2, Check } from "lucide-react";

/** Mirrors the server's rule in api-server/src/lib/pricing.ts. */
function shippingCostFor(method: ShippingMethod, subtotal: number): number {
  if (method.isFree) return 0;
  if (method.minOrderForFree != null && subtotal >= method.minOrderForFree) return 0;
  return method.price;
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export default function Checkout() {
  const { sessionId } = useCartSession();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({ name: user?.name || "", phone: "", province: "", city: "", street: "", postalCode: "" });
  const [selectedShipping, setSelectedShipping] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | "new">("new");
  const [saveAddress, setSaveAddress] = useState(true);

  const { data: cart, isLoading: cartLoading } = useGetCart({ sessionId }, { query: { queryKey: ["cart", sessionId] } });
  const { data: shippingMethods } = useListShippingMethods();
  const createOrder = useCreateOrder();
  const validateDiscount = useValidateDiscount();
  const queryClient = useQueryClient();
  const { data: addresses } = useGetUserAddresses(user?.id ?? 0, {
    query: { enabled: !!user, queryKey: ["addresses", user?.id] },
  });
  const addAddress = useAddUserAddress();

  const fillFrom = (address: Address) => {
    setSelectedAddressId(address.id);
    setForm((f) => ({ ...f, province: address.province, city: address.city, street: address.street, postalCode: address.postalCode }));
  };

  // Start on the default saved address, once, when the list arrives.
  useEffect(() => {
    if (!addresses?.length || selectedAddressId !== "new" || form.street) return;
    fillFrom(addresses.find((a) => a.isDefault) ?? addresses[0]);
  }, [addresses]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeShipping = shippingMethods?.find(m => m.id.toString() === selectedShipping);
  const addressComplete = !!(form.name && form.phone && form.province && form.city && form.street && form.postalCode);
  const subtotal = cart?.subtotal || 0;
  const shippingCost = activeShipping ? shippingCostFor(activeShipping, subtotal) : 0;
  const discountAmount = appliedDiscount?.amount ?? 0;
  const total = subtotal - discountAmount + shippingCost;

  const handleApplyDiscount = () => {
    validateDiscount.mutate({ data: { code: discountCode, cartTotal: subtotal } }, {
      onSuccess: (data) => {
        if (data.valid) { setAppliedDiscount({ code: discountCode.trim(), amount: data.discountAmount }); toast({ title: "کد تخفیف اعمال شد" }); }
        else { setAppliedDiscount(null); toast({ title: "کد نامعتبر", variant: "destructive", description: data.message || "" }); }
      },
    });
  };

  const handlePlaceOrder = () => {
    if (!form.name || !form.phone || !form.province || !form.city || !form.street || !form.postalCode) {
      toast({ title: "اطلاعات ناقص", description: "لطفا همه فیلدها را پر کنید", variant: "destructive" });
      return;
    }
    const phone = toAsciiDigits(form.phone.trim());
    const postalCode = toAsciiDigits(form.postalCode.trim());
    if (!/^09\d{9}$/.test(phone)) {
      toast({ title: "شماره موبایل نامعتبر", description: "شماره را به شکل ۰۹۱۲۳۴۵۶۷۸۹ وارد کنید", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(postalCode)) {
      toast({ title: "کد پستی نامعتبر", description: "کد پستی باید ۱۰ رقم باشد", variant: "destructive" });
      return;
    }
    if (!activeShipping) {
      toast({ title: "روش ارسال", description: "لطفا روش ارسال را انتخاب کنید", variant: "destructive" });
      return;
    }
    const addressSnapshot = JSON.stringify({ province: form.province, city: form.city, street: form.street, postalCode });
    createOrder.mutate({
      data: { sessionId, userId: user?.id ?? null, addressSnapshot, shippingMethod: activeShipping.name, discountCode: appliedDiscount?.code ?? null, notes: notes || null, customerName: form.name, customerPhone: phone },
    }, {
      onSuccess: (order) => {
        // Remember a newly typed address for next time (failures must not block the order).
        if (user && selectedAddressId === "new" && saveAddress) {
          addAddress.mutate(
            { id: user.id, data: { province: form.province, city: form.city, street: form.street, postalCode } },
            { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses", user.id] }), onError: () => {} },
          );
        }
        queryClient.invalidateQueries({ queryKey: ["cart", sessionId] });
        navigate(`/order-success?order=${order.orderNumber}`);
      },
      onError: (error) => toast({ title: "خطا", description: apiErrorMessage(error, "مشکلی در ثبت سفارش پیش آمد"), variant: "destructive" }),
    });
  };

  if (cartLoading) return <div className="container mx-auto px-4 py-8 max-w-4xl" dir="rtl"><Skeleton className="h-96 rounded-3xl" /></div>;

  if (!cart || cart.items.length === 0) return (
    <div className="container mx-auto px-4 py-24 text-center" dir="rtl">
      <p className="font-bold text-lg mb-4">سبد خرید خالی است</p>
      <Button onClick={() => navigate("/shop")} className="rounded-full">رفتن به فروشگاه</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl font-black mb-6">تکمیل خرید</h1>

        {/* Where the customer is in the purchase, mirroring the design's stepper. */}
        <ol className="flex items-center gap-2 sm:gap-4 mb-8 overflow-x-auto" aria-label="مراحل خرید">
          {[
            { label: "سبد خرید", done: true },
            { label: "اطلاعات ارسال", done: addressComplete },
            { label: "پرداخت", done: false, current: addressComplete && !!activeShipping },
            { label: "تکمیل سفارش", done: false },
          ].map((stepItem, index, all) => {
            const state = stepItem.done ? "done" : stepItem.current ? "current" : "todo";
            return (
              <li key={stepItem.label} className="flex items-center gap-2 sm:gap-4 shrink-0">
                <span className="flex items-center gap-2">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                      state === "done"
                        ? "bg-primary text-primary-foreground border-primary"
                        : state === "current"
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {state === "done" ? <Check className="w-4 h-4" /> : (index + 1).toLocaleString("fa-IR")}
                  </span>
                  <span className={`text-xs sm:text-sm font-medium ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}>
                    {stepItem.label}
                  </span>
                </span>
                {index < all.length - 1 && <span className={`h-0.5 w-6 sm:w-12 ${stepItem.done ? "bg-primary" : "bg-border"}`} />}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-6">
            {/* Address */}
            <div className="bg-card rounded-2xl p-6 border border-border/50">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> اطلاعات تحویل</h2>

              {!!addresses?.length && (
                <div className="mb-5 flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">آدرس‌های ذخیره‌شده</p>
                  {addresses.map((address) => (
                    <label key={address.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedAddressId === address.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}>
                      <input type="radio" name="saved-address" className="mt-1" checked={selectedAddressId === address.id} onChange={() => fillFrom(address)} />
                      <span className="text-sm leading-relaxed">
                        {address.label && <span className="font-bold">{address.label} — </span>}
                        {address.province}، {address.city}، {address.street}
                        {address.isDefault && <span className="text-xs text-primary font-bold mr-2">(پیش‌فرض)</span>}
                      </span>
                    </label>
                  ))}
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selectedAddressId === "new" ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}>
                    <input type="radio" name="saved-address" checked={selectedAddressId === "new"} onChange={() => { setSelectedAddressId("new"); setForm((f) => ({ ...f, province: "", city: "", street: "", postalCode: "" })); }} />
                    <span className="text-sm font-medium">آدرس جدید</span>
                  </label>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "name", label: "نام و نام خانوادگی", placeholder: "نام کامل", autoComplete: "name" },
                  { key: "phone", label: "شماره موبایل", placeholder: "۰۹۱۲۳۴۵۶۷۸۹", autoComplete: "tel", inputMode: "tel" as const },
                ].map(({ key, label, placeholder, autoComplete, inputMode }) => (
                  <div key={key}>
                    <label htmlFor={`checkout-${key}`} className="text-sm font-medium text-muted-foreground mb-1.5 block">{label}</label>
                    <input id={`checkout-${key}`} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                      autoComplete={autoComplete} inputMode={inputMode}
                      className="h-10 w-full rounded-xl bg-muted border-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                ))}
                <div>
                  <label htmlFor="checkout-province" className="text-sm font-medium text-muted-foreground mb-1.5 block">استان</label>
                  <select id="checkout-province" value={form.province}
                    onChange={e => { setSelectedAddressId("new"); setForm(f => ({ ...f, province: e.target.value, city: "" })); }}
                    className="h-10 w-full rounded-xl bg-muted border-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                    <option value="">انتخاب استان</option>
                    {IRAN_PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="checkout-city" className="text-sm font-medium text-muted-foreground mb-1.5 block">شهر</label>
                  {/* Suggestions only: any city name can be typed. */}
                  <input id="checkout-city" list="checkout-city-options" value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    placeholder={form.province ? "نام شهر" : "ابتدا استان را انتخاب کنید"} disabled={!form.province} autoComplete="address-level2"
                    className="h-10 w-full rounded-xl bg-muted border-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
                  <datalist id="checkout-city-options">
                    {IRAN_PROVINCES.find((p) => p.name === form.province)?.cities.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="checkout-postalCode" className="text-sm font-medium text-muted-foreground mb-1.5 block">کد پستی</label>
                  <input id="checkout-postalCode" value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="۱۲۳۴۵۶۷۸۹۰"
                    autoComplete="postal-code" inputMode="numeric"
                    className="h-10 w-full rounded-xl bg-muted border-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="checkout-street" className="text-sm font-medium text-muted-foreground mb-1.5 block">آدرس کامل</label>
                  <textarea id="checkout-street" value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} placeholder="خیابان، کوچه، پلاک..." rows={2}
                    autoComplete="street-address"
                    className="w-full rounded-xl bg-muted border-none px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                </div>
                {user && selectedAddressId === "new" && (
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                    <span>این آدرس برای خریدهای بعدی ذخیره شود</span>
                  </label>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="bg-card rounded-2xl p-6 border border-border/50">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2"><Truck className="w-5 h-5 text-primary" /> روش ارسال</h2>
              <div className="flex flex-col gap-3">
                {shippingMethods?.map((method) => (
                  <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedShipping === method.id.toString() ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/30"}`}>
                    <input type="radio" name="shipping" value={method.id.toString()} checked={selectedShipping === method.id.toString()} onChange={e => setSelectedShipping(e.target.value)} className="hidden" />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedShipping === method.id.toString() ? "border-primary" : "border-muted-foreground"}`}>
                      {selectedShipping === method.id.toString() && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{method.nameFa}</p>
                      <p className="text-xs text-muted-foreground">{method.estimatedDays} تا {method.estimatedDays + 2} روز کاری</p>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-sm">{shippingCostFor(method, subtotal) === 0 ? "رایگان" : `${method.price.toLocaleString("fa-IR")} تومان`}</span>
                      {method.minOrderForFree != null && shippingCostFor(method, subtotal) > 0 && (
                        <p className="text-[11px] text-muted-foreground">رایگان برای خرید بالای {method.minOrderForFree.toLocaleString("fa-IR")} تومان</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card rounded-2xl p-6 border border-border/50">
              <h2 className="font-bold text-base mb-3">توضیحات سفارش (اختیاری)</h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="توضیحات یا درخواست خاص..." rows={2} className="w-full rounded-xl bg-muted border-none px-4 py-3 text-sm focus:outline-none resize-none" />
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:w-80 flex flex-col gap-4">
            <div className="bg-card rounded-2xl p-5 border border-border/50">
              <h3 className="font-bold mb-4">کالاهای سفارش</h3>
              <div className="flex flex-col gap-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {item.product.images[0] && <img src={imageUrl(item.product.images[0], 160)} alt={item.product.nameFa} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.product.nameFa}</p>
                      {item.variantLabel && <p className="text-[11px] text-muted-foreground truncate">{item.variantLabel}</p>}
                      <p className="text-xs text-muted-foreground">{item.quantity.toLocaleString("fa-IR")} عدد × {item.price.toLocaleString("fa-IR")}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex gap-2 mb-3">
                <input value={discountCode} onChange={e => { setDiscountCode(e.target.value); setAppliedDiscount(null); }} placeholder="کد تخفیف" className="flex-1 h-9 rounded-xl bg-muted border-none px-3 text-sm focus:outline-none" />
                <Button size="sm" variant="outline" className="rounded-xl shrink-0" onClick={handleApplyDiscount}>اعمال</Button>
              </div>
              <Separator className="my-3" />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span>{subtotal.toLocaleString("fa-IR")} تومان</span></div>
                {discountAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">تخفیف</span><span className="text-emerald-400">-{discountAmount.toLocaleString("fa-IR")} تومان</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">هزینه ارسال</span><span>{!activeShipping ? "انتخاب نشده" : shippingCost === 0 ? "رایگان" : `${shippingCost.toLocaleString("fa-IR")} تومان`}</span></div>
                <Separator />
                <div className="flex justify-between font-black text-base"><span>مبلغ نهایی</span><span className="text-primary">{total.toLocaleString("fa-IR")} تومان</span></div>
              </div>
              <Button className="rounded-full font-bold mt-4 w-full gap-2" onClick={handlePlaceOrder} disabled={createOrder.isPending || !selectedShipping}>
                <CheckCircle2 className="w-4 h-4" />
                {createOrder.isPending ? "در حال ثبت..." : "ثبت سفارش"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
