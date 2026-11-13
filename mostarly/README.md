# Mostarly Guide website

Website for Mostarly Guide, a licensed local guide in Mostar. Built from the owner's brief (11 November 2026): editorial look, mobile first, inquiry-first booking, one page per tour.

## Run locally

```
node mostarly/dev.mjs
```

Open http://localhost:8090. No dependencies, only Node 18 or newer.

`node mostarly/build.mjs` writes the static site to `mostarly/dist/`.

## Content

| What | Where |
|---|---|
| Tours (one file each: price, duration, itinerary, inclusions, tickets, SEO) | `content/tours/*.json` |
| Contact, ticket prices, FAQ, About, "why a local guide", categories, services | `content/site.json` |
| Photos | `src/img/` |
| Design and behaviour | `src/site.css`, `src/site.js`, `build.mjs` |

Every tour page uses the same order: name and short explanation, price, facts, itinerary (fixed and optional stops), included / not included, optional tickets, practical notes, photos, reviews, enquiry form.

### Draft mode

`"draft": true` in `content/site.json`:

- shows yellow "For Mirna" notes with open questions from the brief, and "to confirm" labels on prices;
- hides the site from search engines.

Set it to `false` for launch. Prices that are not marked `"confirmed": true` then show as "Price on request".

### Prices

Each price has a type: `person`, `group` or `request`, plus `amount`, `from` (shows "from €…") and `confirmed`.

## Enquiries

The form never presents an enquiry as a confirmed booking. It offers two ways to send it:

