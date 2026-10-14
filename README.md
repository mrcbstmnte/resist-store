# RESIST — store MVP

Next.js 16 (App Router, Cache Components) · Postgres · Drizzle ORM · PayMongo Checkout.

- **Storefront**: catalog, product pages with live per-size availability, cookie-based bag.
- **Checkout**: reserves stock, then sends the shopper to PayMongo (GCash, Maya, QR Ph, card, GrabPay). A built-in mock payment page is used when no PayMongo key is set.
- **Admin** (`/admin`, HTTP Basic auth): stock dashboard with low/sold-out filters, receive/count stock per size, orders, product + size management, full stock history.
- **Products and colourways**: each colourway is its own product (e.g. "Box Tee — Ink"), and its variants are sizes only. A product's "Drawing colour" tints the drawn garment until a photo is added.

## Brand

The storefront uses a black ground, white compressed type (Archivo at 62% width, weight 900), and a cobalt accent. Product tiles sit on a running-track surface. Until photos are uploaded, each product is drawn as a garment with a generated all-over print in its colourway (`src/components/dye.tsx`).

- **Logo**: placeholder in `src/components/logo.tsx`. Swap `LogoMark` for the real mark.
- **Colours and type**: tokens at the top of `src/app/globals.css`. The admin uses the light set; the storefront applies `.street`.
- **Photos**: all product, gallery and banner photos live in the database (seed copies are in `scripts/seed-photos/`). Upload a photo on the product's admin page (or paste a link). Uploads are resized to 1600px WebP and stored in Postgres, served from `/media/<id>.webp`, so they survive deploys on hosts without a persistent disk. Replacing or removing a photo deletes the old upload.

## Homepage content

Section headings and footer social links are set in `src/content/home.ts`; everything else is edited in admin.

- **Banner**: managed in **Admin → Banner**: headline, the line under it, button text and link, and an optional photo (upload or link, plus a description for screen readers). Without a photo it shows a drawn print.
- **Product sorting**: shoppers sort the product grid by category (the default), name or price. Clicking the active option flips between ascending and descending; the choice is kept in the URL (`/?sort=price&dir=desc`).
- **Gallery**: managed in **Admin → Gallery** (upload several at once, edit descriptions, remove). Photos are stored in the database like product photos. The section is hidden when the gallery is empty.
- **Testimonials**: managed in **Admin → Testimonials** (add, edit, show/hide, delete). The section is hidden until at least one is shown. The seed adds none, so only real reviews ever appear.
- **Social links**: Facebook and Instagram (`resistbcd`) are in the footer.

## Selling outside the website

The stock counts in admin are the one source of truth for every channel. When something sells in person, through Facebook or Instagram messages, or at a pop-up, record it with **Record a sale** (on the Stock and Orders pages):

- The sale is saved with the username of the admin who recorded it.
- Pick the channel, how they paid, the items and sizes, and optionally shipping, the amount actually paid (less than the list total is saved as a discount), the customer, and a note. Sales can be backdated, but not future-dated.
- The sale becomes a paid order tagged with its channel, and its units come off the shelf in the same transaction, the same way a paid website order does. It checks against stock on hand. If a website checkout in progress was holding those units, the order page warns you.
- **Orders** shows paid sales per channel for the last 30 days and filters the list by channel; **Stock history** shows the channel next to every sale.
- **Admin → Orders → Channels** adds, renames, or hides channels (starts with In person, Facebook, Instagram, Pop-up / event). Website orders are tracked automatically.

Use the Stock page's adjust form only for corrections (miscounts, damaged items, giveaways), not for sales.

## Shipping

**Admin → Shipping** sets one flat fee (₱0 means free) added to every order. Shoppers see it in the bag, PayMongo shows it as its own "Shipping" line, and each order keeps the fee it was charged, so changing it never alters past orders. The fee is worked out in `shippingFeeFor()` in `src/lib/shipping.ts`, which already receives the delivery address, so area-based rates only need changes there (plus an admin screen for the rates).

## How stock works

| Term | Meaning |
| --- | --- |
| On hand | Physical units. Changes only on payment, restock, or a stock count. |
| Held | Units in checkouts that are `pending` and not past `expires_at` (default 30 min). |
| Available | On hand − held. This is what shoppers can buy. |

Holds are **derived, not stored**, so an abandoned checkout frees its stock the moment it expires — no cron or queue. Checkout and payment lock the affected variant rows (`SELECT … FOR UPDATE`, in id order) so two shoppers can't buy the last unit. Payment is idempotent (webhooks retry). If a payment lands after its hold expired and the units already sold elsewhere, the order is still marked paid and flagged **Oversold** in admin, never silently dropped.

Every on-hand change is written to `stock_movements` with the balance after, so the ledger is auditable.

## Run locally

```bash
cp .env.example .env          # set DATABASE_URL, ADMIN_PASSWORD
npm install
npm run db:migrate
npm run db:seed               # the 8 RESIST products (50 of each size) + 6 gallery photos
npm run dev                   # http://localhost:3000, admin at /admin
npm test                      # needs a resist_test database (see vitest.config.mts)
```

## Deploy

### Vercel + Neon (recommended)

