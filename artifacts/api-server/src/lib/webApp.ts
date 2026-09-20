import fs from "fs";
import path from "path";
import express, { type Express, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, blogPostsTable } from "@workspace/db";
import { currentPrice } from "./products";
import { logger } from "./logger";

/*
 * Optional: serve the built storefront from this server (SERVE_WEB=/path/to/dist/public).
 *
 * The storefront is a single-page app, so a crawler or a messaging app that does not run
 * JavaScript would otherwise see the same generic title on every page. Here the page's
 * title, description, image and structured data are written into index.html per request.
 */

const SITE_NAME = "بازارچه";
const DEFAULT_DESCRIPTION =
  "بازارچه، فروشگاه اینترنتی همه‌چیز؛ کالای دیجیتال، مد و پوشاک، خانه و آشپزخانه، زیبایی و سلامت، ورزش و سفر با ضمانت اصالت و ارسال سریع.";

type PageMeta = { title: string; description: string; image?: string | null; type: string; jsonLd?: unknown };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function absolute(req: Request, url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const origin = `${req.headers["x-forwarded-proto"] ?? req.protocol}://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
  return new URL(url, origin).href;
}

async function metaForPath(pathname: string): Promise<PageMeta> {
  const productMatch = /^\/product\/([^/]+)\/?$/.exec(pathname);
  if (productMatch) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, decodeURIComponent(productMatch[1])));
    if (product) {
      return {
        title: product.nameFa,
        description: product.descriptionFa ?? DEFAULT_DESCRIPTION,
        image: (product.images as string[])?.[0],
        type: "product",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.nameFa,
          description: product.descriptionFa ?? undefined,
          sku: product.sku ?? undefined,
          brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
          offers: {
            "@type": "Offer",
            price: currentPrice(product),
            priceCurrency: "IRR",
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        },
      };
    }
  }

  const blogMatch = /^\/blog\/([^/]+)\/?$/.exec(pathname);
  if (blogMatch) {
    const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, decodeURIComponent(blogMatch[1])));
    if (post) {
      return { title: post.titleFa, description: post.excerptFa ?? DEFAULT_DESCRIPTION, image: post.coverImage, type: "article" };
    }
  }

  if (pathname === "/shop") return { title: "فروشگاه", description: DEFAULT_DESCRIPTION, type: "website" };
  if (pathname === "/blog") return { title: "مجله بازارچه", description: "راهنمای خرید، بررسی و مقایسه‌ی کالاها.", type: "website" };
  return { title: `${SITE_NAME} — فروشگاه اینترنتی همه‌چیز`, description: DEFAULT_DESCRIPTION, type: "website" };
}

/** Replaces the template's head tags with this page's own. */
function withMeta(template: string, meta: PageMeta, req: Request): string {
  const title = meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} | ${SITE_NAME}`;
  const image = absolute(req, meta.image) ?? absolute(req, "/opengraph.jpg");
  const url = absolute(req, req.originalUrl);

  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url ?? "")}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="${escapeHtml(meta.type)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fa_IR" />`,
    url ? `<meta property="og:url" content="${escapeHtml(url)}" />` : "",
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "",
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : "",
    meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c")}</script>` : "",
  ].filter(Boolean).join("\n    ");

  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+(name|property)="(description|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, "")
    .replace("</head>", `  ${head}\n  </head>`);
}

export function serveWebApp(app: Express, dir: string): void {
  const indexPath = path.join(dir, "index.html");
  if (!fs.existsSync(indexPath)) {
    logger.warn({ dir }, "SERVE_WEB is set but the built storefront was not found; skipping");
    return;
  }
  const template = fs.readFileSync(indexPath, "utf8");

  // Hashed build assets can be cached hard; index.html is rendered per request.
  app.use(express.static(dir, { index: false, maxAge: "7d" }));

  app.get(/^(?!\/api\/).*/, async (req, res, next) => {
    if (!req.accepts("html")) { next(); return; }
    try {
      const meta = await metaForPath(req.path);
      res.type("html").send(withMeta(template, meta, req));
    } catch (err) {
      logger.error({ err, path: req.path }, "failed to render the page shell");
      res.type("html").send(template);
    }
  });
}
