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

## Admin (owner edits without a developer)

`/admin` runs [Decap CMS](https://decapcms.org). The owner edits tours, prices, photos, FAQ and texts in the browser; each save is committed to the repository and Cloudflare rebuilds the site.

Setup:

1. Set `repo` and `branch` in `admin/config.yml` to the repository the site deploys from.
2. Deploy a GitHub OAuth proxy on Cloudflare Workers (for example `sveltia-cms-auth` or `decap-proxy`) and put its address in `base_url`.
3. Give the owner's GitHub account write access to the repository.

## Deploy on Cloudflare Workers

The site is a Worker with static assets: `worker.js` serves `dist/` and handles `POST /api/enquiry`; `wrangler.jsonc` holds the settings.

From a computer (once: `npx wrangler login`):

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
