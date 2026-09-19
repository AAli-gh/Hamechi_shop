import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useAddToWishlist,
  useGetWishlist,
  useRemoveFromWishlist,
  type Product,
  type WishlistItem,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/utils";

/**
 * Wishlist state shared by every heart button. Uses the same query key as the
 * wishlist page, so adding or removing a product updates it without a refetch.
 */
export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryKey = ["wishlist", user?.id];

  const { data } = useGetWishlist({ userId: user?.id }, { query: { enabled: !!user, queryKey } });
  const add = useAddToWishlist();
  const remove = useRemoveFromWishlist();
  const saved = new Set((data ?? []).map((item) => item.productId));

  const setItems = (update: (items: WishlistItem[]) => WishlistItem[]) =>
    queryClient.setQueryData<WishlistItem[]>(queryKey, (items) => update(items ?? []));

  const toggle = (product: Product) => {
    if (!user) {
      toast({ title: "ورود لازم است", description: "برای ذخیره در علاقه‌مندی‌ها وارد حساب خود شوید." });
      navigate("/login");
      return;
    }
    const onError = (error: unknown) =>
      toast({ title: "خطا", description: apiErrorMessage(error, "علاقه‌مندی‌ها به‌روز نشد"), variant: "destructive" });

    if (saved.has(product.id)) {
      remove.mutate({ productId: product.id }, {
        onSuccess: () => setItems((items) => items.filter((i) => i.productId !== product.id)),
        onError,
      });
    } else {
      add.mutate({ data: { userId: user.id, productId: product.id } }, {
        onSuccess: (item) => {
          setItems((items) => [...items, { ...item, product: item.product ?? product }]);
          toast({ title: "به علاقه‌مندی‌ها اضافه شد", description: product.nameFa });
        },
        onError,
      });
    }
  };

  return { isSaved: (productId: number) => saved.has(productId), toggle, isPending: add.isPending || remove.isPending };
}
