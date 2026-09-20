import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { isDevAuth } from "./middleware/auth";
import { applyRateLimits } from "./middlewares/rateLimits";
import path from "path";
import { UPLOADS_DIR, resizedImages } from "./lib/images";
import { serveWebApp } from "./lib/webApp";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

// Behind the hosting proxy: use the first X-Forwarded-For hop as the client IP (for rate limiting).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  helmet({
    // Product images under /api/uploads are also loaded by the storefront.
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);

// The storefront calls the API from the same origin, so cross-origin access is off
// unless specific origins are listed in CORS_ORIGINS (comma-separated).
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({ credentials: true, origin: corsOrigins.length > 0 ? corsOrigins : false }));
applyRateLimits(app);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

if (!isDevAuth) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

// ?w= serves a cached, resized WebP; otherwise the original file. Upload names are
// unique per file, so both can be cached by browsers for a long time.
app.use("/api/uploads", resizedImages, express.static(UPLOADS_DIR, { maxAge: "30d", immutable: true, dotfiles: "ignore" }));

app.use("/api", router);

// Optionally serve the built storefront with per-page meta tags (see lib/webApp.ts).
if (process.env.SERVE_WEB) serveWebApp(app, path.resolve(process.env.SERVE_WEB));

export default app;
