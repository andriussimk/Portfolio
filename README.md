# Modern Photo Portfolio – Cloudflare Pages/R2 Plan

## Phase 1: Vite + Pages
- `vite.config.ts` uses `base: '/'` and `build.outDir = 'dist'` for Cloudflare Pages.
- Entry: `/src/main.ts` (imports `main.js`), CSS from `/src/styles/...`.
- Build: `npm run build` → `dist/`.
- Enable SPA fallback in Cloudflare Pages settings.

## Phase 2: Cloudflare setup
- `wrangler.toml` added with Pages build output and R2 binding scaffold (`R2_PHOTO_GALLERIES`).
- Functions live under `/functions`; `functions/api/[[path]].ts` provides stub REST API matching requirements.
- Bindings/env (set in dashboard or wrangler secrets):
   - `ADMIN_TOKEN` or `ADMIN_EMAIL` (for Access) for admin auth.
   - `R2_PHOTO_GALLERIES` bucket (photo-galleries).
   - `DB` (D1) for metadata.

## D1 schema (required)
Before using the admin panel, create the D1 tables from `db/schema.sql` in your D1 database.

If you're using the thumbnail pipeline (admin generates JPEG thumbnails for faster previews), also apply:
- `db/2025-12-18_add_photo_thumbnails.sql`

### Bindings (Pages project → Settings)
- D1 binding name: `DB` → your D1 database (e.g. `portfolio-db`)
- R2 binding name: `R2_PHOTO_GALLERIES` → your R2 bucket (e.g. `photo-galleries`)
- Secret/env var: `ADMIN_TOKEN` → your admin token

## Images (private R2 via API)
R2 objects are stored under:
- `<galleryId>/<filename>`

Thumbnails (JPEG) are stored under:
- `<galleryId>/thumbs/<originalFilename>.jpg`

Frontend and admin reference images through the Worker proxy:
- `GET /api/image/<galleryId>/<filename>`

## API scaffold (Worker)
- Public:
   - `GET /api/galleries` → visible galleries.
   - `GET /api/galleries/:id` → gallery with photos.
- Admin (require Bearer token or Access email):
   - `POST /api/admin/gallery`
   - `PATCH /api/admin/gallery/:id`
   - `DELETE /api/admin/gallery/:id`
   - `GET /api/admin/galleries`
   - `GET /api/admin/gallery/:id/photos`
   - `POST /api/admin/gallery/:id/photos` (multipart upload)
   - `DELETE /api/admin/gallery/:id/photos/:filename`

## Admin panel
- Hidden route: `/adminPanel/` (not linked publicly).
- Basic UI: create gallery, toggle visibility, delete. Calls the Worker API.
- Auth: expects Worker to enforce (Access or Bearer token).

## Frontend data flow
- Frontend now fetches galleries from `/api/galleries` and renders visible ones.
- Collections fetch `/api/galleries/:id` for photos.
- Temporary local images resolve under `/images/...` until migrated to R2.

## Deployment (Cloudflare Pages)
- Repo should be pushed to GitHub; Pages preset: Vite.
- Build command: `npm run build`; Output: `dist`.
- SPA fallback: enable "Single Page App" in Pages settings.
- If this project lives inside a subfolder (e.g. `vs code portfolio/modern-photo-portfolio`), set **Root directory** in Pages to that exact subpath (with spaces) so `package.json` is found.

## R2 migration plan (next steps)
1) Move photos into R2 bucket `photo-galleries` under `galleries/<slug>/file`.
2) Store gallery metadata in D1 or JSON in R2 (schema in requirements).
3) Update Worker to:
    - List galleries from D1/JSON.
    - Generate signed URLs for R2 objects (`GET /api/image/:gallery/:file`).
    - Handle uploads/delete via admin endpoints and R2 SDK.
4) Remove `/public/images` from repo once R2 is live.

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Preview (Pages): `npm run serve`

## Notes
- Auth must be enforced at Worker (Access preferred). Frontend auth alone is not sufficient.
- Replace sample data in `functions/api/[[path]].ts` with real storage before production.
# Modern Photography Portfolio

This project is a minimalist and modern photography portfolio/gallery website designed to showcase photography collections. It includes various pages such as an About page, a Contacts page, and a Galleries page, along with individual collection pages for detailed viewing.

## Project Structure

```
modern-photo-portfolio
├── index.html          # Main entry point of the website
├── about.html          # About page detailing the photographer's work
├── contacts.html       # Contact information and social media links
├── galleries.html      # Displays photography gallery collections
├── collection.html     # Showcases a specific photography collection
├── src
│   ├── main.ts         # Initializes the application and handles routing
│   ├── pages
│   │   ├── about.ts    # Renders the About page content
│   │   ├── contacts.ts  # Renders the Contacts page content
│   │   ├── galleries.ts  # Renders the Galleries page
│   │   └── collection.ts # Renders a specific collection page
│   ├── components
│   │   ├── navbar.ts    # Navbar component for navigation
│   │   ├── footer.ts     # Footer component with copyright info
│   │   ├── gallery-grid.ts # Displays photos in a grid layout
│   │   └── lightbox.ts   # Handles full-resolution image display
│   ├── styles
│   │   ├── base.css      # Base styles for typography and layout
│   │   ├── layout.css     # Overall layout styles
│   │   └── components
│   │       ├── navbar.css  # Styles for the Navbar component
│   │       ├── grid.css    # Styles for the photo grid layout
│   │       └── lightbox.css # Styles for the Lightbox component
│   ├── data
│   │   ├── galleries.json  # Data for photography gallery collections
│   │   └── contacts.json   # Contact information
│   └── utils
│       ├── dom.ts         # Utility functions for DOM manipulation
│       └── types.ts       # TypeScript types and interfaces
├── public
│   └── images
│       ├── collections
│       │   └── .gitkeep   # Placeholder for collections directory
│       └── thumbnails
│           └── .gitkeep   # Placeholder for thumbnails directory
├── package.json           # npm configuration file
├── tsconfig.json          # TypeScript configuration file
├── vite.config.ts         # Vite configuration file
└── README.md              # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd modern-photo-portfolio
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and go to `http://localhost:3000` to view the website.

## Features

- Minimalist design focused on showcasing photography.
- Responsive layout for optimal viewing on various devices.
- Lightbox feature for viewing full-resolution images.
- Easy navigation between different pages and collections.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.