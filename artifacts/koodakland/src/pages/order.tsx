import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useGetOrder, useCancelOrder, useRequestOrderReturn } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, imageUrl } from "@/lib/utils";
import { Printer, ArrowRight, XCircle, RotateCcw } from "lucide-react";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "در انتظار تایید", color: "bg-yellow-500/15 text-yellow-300" },
  processing: { label: "در حال پردازش", color: "bg-sky-500/15 text-sky-300" },
  shipped: { label: "ارسال شده", color: "bg-violet-500/15 text-violet-300" },
  delivered: { label: "تحویل داده شده", color: "bg-emerald-500/15 text-emerald-400" },
  cancelled: { label: "لغو شده", color: "bg-red-500/15 text-red-400" },
};

/** addressSnapshot is JSON written at checkout; older orders may hold plain text. */
function formatAddress(snapshot: string | null | undefined): string {
  if (!snapshot) return "—";
  try {
    const a = JSON.parse(snapshot) as Record<string, string>;
    return [a.province, a.city, a.street, a.postalCode && `کد پستی ${a.postalCode}`].filter(Boolean).join("، ");
  } catch {
    return snapshot;
  }
}

export default function OrderPage() {
  const [, params] = useRoute("/orders/:id");
  const orderId = Number(params?.id);
  const { user, isLoaded } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnReason, setReturnReason] = useState("");
  const [returning, setReturning] = useState(false);

  useSEO({ title: "جزئیات سفارش" });

  const queryKey = ["order", orderId];
  const { data: order, isLoading, error } = useGetOrder(orderId, {
    query: { enabled: !!orderId && !!user, queryKey, retry: false },
  });
  const cancelOrder = useCancelOrder();
  const requestReturn = useRequestOrderReturn();

  const onError = (e: unknown) => toast({ title: "خطا", description: apiErrorMessage(e, "انجام نشد"), variant: "destructive" });
  const refresh = (updated: unknown) => { queryClient.setQueryData(queryKey, updated); queryClient.invalidateQueries({ queryKey: ["user-orders"] }); };

  if (!isLoaded || isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-3xl flex flex-col gap-4" dir="rtl">
      <Skeleton className="h-24 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" />
    </div>
  );

  if (!user) return (
    <div className="container mx-auto px-4 py-24 text-center max-w-md" dir="rtl">
      <p className="font-bold text-lg mb-4">برای مشاهده سفارش وارد حساب خود شوید</p>
      <Link href="/login"><Button className="rounded-full font-bold px-8">ورود</Button></Link>
    </div>
  );

  if (error || !order) return (
    <div className="container mx-auto px-4 py-24 text-center max-w-md" dir="rtl">
      <p className="font-bold text-lg mb-4">سفارش یافت نشد</p>
      <Link href="/profile"><Button variant="outline" className="rounded-full">بازگشت به حساب کاربری</Button></Link>
    </div>
  );

  const status = STATUS[order.status] ?? { label: order.status, color: "bg-muted text-foreground" };
  const canCancel = order.status === "pending" || order.status === "processing";
  const canReturn = order.status === "delivered" && !order.returnRequestedAt;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> بازگشت به سفارش‌ها
          </Link>
          <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> چاپ فاکتور
          </Button>
        </div>

        <div className="bg-card rounded-3xl border border-border/50 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl font-black">فاکتور سفارش #{order.orderNumber}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                تاریخ ثبت: {new Date(order.createdAt).toLocaleDateString("fa-IR")}
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${status.color}`}>{status.label}</span>
          </div>

          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
            <div><dt className="text-muted-foreground inline">گیرنده: </dt><dd className="inline font-medium">{order.customerName || "—"}</dd></div>
            <div><dt className="text-muted-foreground inline">موبایل: </dt><dd className="inline font-medium">{order.customerPhone || "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground inline">آدرس: </dt><dd className="inline font-medium">{formatAddress(order.addressSnapshot)}</dd></div>
            {order.trackingCode && <div><dt className="text-muted-foreground inline">کد پیگیری: </dt><dd className="inline font-medium text-primary">{order.trackingCode}</dd></div>}
          </dl>

          <Separator className="mb-4" />

          <ul className="flex flex-col divide-y divide-border/40 mb-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {item.image && <img src={imageUrl(item.image, 160)} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.productName}</p>
                  {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.quantity.toLocaleString("fa-IR")} × {item.price.toLocaleString("fa-IR")}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">جمع کالاها</span><span>{order.subtotal.toLocaleString("fa-IR")} تومان</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">تخفیف</span><span className="text-emerald-400">-{order.discount.toLocaleString("fa-IR")} تومان</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">هزینه ارسال</span><span>{order.shippingCost === 0 ? "رایگان" : `${order.shippingCost.toLocaleString("fa-IR")} تومان`}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-black text-base"><span>مبلغ کل</span><span className="text-primary">{order.total.toLocaleString("fa-IR")} تومان</span></div>
          </div>

          {order.returnRequestedAt && (
            <div className="mt-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 text-sm">
              <p className="font-bold text-amber-300">درخواست مرجوعی ثبت شد</p>
              <p className="text-amber-200/80 mt-1">تاریخ: {new Date(order.returnRequestedAt).toLocaleDateString("fa-IR")}</p>
              {order.returnReason && <p className="text-amber-200/80 mt-1">دلیل: {order.returnReason}</p>}
              <p className="text-amber-200/80 mt-1">پشتیبانی برای هماهنگی با شما تماس می‌گیرد.</p>
            </div>
          )}

          {(canCancel || canReturn) && (
            <div className="mt-6 flex flex-col gap-3 print:hidden">
              <Separator />
              {canCancel && (
                <Button
                  variant="outline"
                  className="rounded-full gap-2 w-fit text-destructive border-destructive/30 hover:bg-destructive/5"
                  disabled={cancelOrder.isPending}
                  onClick={() => {
                    if (!confirm("این سفارش لغو شود؟")) return;
                    cancelOrder.mutate({ id: order.id }, {
                      onSuccess: (updated) => { refresh(updated); toast({ title: "سفارش لغو شد" }); },
                      onError,
                    });
                  }}
                >
                  <XCircle className="w-4 h-4" /> لغو سفارش
                </Button>
              )}

              {canReturn && (returning ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="return-reason" className="text-sm font-medium">دلیل مرجوع کردن کالا</label>
                  <textarea
                    id="return-reason" rows={3} value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="مثلاً کالا با توضیحات سایت مطابقت ندارد"
                    className="w-full rounded-xl bg-muted border-none px-4 py-3 text-sm focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      className="rounded-full font-bold" disabled={requestReturn.isPending}
                      onClick={() => requestReturn.mutate({ id: order.id, data: { reason: returnReason } }, {
                        onSuccess: (updated) => { refresh(updated); setReturning(false); toast({ title: "درخواست مرجوعی ثبت شد" }); },
                        onError,
                      })}
                    >
                      ثبت درخواست
                    </Button>
                    <Button variant="outline" className="rounded-full" onClick={() => setReturning(false)}>انصراف</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="rounded-full gap-2 w-fit" onClick={() => setReturning(true)}>
                  <RotateCcw className="w-4 h-4" /> درخواست مرجوعی
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
