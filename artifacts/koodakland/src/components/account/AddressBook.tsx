import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAddUserAddress, useDeleteUserAddress, useGetUserAddresses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/utils";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import { MapPin, Plus, Trash2 } from "lucide-react";

const EMPTY = { label: "", province: "", city: "", street: "", postalCode: "" };
const fieldClass = "h-10 w-full rounded-xl bg-muted border-none px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** Saved delivery addresses, shown in the profile and reused at checkout. */
export function AddressBook({ userId }: { userId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["addresses", userId];
  const { data: addresses, isLoading } = useGetUserAddresses(userId, { query: { queryKey } });
  const addAddress = useAddUserAddress();
  const deleteAddress = useDeleteUserAddress();
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const onError = (error: unknown) => toast({ title: "خطا", description: apiErrorMessage(error, "انجام نشد"), variant: "destructive" });

  const submit = () => {
    const postalCode = toAsciiDigits(form.postalCode.trim());
    if (!form.province || !form.city.trim() || form.street.trim().length < 5) {
      toast({ title: "اطلاعات ناقص", description: "استان، شهر و نشانی را کامل وارد کنید", variant: "destructive" });
      return;
    }
    if (!/^\d{10}$/.test(postalCode)) {
      toast({ title: "کد پستی نامعتبر", description: "کد پستی باید ۱۰ رقم باشد", variant: "destructive" });
      return;
    }
    addAddress.mutate(
      { id: userId, data: { ...form, label: form.label.trim() || undefined, city: form.city.trim(), street: form.street.trim(), postalCode } },
      {
        onSuccess: () => { toast({ title: "آدرس ذخیره شد" }); setForm(EMPTY); setAdding(false); refresh(); },
        onError,
      },
    );
  };

  if (isLoading) return <div className="flex flex-col gap-3">{Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;

  return (
    <div className="flex flex-col gap-4">
      {(addresses ?? []).length === 0 && !adding && (
        <div className="text-center py-16 text-muted-foreground bg-muted/30 rounded-3xl">هنوز آدرسی ذخیره نکرده‌اید</div>
      )}

      {(addresses ?? []).map((address) => (
        <div key={address.id} className="bg-card rounded-2xl p-4 border border-border/50 flex items-start gap-3">
          <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              {address.label || `${address.province}، ${address.city}`}
              {address.isDefault && <span className="text-xs text-primary mr-2">(پیش‌فرض)</span>}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">{address.province}، {address.city}، {address.street}</p>
            <p className="text-xs text-muted-foreground mt-1">کد پستی: {address.postalCode}</p>
          </div>
          <Button
            size="icon" variant="ghost" aria-label="حذف آدرس" disabled={deleteAddress.isPending}
            onClick={() => deleteAddress.mutate({ id: userId, addressId: address.id }, { onSuccess: refresh, onError })}
            className="w-8 h-8 rounded-lg hover:bg-destructive/10 hover:text-destructive shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      {adding ? (
        <div className="bg-card rounded-2xl p-5 border border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="عنوان (مثلاً خانه، محل کار)" className={fieldClass} />
          <select value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, city: "" }))} className={fieldClass}>
            <option value="">انتخاب استان</option>
            {IRAN_PROVINCES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <input value={form.city} list="address-city-options" onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="شهر" disabled={!form.province} className={`${fieldClass} disabled:opacity-60`} />
          <datalist id="address-city-options">
            {IRAN_PROVINCES.find((p) => p.name === form.province)?.cities.map((c) => <option key={c} value={c} />)}
          </datalist>
          <input value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="کد پستی ۱۰ رقمی" inputMode="numeric" className={fieldClass} />
          <textarea value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} placeholder="خیابان، کوچه، پلاک..." rows={2} className="sm:col-span-2 w-full rounded-xl bg-muted border-none px-4 py-3 text-sm focus:outline-none resize-none" />
          <div className="sm:col-span-2 flex gap-2">
            <Button onClick={submit} disabled={addAddress.isPending} className="rounded-full font-bold">ذخیره آدرس</Button>
            <Button variant="outline" onClick={() => { setAdding(false); setForm(EMPTY); }} className="rounded-full">انصراف</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="rounded-full w-fit gap-2">
          <Plus className="w-4 h-4" /> افزودن آدرس
        </Button>
      )}
    </div>
  );
}
