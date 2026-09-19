import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Cart } from "@workspace/api-client-react";

interface CartContextType {
  sessionId: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    let storedSessionId = localStorage.getItem("cart_session_id");
    if (!storedSessionId) {
      storedSessionId = crypto.randomUUID();
      localStorage.setItem("cart_session_id", storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  if (!sessionId) {
    return null; // or a loading spinner if preferred
  }

  return (
    <CartContext.Provider value={{ sessionId }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartSession() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCartSession must be used within a CartProvider");
  }
  return context;
}

/** Replaces the cached cart (shared by header, mobile nav, cart and checkout) with a server response. */
export function useSetCartData() {
  const { sessionId } = useCartSession();
  const queryClient = useQueryClient();
  return (cart: Cart) => queryClient.setQueryData(["cart", sessionId], cart);
}
