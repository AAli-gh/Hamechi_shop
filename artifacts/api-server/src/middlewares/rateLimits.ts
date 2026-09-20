import type { Express } from "express";
import rateLimit from "express-rate-limit";

const message = { error: "تعداد درخواست‌ها زیاد است؛ لطفاً کمی بعد دوباره تلاش کنید." };

function limiter(windowMinutes: number, limit: number, onlyWrites = false) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message,
    skip: onlyWrites ? (req) => req.method === "GET" || req.method === "HEAD" : undefined,
  });
}

/** Per-IP limits: a broad ceiling for the whole API plus tighter ones for public write endpoints. */
export function applyRateLimits(app: Express): void {
  // Local escape hatch for test scripts; never honoured in production.
  if (process.env.RATE_LIMITS === "off" && process.env.NODE_ENV !== "production") return;

  app.use("/api", limiter(1, 300));
  app.use("/api/orders", limiter(10, 10, true));
  app.use("/api/reviews", limiter(60, 10, true));
  app.use("/api/discounts/validate", limiter(10, 20));
  app.use("/api/newsletter/subscribe", limiter(60, 5));
  app.use(/^\/api\/products\/\d+\/notify$/, limiter(60, 10));
  app.use("/api/cart", limiter(1, 60, true));
}
