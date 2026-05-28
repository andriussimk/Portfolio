# Shot by Andrius Portfolio

Personal photography portfolio for Shot by Andrius.

The site is built with Vite and TypeScript, deployed on Cloudflare Pages, and uses Cloudflare Pages Functions for the API. Gallery metadata is stored in Cloudflare D1, while production images are served from Cloudflare R2.

## Stack

- Vite
- TypeScript
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1
- Cloudflare R2

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run build
npm audit
```

## Cloudflare Setup

Required bindings:

| Binding | Type | Notes |
| --- | --- | --- |
| `DB` | D1 | Portfolio database |
| `R2_PHOTO_GALLERIES` | R2 | Gallery image storage |

Required secret:

| Secret | Purpose |
| --- | --- |
| `ADMIN_TOKEN` | Bearer token for admin API access |

Optional:

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | Used when protecting the admin panel with Cloudflare Access |

Apply the database schema:

```bash
npx wrangler d1 execute portfolio-db --remote --file=./db/schema.sql
```

Deploy:

```bash
npm run build
npx wrangler pages deploy dist
```

## Image Storage

Production galleries come from R2 through the `/api/image/...` endpoint.

R2 layout:

```text
<galleryId>/
  <filename>
  thumbs/
    <filename>.jpg
```

Local photo exports should stay outside Git. A local `photo-collections/` folder can exist for backups or manual work, but it is ignored and is not part of the public repository.

## Admin Panel

The admin UI is available at:

```text
/adminPanel/
```

It supports gallery management, uploads, thumbnails, private links, ZIP generation, page content, contacts, and basic collection analytics.

For production, use Cloudflare Access in front of the admin panel when possible. `ADMIN_TOKEN` is still required by the API.

## Project Layout

```text
src/                 Frontend code and styles
functions/api/       Cloudflare Pages Functions API
db/                  D1 schema
public/              Static assets and fonts
```

## License

© 2026 Andrius Simkus. All rights reserved.
