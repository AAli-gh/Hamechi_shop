import { Link } from "wouter";
import { Product } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingBag, Star } from "lucide-react";
import { useCartSession, useSetCartData } from "@/lib/cart";
import { apiErrorMessage, imageUrl } from "@/lib/utils";
import { useAddToCart } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useWishlist } from "@/lib/wishlist";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { sessionId } = useCartSession();
  const addToCart = useAddToCart();
  const setCart = useSetCartData();
  const wishlist = useWishlist();
  const saved = wishlist.isSaved(product.id);
  const { toast } = useToast();

  const hasVariants = product.variants.length > 0;
  // Different variants can cost different amounts; show the cheapest as "از ...".
  const variantPrices = product.variants.map((v) => v.salePrice ?? v.price);
  const priceVaries = hasVariants && new Set(variantPrices).size > 1;

  const handleAddToCart = (e: React.MouseEvent) => {
    // A product with options (color, size, ...) needs a choice first: let the
    // click fall through to the card link, which opens the product page.
    if (hasVariants) return;
    e.preventDefault();
    e.stopPropagation();
    
    addToCart.mutate(
      {
        data: {
          productId: product.id,
          quantity: 1,
          sessionId: sessionId,
        },
      },
      {
        onSuccess: (cart) => {
          setCart(cart);
          toast({
            title: "اضافه شد",
            description: "محصول با موفقیت به سبد خرید اضافه شد.",
          });
        },
        onError: (error) => {
          toast({
            title: "خطا",
            description: apiErrorMessage(error, "خطایی در افزودن به سبد خرید رخ داد."),
            variant: "destructive",
          });
        },
      }
    );
  };

  const hasDiscount = product.salePrice && product.salePrice < product.price;

  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <Card className="overflow-hidden border-none shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1 bg-white/80 backdrop-blur-sm dark:bg-card/80">
        <div className="relative aspect-square overflow-hidden bg-muted/50 rounded-t-2xl">
          {product.images && product.images.length > 0 ? (
            <img
              src={imageUrl(product.images[0], 400)}
              alt={product.nameFa}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ShoppingBag className="w-12 h-12 opacity-20" />
            </div>
          )}
          
          {/* Badges */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {hasDiscount && (
              <Badge variant="destructive" className="font-bold px-2 py-1 rounded-full shadow-sm text-xs">
                تخفیف ویژه
              </Badge>
            )}
            {product.isFlashSale && (
              <Badge className="bg-orange-500 hover:bg-orange-600 font-bold px-2 py-1 rounded-full shadow-sm text-xs text-white border-none">
                حراج زمان‌دار
              </Badge>
            )}
          </div>
          
          <div className="absolute top-3 left-3">
            <Button
              variant="secondary"
              size="icon"
              className={`w-8 h-8 rounded-full shadow-sm bg-white/90 hover:bg-red-50 hover:text-red-500 ${saved ? "text-red-500" : "text-slate-400"}`}
              aria-label={saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
              aria-pressed={saved}
              disabled={wishlist.isPending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                wishlist.toggle(product);
              }}
            >
              <Heart className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />
            </Button>
          </div>
        </div>
        
        <CardContent className="p-4 rounded-b-2xl">
          <div className="text-xs text-muted-foreground mb-1 font-medium">{product.categoryName}</div>
          <h3 className="font-bold text-base leading-tight mb-2 line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {product.nameFa}
          </h3>
          
          <div className="flex items-center gap-1 mb-3">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(product.avgRating || 0) ? 'fill-current' : 'text-slate-200 dark:text-slate-700'}`} />
              ))}
            </div>
            <span className="text-xs text-muted-foreground mt-0.5">({product.reviewCount})</span>
          </div>
          
          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
            <div className="flex flex-col">
              {priceVaries ? (
                <span className="font-extrabold text-foreground text-sm sm:text-base">از {Math.min(...variantPrices).toLocaleString("fa-IR")} تومان</span>
              ) : hasDiscount ? (
                <>
                  <span className="text-xs text-muted-foreground line-through decoration-destructive/50">{product.price.toLocaleString("fa-IR")} تومان</span>
                  <span className="font-extrabold text-primary text-sm sm:text-base">{product.salePrice!.toLocaleString("fa-IR")} تومان</span>
                </>
              ) : (
                <span className="font-extrabold text-foreground text-sm sm:text-base">{product.price.toLocaleString("fa-IR")} تومان</span>
              )}
            </div>
            
            <Button 
              size="icon" 
              className="rounded-full shadow-sm shrink-0 w-8 h-8 sm:w-10 sm:h-10 transition-transform active:scale-95"
              onClick={handleAddToCart}
              aria-label={hasVariants ? "انتخاب گزینه‌ها" : "افزودن به سبد خرید"}
              title={hasVariants ? "انتخاب گزینه‌ها" : "افزودن به سبد خرید"}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
