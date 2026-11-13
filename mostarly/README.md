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

`/admin` is Mirna's own admin, in Bosnian and made for a phone. Phase 1:

- **Tours:** add, edit, hide, delete and reorder; name, texts, category, price (per person, per group or on request, "from", confirmed), details, itinerary with optional stops, included / not included, good to know, entrance tickets for the enquiry form, featured on the home page, Google title and description; the yellow notes can be marked as done.
- **Photos:** main photo and gallery per tour. Photos are made smaller in the browser (max 2000 px, WebP) before upload, stored in R2 and served at `/media/...`.
- **Reviews:** add, edit, hide, reorder; name, country, date, rating, title, text, source.

Every save is published at once: the Worker renders the whole site with the same code as the build (`src/render.mjs`) and stores the pages in D1. Until the first save, the site is served from the built files. The first time the admin opens, the tours from `content/tours/` are copied into the database; after that the database is the source for tours and reviews (the content files are still used for everything else).

How it is built: `worker.js` (routing), `server/auth.js` (sign-in check), `server/api.js` (admin API, photos), `server/store.js` (database, publishing), `src/admin/` (the admin page), `migrations/` (tables).

### Setup (once)

1. `cd mostarly`, `npx wrangler login`
2. `node scripts/cf-setup.mjs`: creates the D1 database and the R2 bucket, writes the database id into `wrangler.jsonc` and creates the tables. (R2 has to be enabled once in the dashboard: R2 > Enable.)
3. `node build.mjs && npx wrangler deploy`
4. **Sign-in with Cloudflare Access** (free up to 50 users): Zero Trust > Access > Applications > Add an application > Self-hosted.
   - Domain: the site's domain (or the workers.dev address), path `admin`; add a second destination with path `api/admin`.
   - Policy: Allow, Include: Emails, Mirna's email (and yours).
   - Login method: One-time PIN (a code is sent to the email; nothing else to set up).
   - After saving, copy the **Application Audience (AUD) Tag**.
5. In `wrangler.jsonc` set `vars`: `ACCESS_TEAM` (your team domain, e.g. `mostarly.cloudflareaccess.com`, from Zero Trust > Settings > Custom pages), `ACCESS_AUD` (the AUD tag), `ADMIN_EMAILS` (allowed emails, comma separated). Deploy again.

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
npx wrangler deploy
```

Or connect the repository in the Cloudflare dashboard (Workers & Pages > Create > Import a repository):

| Setting | Value |
|---|---|
| Root directory | `mostarly` |
| Build command | `node build.mjs` |
| Deploy command | `npx wrangler deploy` |

Secrets for the email form (Worker > Settings > Variables and secrets): `RESEND_API_KEY` (secret), `MAIL_TO`, `MAIL_FROM`. Without them the form falls back to the visitor's email app. Set `SITE_URL` as a build variable if the domain differs from `url` in `site.json`.

## Languages

English at launch. Planned: Bosnian, German, Spanish and Turkish. The content files are kept per field so translations can be added per language later.
