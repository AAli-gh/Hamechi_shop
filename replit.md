# بازارچه (Bazarcheh)

A Persian (RTL) general-purpose online store: digital goods, fashion, home and kitchen,
beauty, sports and kids — with a customer storefront and an admin panel.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 by default; `PORT` sets it)
- `pnpm --filter @workspace/koodakland run dev` — run the storefront (needs `PORT` and `BASE_PATH`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run seed` — fill the database with Persian sample data (**deletes catalogue rows first**)
- `pnpm --filter @workspace/api-server run test` — API tests (see below)

Required env:

- `DATABASE_URL` — Postgres connection string
- `PORT` — API port
- Optional: `SMTP_URL` + `MAIL_FROM` + `PUBLIC_SITE_URL` (back-in-stock emails), `CORS_ORIGINS`
  (only if the storefront is served from another origin), `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY`

## Tests

`artifacts/api-server/tests/*.test.mjs` run against a **running API and a seeded database** (they
write to it, so never point them at production):

```
pnpm --filter @workspace/db run seed
DEV_AUTH=true RATE_LIMITS=off PORT=8090 pnpm --filter @workspace/api-server run dev   # in one shell
DATABASE_URL=... pnpm --filter @workspace/api-server run test                          # in another
```

`API_URL` (default `http://127.0.0.1:8090`) points the tests at another server.

## Local development without Clerk

`DEV_AUTH=true` on the API and `VITE_DEV_AUTH=true` on the storefront skip Clerk and treat every
request as a fixed admin user. Both are ignored when `NODE_ENV=production`. `RATE_LIMITS=off`
disables the rate limiter outside production (used by the tests).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Storefront: React 19, Vite, wouter, TanStack Query, Tailwind + shadcn/ui

## Where things live

- `lib/api-spec/openapi.yaml` — **source of truth for the API**. Change it, then run codegen.
- `lib/db/src/schema/*` — database schema (Drizzle); `lib/db/scripts/seed.mjs` — sample data
- `lib/api-client-react` / `lib/api-zod` — generated client hooks and validation schemas
- `artifacts/api-server/src/routes/*` — endpoints; `src/lib/*` — shared logic (pricing, search,
  products/variants, categories, images, mailer)
- `artifacts/koodakland/src/pages/*` — storefront and `pages/admin/*` — admin panel
- `artifacts/koodakland/src/index.css` — theme tokens (colors, fonts)

## Architecture decisions

- Products may have **variants** (color, size, ...). With variants, stock lives on the variants and
  `products.stock` mirrors their sum, so listings and low-stock reports keep working unchanged.
- Money is computed **server-side** at order time: current product prices, discount rules and the
  shipping method's own price and free-shipping threshold. The client only displays them.
- Persian search folds Arabic/Persian letter and digit variants, ZWNJ and spaces on both sides of
  the comparison (`src/lib/search.ts`), because Postgres has no Persian text search configuration.
- Uploaded images are re-encoded to WebP and served resized via `?w=` with an on-disk cache.
- Email is optional: without `SMTP_URL`, back-in-stock notifications stay pending instead of being
  marked as sent.

## Product

Storefront: catalogue with multi-level categories, search, filters, product pages with variants,
specifications and reviews, cart, checkout with saved addresses and shipping methods, discount
codes, order tracking, wishlist, customer invoices with cancellation and return requests, blog.

Admin: products (images, variants, specifications), categories, orders with details, inventory,
discounts, banners, blog, newsletter, reports, stock notifications.

## Gotchas

- Edit `openapi.yaml` **before** the code: server validation (`@workspace/api-zod`) and the client
  hooks are generated from it.
- `pnpm --filter @workspace/db run seed` wipes catalogue tables (products, categories, orders, carts).
- Routers are mounted without a path prefix, so `router.use(...)` inside one applies to **every**
  request that reaches it — always scope it (`router.use("/admin", ...)`).
- `/products/:id` would swallow `/products/best-sellers`, so the best-sellers router is mounted first.
- Payment is **not** implemented: orders are created as `pending` with no gateway.
- The SMS panel is a mock (in-memory templates and logs), and there is no SMS provider.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