1. **WhatsApp:** opens a chat with a pre-written message (tour, date, guests, children's ages, tickets, message).
2. **Email:** `POST /api/enquiry` (`functions/api/enquiry.js`, called from the Worker) sends it to the inbox through [Resend](https://resend.com). If the mail service is not configured, the visitor's email app opens with the message ready.

Variables on the Worker:

| Variable | Meaning |
|---|---|
| `RESEND_API_KEY` | API key from Resend |
| `MAIL_TO` | Inbox for enquiries (default mostarlyguide@gmail.com) |
| `MAIL_FROM` | Sender on a verified domain, e.g. `Mostarly Guide <enquiries@mostarlyguide.com>` |

Spam protection: a hidden honeypot field, and server-side validation.

## Analytics

Add the GA4 measurement ID to `analytics.ga4` in `content/site.json`. A cookie notice then appears and GA4 loads only after the visitor accepts. These events are sent:

- `enquiry_submit`, `enquiry_whatsapp`, `enquiry_mailto` (with the tour)
- `whatsapp_click`, `email_click`, `phone_click`

## Admin (Mirna edits without a developer)

`/admin` is Mirna's own admin, in Bosnian and made for a phone (light and dark theme, installable as an app):

- **Tours:** add, edit, hide, delete and reorder; name, texts, category, price (per person, per group or on request, "from", confirmed), details, itinerary with optional stops, included / not included, good to know, entrance tickets for the enquiry form, featured on the home page, Google title and description; the yellow notes can be marked as done.
- **Photos:** main photo and gallery per tour. Photos are made smaller in the browser (max 2000 px, WebP) before upload, stored in R2 and served at `/media/...`.
- **Reviews:** add, edit, hide, reorder; name, country, date, rating, title, text, source.
- **Planer:** every enquiry from the site (email and WhatsApp) is saved; Mirna adds the ones from Instagram, phone or walk-ins herself. Status (new, replied, confirmed, done, cancelled), calendar, day plan, reminders (tomorrow's tours, tours to mark as done, review requests) and messages from templates sent on WhatsApp, by email or copied for Instagram.
- **Više:** business overview (enquiries, tours, guests, money per month, sources, top tours), guests list with CSV export for Excel, message templates (EN/DE and more, with `{ime}`, `{tura}`, `{datum}`... filled in), busy days (the site's date picker does not offer them, `GET /api/blocked`), site texts (contact, about, why, services, FAQ, on request, ticket prices, category intros, the draft switch).
- **Calendar feed:** a private link `/cal/<token>.ics` with confirmed tours, for Google Calendar or the iPhone calendar. A new link can be made at any time (the old one stops working).
- **Phone notifications:** Web Push for every new enquiry and, every evening (cron in `wrangler.jsonc`, 17:00 UTC), for tomorrow's tours. The VAPID keys are created by the Worker and kept in D1, nothing to set up. On an iPhone it works when the admin is added to the home screen.

Every save is published at once: the Worker renders the whole site with the same code as the build (`src/render.mjs`) and stores the pages in D1. Until the first save, the site is served from the built files. The first time the admin opens, the tours from `content/tours/` are copied into the database; after that the database is the source for tours and reviews (the content files are still used for everything else).

How it is built: `worker.js` (routing), `server/auth.js` (sign-in check), `server/api.js` (admin API, photos), `server/store.js` (database, publishing, site texts), `server/extra.js` (templates, busy days, calendar feed, push), `src/admin/` (the admin page), `migrations/` (tables).

### Setup (once)

1. `cd mostarly`, `npx wrangler login`
2. `node scripts/cf-setup.mjs`: creates the D1 database and the R2 bucket, writes the database id into `wrangler.jsonc` and creates the tables. (R2 has to be enabled once in the dashboard: R2 > Enable.)
3. `node build.mjs && npx wrangler deploy`
4. **Sign-in with Cloudflare Access** (free up to 50 users): Zero Trust > Access > Applications > Add an application > Self-hosted.
   - Domain: the site's domain (or the workers.dev address), path `admin`; add a second destination with path `api/admin`.
   - Policy: Allow, Include: Emails, Mirna's email (and yours).
   - Login method: One-time PIN (a code is sent to the email; nothing else to set up).
   - After saving, copy the **Application Audience (AUD) Tag**.
5. In `wrangler.jsonc` set `vars`: `ACCESS_TEAM` (your team domain, here `mostarly.cloudflareaccess.com`), `ACCESS_AUD` (the AUD tag), `ADMIN_EMAILS` (optional: extra list of allowed emails, comma separated; empty = whoever the Access policy lets in). Deploy again.

The Worker checks the Access token itself as well, so the API stays closed even if Access were switched off by mistake. Without `ACCESS_TEAM` and `ACCESS_AUD` the admin is simply closed.

### Working on the admin locally

```
node build.mjs
npx wrangler d1 migrations apply mostarly --local
echo ADMIN_DEV=1 > .dev.vars
npx wrangler dev
```

Open http://localhost:8787/admin/ (ADMIN_DEV lets localhost in without Access; it never works on the real domain). `node dev.mjs` still serves the static site for quick design work, without the admin.

## Deploy on Cloudflare Workers

The site is a Worker with static assets: `worker.js` serves `dist/` and handles `POST /api/enquiry`; `wrangler.jsonc` holds the settings.

From a computer (once: `npx wrangler login` and `node scripts/cf-setup.mjs`, see Admin):

```
cd mostarly
node build.mjs
npx wrangler d1 migrations apply mostarly --remote   # only when migrations/ has a new file
npx wrangler deploy
```

Or connect the repository in the Cloudflare dashboard (Workers & Pages > Create > Import a repository):

| Setting | Value |
|---|---|
| Root directory | `mostarly` |
| Build command | `node build.mjs` |
| Deploy command | `npx wrangler deploy` |

Secrets for the email form (Worker > Settings > Variables and secrets): `RESEND_API_KEY` (secret), `MAIL_TO`, `MAIL_FROM`. Without them the form falls back to the visitor's email app. Set `SITE_URL` as a build variable if the domain differs from `url` in `site.json`.

## Payments (Monri)

`/pay/` is one payment link for every guest: the guest enters the amount Mirna confirmed (Mirna's message template "Link za plaćanje" fills in the deposit, tour and date), pays on Monri's secure page, and the payment appears in the planner with a phone notification. Code: `server/pay.js`, page in `src/render.mjs`, script in `src/site.js`.

Security: the merchant key stays on the server; the amount is signed on the server and checked again in Monri's callback; a payment counts only after a callback with a valid Monri signature (SHA-512 of merchant key + body); callbacks are idempotent; amount limits, attempt limits per visitor, honeypot and optional Cloudflare Turnstile; card details never touch this site; the page cannot be framed and its forms can only post to this site or Monri.

Going live, once Mirna's company has a Monri contract:

1. Fill in the company details and the deposit / cancellation rules in the admin (Više > Tekstovi sajta > Podaci firme i pravila).
2. Secrets from Monri: `npx wrangler secret put MONRI_MERCHANT_KEY` and `npx wrangler secret put MONRI_AUTHENTICITY_TOKEN`.
3. In Monri's portal set the callback URL to `https://<domain>/api/pay/callback`.
4. Check the form fields and the callback signature in `server/pay.js` against Monri's current documentation, then test with `"MONRI_ENV": "test"` and `"PAY_MODE": "live"` in `wrangler.jsonc` (Monri test cards), and finally `"MONRI_ENV": "prod"`.
5. Optional bot protection: `TURNSTILE_SITE_KEY` (variable) and `TURNSTILE_SECRET` (secret).

Locally, `PAY_MODE=test` in `.dev.vars` simulates Monri (no money). Never use test mode on the public site.

## Languages

English at launch. Planned: Bosnian, German, Spanish and Turkish. The content files are kept per field so translations can be added per language later.
