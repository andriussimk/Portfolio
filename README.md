# Modern Photography Portfolio

A minimalist, modern photography portfolio built with Vite, TypeScript, and Cloudflare Pages. Features a content management system for galleries, R2 storage for images, and D1 database for metadata.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview build
npm run serve
```

## 📁 Project Structure

```
Portfolio/
├── index.html              # Homepage with hero section
├── about.html              # About page (fixed "Andrius Šimkus" header)
├── contacts.html           # Contact information
├── galleries.html          # Gallery collections overview
├── collection.html         # Individual collection viewer
├── adminPanel.html         # Admin CMS (hidden route)
├── src/
│   ├── main.ts            # Entry point
│   ├── main.js            # Frontend logic & API integration
│   ├── admin-panel.ts     # Admin CMS functionality
│   ├── pages/             # Page-specific modules
│   ├── components/        # Navbar, footer, lightbox, etc.
│   ├── styles/
│   │   ├── base.css       # Theme system, typography
│   │   └── layout.css     # Component layouts
│   ├── data/              # Static JSON fallbacks
│   └── utils/             # Helper functions
├── functions/
│   └── api/
│       └── [[path]].ts    # Cloudflare Pages Functions API
├── db/
│   └── schema.sql         # D1 database schema
├── public/
│   ├── fonts/             # Cabinet Grotesk, Satoshi
│   └── images/            # Local image fallbacks
└── photo-collections/     # Legacy local photos
```

## 🎨 Design System

**Typography:**
- Headers: Cabinet Grotesk Extrabold (800)
- Body: Satoshi Medium (500)

**Color Palette:**
- Light theme: Warm cream (#f6f0e8) with chocolate accents
- Dark theme: Creamy brown (#241c17) with golden accents
- Header hover: Inverts to opposite theme colors

## ☁️ Cloudflare Setup

### 1. D1 Database

Create database and apply schema:
```bash
# Create database
npx wrangler d1 create portfolio-db

# Apply schema
npx wrangler d1 execute portfolio-db --remote --file=./db/schema.sql
```

**Export/backup:**
```bash
npx wrangler d1 export portfolio-db --remote --output=backup.sql
```

### 2. R2 Bucket

Create bucket for photo storage:
```bash
npx wrangler r2 bucket create photo-galleries
```

**Image structure:**
```
photo-galleries/
├── <galleryId>/
│   ├── <filename>              # Original photos
│   └── thumbs/
│       └── <filename>.jpg      # JPEG thumbnails
```

### 3. Pages Project Bindings

Configure in Cloudflare Pages dashboard (Settings → Functions):

| Binding Name | Type | Resource |
|--------------|------|----------|
| `DB` | D1 | `portfolio-db` |
| `R2_PHOTO_GALLERIES` | R2 | `photo-galleries` |

**Environment Variables:**
- `ADMIN_TOKEN` - Admin authentication token (use Cloudflare Access and/or set secret)

### 4. Deployment

**Via Cloudflare Pages Dashboard:**
1. Connect GitHub repository
2. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
3. Enable "Single Page App" mode in settings
4. Deploy

**Via Wrangler:**
```bash
npx wrangler pages deploy dist
```

## 🔐 Admin Panel

Access at `/adminPanel/` (not publicly linked)

**Features:**
- Create/edit/delete galleries
- Upload photos with automatic thumbnail generation
- Manage visibility and sort order
- Edit About page content (rich text editor)
- Update contact information
- Toggle ZIP download per gallery
- View collection analytics

**Authentication:**
- Protected by `ADMIN_TOKEN` (Bearer token in API)
- Recommended: Use Cloudflare Access for production

## 🖼️ Image Pipeline

**Public API:**
- `GET /api/galleries` - List visible galleries
- `GET /api/galleries/:id` - Gallery with photos
- `GET /api/image/:galleryId/:filename` - Proxied image from R2
- `GET /api/pages/about` - About page content
- `GET /api/contacts` - Contact information

**Admin API (requires auth):**
- Gallery CRUD: `POST/PATCH/DELETE /api/admin/gallery`
- Photo upload: `POST /api/admin/gallery/:id/photos` (multipart)
- Photo delete: `DELETE /api/admin/gallery/:id/photos/:filename`
- Pages/contacts: `POST /api/admin/pages`, `POST /api/admin/contacts`

## 📊 Database Schema

**Tables:**
- `galleries` - Gallery metadata (id, title, visible, zip_enabled, sort_order)
- `photos` - Photo records (gallery_id, filename, object_key, thumb_object_key, sort_order)
- `site_pages` - Editable pages (slug, content)
- `site_contacts` - Contact info (email, phone, socials)
- `collection_views` - Analytics (gallery_id, views, last_viewed)

See `db/schema.sql` for full schema.

## 🛠️ Development

**Local with Wrangler:**
```bash
npx wrangler pages dev dist --d1=DB=portfolio-db --r2=R2_PHOTO_GALLERIES=photo-galleries
```

**Environment files:**
- `wrangler.toml` - Cloudflare configuration
- `vite.config.ts` - Vite build settings
- `tsconfig.json` - TypeScript configuration

## 🎯 Features

✅ Responsive design (mobile-optimized)  
✅ Theme toggle (light/dark with warm palette)  
✅ Interactive header (hover inverts colors)  
✅ Lightbox with zoom/pan/download  
✅ Lazy loading with blur-up placeholders  
✅ ZIP download per collection  
✅ Admin CMS with rich text editor  
✅ R2 image storage with CDN delivery  
✅ D1 database for metadata  
✅ Collection view analytics  

## 📝 Notes

- **Auth**: Admin panel requires Bearer token or Cloudflare Access
- **Fonts**: Self-hosted in `/public/fonts/` (WOFF2 format)
- **Legacy**: `/photo-collections/` and `/public/images/` are fallbacks during R2 migration

## 📄 License

© 2026 Andrius Šimkus. All rights reserved.

This is a private portfolio project. Unauthorized copying, modification, or distribution is prohibited.

---

**Shot by Andrius** - Professional Photography Portfolio