1. In Vercel: **Add New → Project**, import the GitHub repo. The defaults (Next.js, `npm run build`) are right.
2. Before the first deploy, add a database: **Storage → Create → Neon** (Vercel Marketplace) and connect it to the project. This sets `DATABASE_URL` for builds and runtime. The first build fails without it, because `npm run build` runs the migrations first.
3. Add the environment variables below under **Settings → Environment Variables**, then deploy (or redeploy).
4. Load the products and gallery once, from your machine, using the production connection string from Neon:
   ```bash
   DATABASE_URL="postgres://…neon.tech/…" npm run db:seed
   ```
   It skips itself if products already exist. **Never run `db:reset` against production**: it wipes products, orders and photos.
5. Open `/admin` (your `ADMIN_USERNAME` / `ADMIN_PASSWORD`), set real prices, and check the products.

| Variable | Needed | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Set by the Neon integration. `POSTGRES_URL` also works; migrations use `DATABASE_URL_UNPOOLED` when present. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | yes | Use long random passwords. For several admins, list them comma-separated in the same order, e.g. `ana,ben` and `ana-password,ben-password` (passwords can't contain commas). Sales record which admin entered them. |
| `APP_URL` | yes | Your production URL, e.g. `https://resist.vercel.app`. Used for PayMongo redirects and email links. |
| `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET` | to take payments | See below. Without them the live store shows "checkout isn't open yet". |
| `PAYMONGO_PAYMENT_METHODS` | no | Defaults to `gcash,paymaya,card,qrph,grab_pay`. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | for emails (free) | Order confirmations through a Gmail account. Skipped when unset. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | for emails (with a domain) | Order confirmations through Resend; used instead of Gmail when set. |
| `RESERVATION_MINUTES` | no | Defaults to 30. |
| `ALLOW_MOCK_PAYMENTS` | no | `true` turns on the fake payment page in production (demos only). Preview deployments get it automatically. |

Photo uploads are shrunk in the browser before they're sent, which keeps them under Vercel's 4.5MB request limit.

### Render

`render.yaml` provisions a web service and Postgres. In Render: **New → Blueprint**, select the repo, then fill in `APP_URL` and the PayMongo keys. (Render's free Postgres expires after 30 days; upgrade it for anything real.)

## PayMongo setup

1. In the PayMongo dashboard, copy your **secret key** (`sk_test_…` while testing) into `PAYMONGO_SECRET_KEY`.
2. Create a webhook pointing at `https://<your-domain>/api/webhooks/paymongo` for the `checkout_session.payment.paid` event, and put its signing secret (`whsk_…`) in `PAYMONGO_WEBHOOK_SECRET`.
3. Set `PAYMONGO_PAYMENT_METHODS` to the methods activated on your account (default `gcash,paymaya,card,qrph,grab_pay`).

The success page also asks PayMongo directly whether the session was paid, so orders confirm even if a webhook is delayed. Without a secret key, checkout uses a mock payment page in development and on preview deployments. On production it's switched off ("checkout isn't open yet") unless `ALLOW_MOCK_PAYMENTS=true`, since the mock page lets anyone mark their order paid.

## Order confirmation email

When an order is paid, the customer gets a confirmation email with their items, total, and delivery address (`src/lib/email/order-confirmation.ts`). It goes out through Gmail (free, no domain needed) or [Resend](https://resend.com) (once you own a domain). If both are set, Resend is used.

**Gmail (free, for now)**

1. Sign in to the Gmail account the emails should come from (e.g. resistbcd@gmail.com).
2. Turn on 2-Step Verification: Google Account → Security.
3. Create an app password: Google Account → Security → 2-Step Verification → **App passwords** (or go to myaccount.google.com/apppasswords). Name it "RESIST store" and copy the 16-letter password.
4. Set `GMAIL_USER` (the full address) and `GMAIL_APP_PASSWORD` (the 16 letters; spaces are fine) in Vercel, then redeploy.

Emails show as from "RESIST" at that Gmail address. Gmail allows about 500 emails a day, and replies land in that inbox (or in `EMAIL_REPLY_TO` if set). Changing the Google account password cancels the app password, so make a new one if that happens.

**Resend (later, with a domain)**

1. Create a Resend account and verify your sending domain.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (for example `RESIST <orders@resist.ph>`). Set `EMAIL_REPLY_TO` if replies should go to another inbox. The Gmail variables can then be removed.

Each order gets one email at most, whichever path marks it paid first (webhook, success page, or test payment). If sending fails, the next PayMongo webhook retry sends it. Without the env vars, emails are skipped and checkout still works.

## Layout

```
src/
  db/schema.ts               products, variants, orders, order_items, stock_movements
  lib/inventory.ts           reservations, payment → sale, stock adjustments (all the locking)
  lib/paymongo.ts            Checkout Session API + webhook signature check
  app/(shop)/                storefront: /, /products/[slug], /cart, /orders/[id], checkout routes
  app/api/webhooks/paymongo  webhook receiver
  app/admin/                 stock, orders, products, stock history
  proxy.ts                   Basic auth for /admin (admin actions re-check it)
tests/                       Vitest against real Postgres, incl. concurrent last-unit checkout
```

## Not in the MVP

Shipping rates by area (there's one flat fee for now), order fulfilment status, refunds (do them in the PayMongo dashboard), customer accounts, shipping/tracking emails (only the order confirmation is sent).
