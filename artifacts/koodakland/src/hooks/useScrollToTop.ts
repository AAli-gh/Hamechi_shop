import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * Opening a page should start at the top, the way a normal page load does.
 * A single-page app keeps the previous scroll position otherwise, so a link in
 * the footer would open the next page already scrolled near the bottom.
 *
 * Back and forward are left to the browser, which restores where the visitor was.
 */
export function useScrollToTop(): void {
  const [location] = useLocation();
  const previous = useRef<string | null>(null);
  const cameFromHistory = useRef(false);

  useEffect(() => {
    const onPopState = () => { cameFromHistory.current = true; };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const isFirstRender = previous.current === null;
    const samePage = previous.current === location;
    previous.current = location;

    if (cameFromHistory.current) {
      cameFromHistory.current = false;
      return;
    }
    if (isFirstRender || samePage) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
}
