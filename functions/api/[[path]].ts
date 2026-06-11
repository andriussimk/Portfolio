// Define Env locally to avoid missing module error
type D1Database = any;
type R2Bucket = any;

interface Env {
  ADMIN_TOKEN?: string;
  ADMIN_EMAIL?: string;

  DB: D1Database;
  R2_PHOTO_GALLERIES: R2Bucket;
}

type GalleryRow = {
  id: string;
  title: string;
  visible: number;
  zip_enabled?: number;
  sort_order?: number;
  is_private?: number;
  private_token?: string | null;
  created_at: string;
};

type PhotoRow = {
  id: number;
  gallery_id: string;
  filename: string;
  object_key: string;
  thumb_object_key?: string;
  sort_order: number;
  created_at: string;
};

type PageRow = { slug: string; content: string; updated_at: string };
type ContactsRow = {
  id: number;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  updated_at: string;
};
type SiteAssetRow = { key: string; object_key: string; alt: string | null; updated_at: string };

async function ensureSortOrderColumn(env: Env) {
  try {
    await env.DB.prepare('ALTER TABLE galleries ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0').run();
  } catch (err: any) {
    // Ignore if exists
  }
  // Backfill any null/zero sort_order to a stable sequence
  const res = await env.DB.prepare('SELECT id FROM galleries ORDER BY datetime(created_at) ASC').all();
  const rows = (((res as any).results || []) as any[]).map((r: any) => String(r.id));
  for (let i = 0; i < rows.length; i++) {
    await env.DB.prepare('UPDATE galleries SET sort_order = ? WHERE id = ?').bind(i + 1, rows[i]).run();
  }
}

async function ensurePrivacyColumns(env: Env) {
  try {
    await env.DB.prepare('ALTER TABLE galleries ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0').run();
  } catch (err: any) {
    // ignore if exists
  }

  try {
    await env.DB.prepare('ALTER TABLE galleries ADD COLUMN private_token TEXT').run();
  } catch (err: any) {
    // ignore if exists
  }
}

async function ensureSiteAssetsTable(env: Env) {
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS site_assets (key TEXT PRIMARY KEY, object_key TEXT NOT NULL, alt TEXT, updated_at TEXT NOT NULL)'
  ).run();
}

// --- Minimal ZIP builder (store method only) -------------------------------
// Cloudflare Workers don't provide Node.js zlib/streams; to keep this portable
// we generate a simple ZIP using the "store" method (no compression).
// Note: this increases download size, but is reliable and fast to generate.

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32Init() {
  return 0xffffffff;
}

function crc32Update(crc: number, bytes: Uint8Array) {
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return crc;
}

function crc32Finalize(crc: number) {
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(new ArrayBuffer(2));
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(new ArrayBuffer(4));
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concatBytes(parts: Array<Uint8Array>): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.byteLength;
  const out = new Uint8Array(new ArrayBuffer(len));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

function toZipDateTime(d: Date) {
  // ZIP stores local time in MS-DOS format.
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = Math.floor(d.getSeconds() / 2);
  const dosDate = ((Math.max(year, 1980) - 1980) << 9) | (month << 5) | day;
  const dosTime = (hour << 11) | (minute << 5) | second;
  return { dosDate, dosTime };
}

type ZipFileInput = {
  name: string;
  data: Uint8Array;
  mtime?: Date;
};

function buildZip(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const size = data.byteLength;
    const { dosDate, dosTime } = toZipDateTime(f.mtime || new Date());

    // Local file header
    const localHeader = concatBytes([
      u32(0x04034b50), // signature
      u16(20), // version needed
      u16(0x0800), // flags: UTF-8 filenames
      u16(0), // compression method: 0=store
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.byteLength),
      u16(0), // extra length
      nameBytes,
    ]);
    localParts.push(localHeader, data);

    // Central directory header
    const centralHeader = concatBytes([
      u32(0x02014b50), // signature
      u16(20), // version made by
      u16(20), // version needed
      u16(0x0800), // flags: UTF-8 filenames
      u16(0), // compression
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.byteLength),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk start
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset), // relative offset of local header
      nameBytes,
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.byteLength + data.byteLength;
  }

  const centralDir = concatBytes(centralParts);
  const centralOffset = offset;
  const centralSize = centralDir.byteLength;

  const end = concatBytes([
    u32(0x06054b50), // end of central dir signature
    u16(0), // disk number
    u16(0), // central dir start disk
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(centralOffset),
    u16(0), // comment length
  ]);

  return concatBytes([...localParts, centralDir, end]);
}

const DYNAMIC_ZIP_MAX_BYTES = 50 * 1024 * 1024;
const DYNAMIC_ZIP_MAX_FILES = 40;
const IN_MEMORY_ZIP_MAX_BYTES = 20 * 1024 * 1024;

// Streaming ZIP generator (store method, data descriptor) to avoid buffering large galleries in memory.
type ZipStreamFile = { name: string; objectKey: string; mtime?: Date };

function estimateZipLength(files: Array<{ name: string; size: number }>) {
  // store + data descriptor layout: local header (30+name), data, dd (16), central (46+name), end (22)
  const encoder = new TextEncoder();
  let total = 22; // end of central directory
  for (const f of files) {
    const nameLen = encoder.encode(f.name).length;
    const local = 30 + nameLen;
    const dd = 16;
    const central = 46 + nameLen;
    total += local + f.size + dd + central;
  }
  return total;
}

async function uploadZipMultipart(
  env: Env,
  key: string,
  stream: ReadableStream,
  meta: { contentDisposition: string; contentLength?: number; customMetadata?: Record<string, string> }
) {
  const httpMetadata = { contentType: 'application/zip', contentDisposition: meta.contentDisposition };

  // Fallback: if multipart helpers are unavailable in this env/binding, push via a single PUT with an estimated length.
  const hasMultipart =
    typeof env.R2_PHOTO_GALLERIES.createMultipartUpload === 'function';

  if (!hasMultipart) {
    await env.R2_PHOTO_GALLERIES.put(key, stream, {
      httpMetadata,
      customMetadata: meta.customMetadata,
      ...(meta.contentLength ? { contentLength: meta.contentLength } : {}),
    });
    return;
  }

  const partSize = 16 * 1024 * 1024; // keep non-final R2 multipart parts uniform
  const upload = await env.R2_PHOTO_GALLERIES.createMultipartUpload(key, {
    httpMetadata,
    customMetadata: meta.customMetadata,
  });
  const parts: Array<{ partNumber: number; etag: string }> = [];
  const reader = stream.getReader();
  let buffers: Uint8Array[] = [];
  let buffered = 0;
  let partNumber = 1;

  const takeBuffered = (size: number) => {
    const combined = new Uint8Array(size);
    let offset = 0;
    while (offset < size && buffers.length) {
      const first = buffers[0];
      const needed = size - offset;
      const take = Math.min(needed, first.byteLength);
      combined.set(first.subarray(0, take), offset);
      offset += take;
      if (take === first.byteLength) {
        buffers.shift();
      } else {
        buffers[0] = first.subarray(take);
      }
      buffered -= take;
    }
    return combined;
  };

  const flushPart = async (size: number) => {
    if (!size) return;
    const combined = takeBuffered(size);
    const uploaded = await upload.uploadPart(partNumber, combined);
    parts.push({ partNumber, etag: uploaded.etag });
    partNumber += 1;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      if (!chunk.byteLength) continue;
      buffers.push(chunk);
      buffered += chunk.byteLength;
      while (buffered >= partSize) await flushPart(partSize);
    }
    await flushPart(buffered);
    await upload.complete(parts);
  } catch (err) {
    await upload.abort().catch(() => {});
    throw err;
  }
}

function buildZipStream(env: Env, files: ZipStreamFile[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let offset = 0;
      const centralParts: Uint8Array[] = [];

      for (const f of files) {
        const obj = await env.R2_PHOTO_GALLERIES.get(f.objectKey);
        if (!obj || !obj.body) continue;

        const nameBytes = encoder.encode(f.name);
        const { dosDate, dosTime } = toZipDateTime(f.mtime || new Date());
        const localHeader = concatBytes([
          u32(0x04034b50),
          u16(20),
          u16(0x08 | 0x0800), // data descriptor + UTF-8
          u16(0),
          u16(dosTime),
          u16(dosDate),
          u32(0), // crc placeholder
          u32(0), // comp size placeholder
          u32(0), // size placeholder
          u16(nameBytes.byteLength),
          u16(0),
          nameBytes,
        ]);
        controller.enqueue(localHeader);
        const localOffset = offset;
        offset += localHeader.byteLength;

        let crc = crc32Init();
        let size = 0;
        const reader = obj.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
          if (!chunk.byteLength) continue;
          crc = crc32Update(crc, chunk);
          size += chunk.byteLength;
          controller.enqueue(chunk);
          offset += chunk.byteLength;
        }
        const finalCrc = crc32Finalize(crc);
        const dd = concatBytes([
          u32(0x08074b50),
          u32(finalCrc),
          u32(size),
          u32(size),
        ]);
        controller.enqueue(dd);
        offset += dd.byteLength;

        const centralHeader = concatBytes([
          u32(0x02014b50),
          u16(20),
          u16(20),
          u16(0x08 | 0x0800),
          u16(0),
          u16(dosTime),
          u16(dosDate),
          u32(finalCrc),
          u32(size),
          u32(size),
          u16(nameBytes.byteLength),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          u16(0),
          u32(0),
          u32(localOffset),
          nameBytes,
        ]);
        centralParts.push(centralHeader);
      }

      const centralDir = concatBytes(centralParts);
      const centralOffset = offset;
      const centralSize = centralDir.byteLength;

      const end = concatBytes([
        u32(0x06054b50),
        u16(0),
        u16(0),
        u16(files.length),
        u16(files.length),
        u32(centralSize),
        u32(centralOffset),
        u16(0),
      ]);

      controller.enqueue(centralDir);
      controller.enqueue(end);
      controller.close();
    },
  });
}

function thumbKeyFor(galleryId: string, filename: string) {
  // Bucket layout for thumbnails: <galleryId>/thumbs/<basename>.jpg
  const base = safeFilename(filename);
  const stem = base.replace(/\.[^.]+$/, '');
  return `${galleryId}/thumbs/${stem}.jpg`;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const jsonNoCache = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

const text = (status: number, body: string, extraHeaders: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...extraHeaders },
  });

function objectKeyFor(galleryId: string, filename: string) {
  // Bucket layout: <galleryId>/<filename>
  // This matches the R2 “folders” the user already has (concerts/, events/, ...)
  return `${galleryId}/${filename}`;
}

function safeFilename(name: string) {
  // allow simple filenames; strip path separators
  return name.replace(/\\/g, '/').split('/').pop() || 'file';
}

function zipObjectKey(galleryId: string) {
  return `zips/${safeFilename(galleryId)}.zip`;
}

function safeDecodePathComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function imageUrlForPath(galleryId: string, filenameOrPath: string, token?: string | null) {
  const encodedGallery = encodeURIComponent(galleryId);
  const encodedPath = filenameOrPath
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : '';
  return `/api/image/${encodedGallery}/${encodedPath}${tokenSuffix}`;
}

function imageUrlForObjectKey(objectKey: string, token?: string | null) {
  const parts = objectKey.split('/').filter(Boolean);
  const galleryId = parts.shift() || '';
  return imageUrlForPath(galleryId, parts.join('/'), token);
}

const HOME_SHOWCASE_KEYS = Array.from({ length: 8 }, (_, i) => `home-showcase-${i + 1}`);
const SITE_ASSET_KEYS = ['home-hero', 'about-photo', ...HOME_SHOWCASE_KEYS];
const SITE_ASSET_KEY_SET = new Set(SITE_ASSET_KEYS);
const SITE_ASSET_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

function isAllowedSiteAssetKey(key: string) {
  return SITE_ASSET_KEY_SET.has(key);
}

function siteAssetUrl(key: string, updatedAt?: string | null) {
  const version = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : '';
  return `/api/site-assets/${encodeURIComponent(key)}${version}`;
}

function normalizeSiteAssetRow(row: SiteAssetRow | null, key: string, objectExists = true) {
  if (!row) return { key, url: siteAssetUrl(key), alt: '', updatedAt: null, exists: objectExists, missingObject: false };
  return {
    key: row.key,
    url: siteAssetUrl(row.key, row.updated_at),
    alt: row.alt || '',
    updatedAt: row.updated_at,
    exists: objectExists,
    missingObject: !objectExists,
  };
}

function siteAssetObjectCandidates(key: string, row: SiteAssetRow | null) {
  const candidates = [
    row?.object_key || '',
    ...SITE_ASSET_EXTENSIONS.map((ext) => `site/${key}.${ext}`),
    ...SITE_ASSET_EXTENSIONS.map((ext) => `${key}.${ext}`),
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

async function getSiteAssetObject(env: Env, key: string, row: SiteAssetRow | null) {
  for (const objectKey of siteAssetObjectCandidates(key, row)) {
    const obj = await env.R2_PHOTO_GALLERIES.get(objectKey).catch(() => null);
    if (obj) return obj;
  }
  return null;
}

async function siteAssetObjectExists(env: Env, key: string, row: SiteAssetRow | null) {
  for (const objectKey of siteAssetObjectCandidates(key, row)) {
    const obj = await env.R2_PHOTO_GALLERIES.head(objectKey).catch(() => null);
    if (obj) return true;
  }
  return false;
}

function extensionForUpload(file: File) {
  const type = String(file.type || '').toLowerCase();
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/avif') return 'avif';
  const safe = safeFilename(file.name || '');
  const ext = safe.includes('.') ? safe.split('.').pop()?.toLowerCase() : '';
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
}

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

function isAllowedUploadImage(file: File) {
  const type = (file.type || '').toLowerCase();
  if (!type) return false;
  // Explicitly block SVG (can contain scripts / active content).
  if (type === 'image/svg+xml') return false;
  return ALLOWED_IMAGE_MIME_TYPES.has(type);
}

async function ensureGalleryExists(env: Env, id: string) {
  const g = await env.DB.prepare('SELECT id, title, visible, zip_enabled, sort_order, is_private, private_token, created_at FROM galleries WHERE id = ?')
    .bind(id)
    .first();
  return g as GalleryRow | null;
}

function normalizeGalleryRow(g: any) {
  return {
    id: g.id,
    title: g.title,
    visible: g.visible === 1,
    zipEnabled: g.zip_enabled == null ? true : g.zip_enabled === 1,
    sortOrder: g.sort_order ?? 0,
    isPrivate: g.is_private === 1,
    privateToken: g.private_token || null,
    createdAt: g.created_at,
  };
}

function generateSecretToken(length = 18) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function hasPrivateAccess(g: any, token: string | null) {
  if (g.is_private !== 1) return false;
  if (!g.private_token) return false;
  return !!token && token === g.private_token;
}

function canAccessGallery(g: any, token: string | null) {
  const tokenOk = hasPrivateAccess(g, token);
  const publicVisible = g.visible === 1 && (g.is_private == null || g.is_private === 0);
  return publicVisible || tokenOk;
}

function isAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get('authorization');
  if (env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`) return true;
  // Cloudflare Access: rely on Access in front of Worker; if desired, check cf-access-verified-email
  if (env.ADMIN_EMAIL) {
    const email = (request as any).cf?.email || request.headers.get('cf-access-authenticated-user-email');
    if (email && email.toLowerCase() === env.ADMIN_EMAIL.toLowerCase()) return true;
  }
  return false;
}

export const onRequest = async ({ request, env }: { request: Request; env: Env }) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method.toUpperCase();
  await ensurePrivacyColumns(env).catch(() => {});
  await ensureSiteAssetsTable(env).catch(() => {});

  // Public: GET /image/:galleryId/:filename -> stream from R2
  const imageMatch = path.match(/^\/image\/([^/]+)\/(.+)$/);
  if (method === 'GET' && imageMatch) {
    const galleryId = safeFilename(safeDecodePathComponent(imageMatch[1]));
    const rawPath = safeDecodePathComponent(imageMatch[2]);
    const safePath = rawPath
      .split('/')
      .filter((p) => p)
      .map((segment) => safeFilename(segment))
      .join('/');
    const gallery = await ensureGalleryExists(env, galleryId).catch(() => null);
    if (gallery?.is_private === 1 && !hasPrivateAccess(gallery, url.searchParams.get('token'))) {
      return text(404, 'Not found');
    }
    const key = `${galleryId}/${safePath}`;
    const obj = await env.R2_PHOTO_GALLERIES.get(key);
    if (!obj) return text(404, 'Not found');
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    // Keep it cacheable, but short enough that new uploads become visible quickly.
    if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=300');
    return new Response(obj.body, { headers });
  }

  // Public: GET /site-assets/:key -> stream editable site-level image from R2
  const siteAssetImageMatch = path.match(/^\/site-assets\/([^/]+)$/);
  if (method === 'GET' && siteAssetImageMatch) {
    const key = safeFilename(safeDecodePathComponent(siteAssetImageMatch[1]));
    if (!isAllowedSiteAssetKey(key)) return text(404, 'Not found');
    const row = (await env.DB.prepare('SELECT key, object_key, alt, updated_at FROM site_assets WHERE key = ?')
      .bind(key)
      .first()) as SiteAssetRow | null;
    const obj = await getSiteAssetObject(env, key, row);
    if (!obj) return text(404, 'Not found');
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=300');
    return new Response(obj.body, { headers });
  }

  // Public: GET /site-assets -> editable site-level image metadata
  if (method === 'GET' && path === '/site-assets') {
    const assets: Record<string, ReturnType<typeof normalizeSiteAssetRow>> = {};
    for (const key of SITE_ASSET_KEYS) {
      const row = (await env.DB.prepare('SELECT key, object_key, alt, updated_at FROM site_assets WHERE key = ?')
        .bind(key)
        .first()) as SiteAssetRow | null;
      assets[key] = normalizeSiteAssetRow(row, key, await siteAssetObjectExists(env, key, row));
    }
    return json(200, { assets });
  }

  // Public: GET /galleries
  if (method === 'GET' && (path === '/' || path === '/galleries')) {
    const includeHidden = url.searchParams.get('all') === '1' && isAdmin(request, env);
    const stmt = includeHidden
      ? env.DB.prepare(
          'SELECT id, title, visible, zip_enabled, sort_order, is_private, private_token, created_at FROM galleries ORDER BY sort_order ASC, datetime(created_at) DESC'
        )
      : env.DB.prepare(
          'SELECT id, title, visible, zip_enabled, sort_order, is_private, private_token, created_at FROM galleries WHERE visible = 1 AND (is_private IS NULL OR is_private = 0) ORDER BY sort_order ASC, datetime(created_at) DESC'
        );

    const res = await stmt.all();
    const rows = ((res as any).results || []).filter((g: any) => g.is_private !== 1);
    const galleries = [];
    for (const g of rows) {
      const cover = (await env.DB.prepare(
        `SELECT filename, object_key, thumb_object_key
         FROM photos
         WHERE gallery_id = ?
         ORDER BY CASE WHEN filename = 'cover.jpg' THEN 0 ELSE 1 END, sort_order ASC, datetime(created_at) ASC
         LIMIT 1`
      )
        .bind(g.id)
        .first()) as { filename?: string; object_key?: string; thumb_object_key?: string } | null;
      galleries.push({
        id: g.id,
        title: g.title,
        visible: g.visible === 1,
        zipEnabled: g.zip_enabled == null ? true : g.zip_enabled === 1,
        sortOrder: g.sort_order ?? 0,
        createdAt: g.created_at,
        coverUrl: cover?.object_key ? imageUrlForObjectKey(String(cover.object_key)) : imageUrlForPath(String(g.id), 'cover.jpg'),
        coverThumbUrl: cover?.thumb_object_key ? imageUrlForObjectKey(String(cover.thumb_object_key)) : undefined,
      });
    }
    return json(200, { galleries });
  }

  // Public: GET /galleries/:id/download.zip
  const galleryZipMatch = path.match(/^\/galleries\/([^/]+)\/download\.zip\/?$/);
  if (method === 'GET' && galleryZipMatch) {
    const id = safeDecodePathComponent(galleryZipMatch[1]);
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return text(404, 'Not found');
    const token = url.searchParams.get('token');
    if (!canAccessGallery(gallery, token)) return text(404, 'Not found');
    const zipEnabled = gallery.zip_enabled == null ? true : gallery.zip_enabled === 1;
    if (!zipEnabled) return text(404, 'Not found');

    // Serve pre-generated ZIP from R2 if available.
    const zipKey = zipObjectKey(id);
    const existingZip = await env.R2_PHOTO_GALLERIES.get(zipKey);
    if (existingZip && existingZip.body) {
      return new Response(existingZip.body, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${safeFilename(id)}.zip"`,
          ...(existingZip.size ? { 'content-length': String(existingZip.size) } : {}),
          'cache-control': 'no-store',
        },
      });
    }

    const photosRes = await env.DB.prepare(
      'SELECT filename, object_key, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();

    const rows = (((photosRes as any).results || []) as any[])
      .map((r: any) => ({ filename: String(r.filename), object_key: String(r.object_key), created_at: String(r.created_at || '') }))
      .filter((r) => r.filename !== 'cover.jpg')
      .filter((r) => !r.filename.startsWith('thumbs/'));

    if (!rows.length) return text(404, 'No photos found');

    // Build a .zip containing original filenames. (No thumbs, no cover.) Streamed to reduce memory usage.
    // Decide strategy based on total size to avoid Worker memory limits.
    const headInfos = await Promise.all(
      rows.map(async (r) => {
        const meta = await env.R2_PHOTO_GALLERIES.head(r.object_key);
        return { row: r, size: meta?.size || 0 };
      })
    );
    const totalSize = headInfos.reduce((sum, h) => sum + (h.size || 0), 0);
    const useInMemory = totalSize > 0 && totalSize <= IN_MEMORY_ZIP_MAX_BYTES;

    if (totalSize > DYNAMIC_ZIP_MAX_BYTES || rows.length > DYNAMIC_ZIP_MAX_FILES) {
      return text(
        409,
        'ZIP is too large to generate during download. Generate it from the admin panel first.',
        { 'cache-control': 'no-store' }
      );
    }

    const slug = safeFilename(id);
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const downloadName = `${slug || id}-${y}${m}${d}.zip`;

    if (useInMemory) {
      const zipInputs: ZipFileInput[] = [];
      for (const { row } of headInfos) {
        const obj = await env.R2_PHOTO_GALLERIES.get(row.object_key);
        if (!obj || !obj.body) continue;
        const buf = await obj.arrayBuffer();
        zipInputs.push({
          name: safeFilename(row.filename),
          data: new Uint8Array(buf),
          mtime: row.created_at ? new Date(row.created_at) : undefined,
        });
      }
      if (!zipInputs.length) return text(404, 'No photos found');
      const zipBytes = buildZip(zipInputs);
      const body = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${downloadName}"`,
          'cache-control': 'no-store',
        },
      });
    }

    // Stream ZIP for larger galleries to stay under Worker limits.
    const zipStreamInputs: ZipStreamFile[] = [];
    for (const r of rows) {
      zipStreamInputs.push({
        name: safeFilename(r.filename),
        objectKey: r.object_key,
        mtime: r.created_at ? new Date(r.created_at) : undefined,
      });
    }
    if (!zipStreamInputs.length) return text(404, 'No photos found');

    const zipStream = buildZipStream(env, zipStreamInputs);
    return new Response(zipStream, {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${downloadName}"`,
        'cache-control': 'no-store',
      },
    });
  }

  // Public: POST /galleries/:id/download-selected.zip { filenames, token }
  const selectedZipMatch = path.match(/^\/galleries\/([^/]+)\/download-selected\.zip\/?$/);
  if (method === 'POST' && selectedZipMatch) {
    const id = safeDecodePathComponent(selectedZipMatch[1]);
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return text(404, 'Not found');
    const body = await request.json().catch(() => ({} as any));
    const token = body.token ? String(body.token) : url.searchParams.get('token');
    if (!canAccessGallery(gallery, token)) return text(404, 'Not found');
    const filenames = Array.isArray(body.filenames)
      ? body.filenames.map((x: any) => safeFilename(String(x))).filter(Boolean).slice(0, 80)
      : [];
    if (!filenames.length) return text(400, 'No photos selected');

    const selected = new Set(filenames);
    const photosRes = await env.DB.prepare(
      'SELECT filename, object_key, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();
    const rows = (((photosRes as any).results || []) as any[])
      .map((r: any) => ({ filename: String(r.filename), object_key: String(r.object_key), created_at: String(r.created_at || '') }))
      .filter((r) => r.filename !== 'cover.jpg')
      .filter((r) => !r.filename.startsWith('thumbs/'))
      .filter((r) => selected.has(safeFilename(r.filename)));

    if (!rows.length) return text(404, 'No selected photos found');

    const headInfos = await Promise.all(
      rows.map(async (r) => {
        const meta = await env.R2_PHOTO_GALLERIES.head(r.object_key);
        return { row: r, size: meta?.size || 0 };
      })
    );
    const totalSize = headInfos.reduce((sum, h) => sum + (h.size || 0), 0);
    const slug = safeFilename(id);
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const downloadName = `${slug || id}-selected-${y}${m}${d}.zip`;

    if (totalSize > DYNAMIC_ZIP_MAX_BYTES || rows.length > DYNAMIC_ZIP_MAX_FILES) {
      return text(
        413,
        'Selected ZIP is too large. Select fewer photos or use Download all after generating the ZIP from admin.',
        { 'cache-control': 'no-store' }
      );
    }

    if (totalSize > 0 && totalSize <= IN_MEMORY_ZIP_MAX_BYTES) {
      const zipInputs: ZipFileInput[] = [];
      for (const { row } of headInfos) {
        const obj = await env.R2_PHOTO_GALLERIES.get(row.object_key);
        if (!obj || !obj.body) continue;
        const buf = await obj.arrayBuffer();
        zipInputs.push({
          name: safeFilename(row.filename),
          data: new Uint8Array(buf),
          mtime: row.created_at ? new Date(row.created_at) : undefined,
        });
      }
      if (!zipInputs.length) return text(404, 'No selected photos found');
      const zipBytes = buildZip(zipInputs);
      return new Response(new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' }), {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${downloadName}"`,
          'cache-control': 'no-store',
        },
      });
    }

    const zipStreamInputs: ZipStreamFile[] = [];
    for (const { row } of headInfos) {
      zipStreamInputs.push({
        name: safeFilename(row.filename),
        objectKey: row.object_key,
        mtime: row.created_at ? new Date(row.created_at) : undefined,
      });
    }
    if (!zipStreamInputs.length) return text(404, 'No selected photos found');

    return new Response(buildZipStream(env, zipStreamInputs), {
      status: 200,
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${downloadName}"`,
        'cache-control': 'no-store',
      },
    });
  }

  // Public: GET /galleries/:id/download-info
  const downloadInfoMatch = path.match(/^\/galleries\/([^/]+)\/download-info\/?$/);
  if (method === 'GET' && downloadInfoMatch) {
    const id = safeDecodePathComponent(downloadInfoMatch[1]);
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return json(404, { error: 'Not found' });
    const token = url.searchParams.get('token');
    if (!canAccessGallery(gallery, token)) return json(404, { error: 'Not found' });

    const zipEnabled = gallery.zip_enabled == null ? true : gallery.zip_enabled === 1;
    const countRow = (await env.DB.prepare(
      `SELECT COUNT(*) as count
       FROM photos
       WHERE gallery_id = ?
         AND filename != 'cover.jpg'
         AND filename NOT LIKE 'thumbs/%'`
    )
      .bind(id)
      .first()) as { count?: number } | null;

    const zipKey = zipObjectKey(id);
    const zipMeta = zipEnabled ? await env.R2_PHOTO_GALLERIES.head(zipKey).catch(() => null) : null;
    const fileCount = Number(countRow?.count || 0);
    const dynamicAllowed = zipEnabled && !zipMeta && fileCount > 0 && fileCount <= DYNAMIC_ZIP_MAX_FILES;

    return json(200, {
      zipEnabled,
      fileCount,
      zipReady: !!zipMeta,
      zipSize: zipMeta?.size || null,
      zipGeneratedAt: zipMeta?.customMetadata?.generatedAt || zipMeta?.uploaded || null,
      downloadAllMode: !zipEnabled
        ? 'disabled'
        : zipMeta
          ? 'prepared'
          : dynamicAllowed
            ? 'on-demand'
            : 'prepare-required',
      maxOnDemandFiles: DYNAMIC_ZIP_MAX_FILES,
      maxOnDemandBytes: DYNAMIC_ZIP_MAX_BYTES,
      downloadUrl: `/api/galleries/${encodeURIComponent(id)}/download.zip${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    });
  }

  // Public: GET /galleries/:id
  const galleryMatch = path.match(/^\/galleries\/(.+)$/);
  if (method === 'GET' && galleryMatch) {
    const id = galleryMatch[1];
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return json(404, { error: 'Not found' });
    const token = url.searchParams.get('token');
    if (!canAccessGallery(gallery, token)) return json(404, { error: 'Not found' });
    const imageToken = gallery.is_private === 1 ? token : null;

    const photosRes = await env.DB.prepare(
      'SELECT id, gallery_id, filename, object_key, thumb_object_key, sort_order, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();
    const photos = (((photosRes as any).results || []) as any[]).map((p: any) => {
      const fallbackThumbKey =
        p.filename && p.filename !== 'cover.jpg'
          ? `${id}/thumbs/${String(p.filename).replace(/\.[^.]+$/, '')}.jpg`
          : '';
      const thumbKey = p.thumb_object_key || fallbackThumbKey;
      return {
        filename: p.filename,
        order: p.sort_order,
        url: imageUrlForPath(id, String(p.filename), imageToken),
        thumbUrl: thumbKey ? imageUrlForObjectKey(String(thumbKey), imageToken) : undefined,
      };
    });

    // If a cover.jpg object isn't present, fall back to first non-cover photo.
    const coverPhoto = photos.find((p) => p.filename === 'cover.jpg') || photos.find((p) => p.filename !== 'cover.jpg');

    return json(200, {
      gallery: {
        id: gallery.id,
        title: gallery.title,
        visible: gallery.visible === 1,
        isPrivate: gallery.is_private === 1,
        zipEnabled: gallery.zip_enabled == null ? true : gallery.zip_enabled === 1,
        createdAt: gallery.created_at,
        coverUrl: coverPhoto ? coverPhoto.url : `/api/image/${id}/cover.jpg`,
        coverThumbUrl: coverPhoto?.thumbUrl,
        photos,
      },
    });
  }

  // Public: GET /pages/:slug (about, etc.)
  const pageMatch = path.match(/^\/pages\/([^/]+)$/);
  if (method === 'GET' && pageMatch) {
    const slug = pageMatch[1];
    const row = (await env.DB.prepare('SELECT slug, content, updated_at FROM site_pages WHERE slug = ?').bind(slug).first()) as PageRow | null;
    if (!row) return json(200, { content: null });
    return json(200, { content: row.content, updatedAt: row.updated_at });
  }

  // Public: GET /contacts
  if (method === 'GET' && path === '/contacts') {
    const row = (await env.DB.prepare('SELECT id, email, phone, instagram, facebook, updated_at FROM site_contacts WHERE id = 1').first()) as ContactsRow | null;
    return json(200, {
      contacts: row || null,
    });
  }

  // Public: POST /analytics/collection-view { id }
  if (method === 'POST' && path === '/analytics/collection-view') {
    const body = await request.json().catch(() => ({} as any));
    const id = String(body.id || body.galleryId || '').trim();
    const token = body.token ? String(body.token) : null;
    if (!id) return json(400, { error: 'id required' });
    const exists = await ensureGalleryExists(env, id);
    if (!exists) return json(404, { error: 'Not found' });
  if (!canAccessGallery(exists, token)) return json(404, { error: 'Not found' });

    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO collection_views (gallery_id, views, last_viewed) VALUES (?, 1, ?) ON CONFLICT(gallery_id) DO UPDATE SET views = collection_views.views + 1, last_viewed = excluded.last_viewed'
    )
      .bind(id, now)
      .run();
    return json(200, { ok: true });
  }

  // Admin-only routes
  if (!isAdmin(request, env)) return jsonNoCache(401, { error: 'Unauthorized' });

  // Admin: list galleries (includes hidden)
  if (method === 'GET' && path === '/admin/galleries') {
    const res = await env.DB.prepare('SELECT id, title, visible, zip_enabled, sort_order, is_private, private_token, created_at FROM galleries ORDER BY sort_order ASC, datetime(created_at) DESC').all();
    const galleries = (((res as any).results || []) as any[]).map(normalizeGalleryRow);
    return json(200, { galleries });
  }

  // Admin: reorder galleries
  if (method === 'PUT' && path === '/admin/galleries/order') {
    const body = await request.json().catch(() => ({}));
    const order: string[] = Array.isArray(body.order)
      ? body.order.map((x: any) => safeDecodePathComponent(String(x)))
      : [];
    if (!order.length) return json(400, { error: 'order array required' });

    // Ensure sort_order column exists and backfill missing values if needed.
    await ensureSortOrderColumn(env).catch(() => {});

    let updated = 0;
    for (let i = 0; i < order.length; i++) {
      const gid = order[i];
      const res = await env.DB.prepare('UPDATE galleries SET sort_order = ? WHERE id = ?').bind(i + 1, gid).run();
      if ((res as any).success || (res as any).changes) updated++;
    }

    return json(200, { ok: true, updated });
  }

  // Admin: upsert page content
  const adminPageMatch = path.match(/^\/admin\/page\/([^/]+)$/);
  if (method === 'PUT' && adminPageMatch) {
    const slug = adminPageMatch[1];
    const body = await request.json().catch(() => ({} as any));
    const content = String(body.content || '').trim();
    if (!content) return json(400, { error: 'content required' });
    const now = new Date().toISOString();
    await env.DB.prepare('INSERT INTO site_pages (slug, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(slug) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at')
      .bind(slug, content, now)
      .run();
    return json(200, { ok: true, slug, updatedAt: now });
  }

  // Admin: get contacts
  if (method === 'GET' && path === '/admin/contacts') {
    const row = (await env.DB.prepare('SELECT id, email, phone, instagram, facebook, updated_at FROM site_contacts WHERE id = 1').first()) as ContactsRow | null;
    return json(200, { contacts: row || null });
  }

  // Admin: update contacts
  if (method === 'PUT' && path === '/admin/contacts') {
    const body = await request.json().catch(() => ({} as any));
    const email = body.email != null ? String(body.email).trim() : null;
    const phone = body.phone != null ? String(body.phone).trim() : null;
    const instagram = body.instagram != null ? String(body.instagram).trim() : null;
    const facebook = body.facebook != null ? String(body.facebook).trim() : null;
    const now = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO site_contacts (id, email, phone, instagram, facebook, updated_at) VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, phone=excluded.phone, instagram=excluded.instagram, facebook=excluded.facebook, updated_at=excluded.updated_at'
    )
      .bind(email, phone, instagram, facebook, now)
      .run();
    return json(200, { ok: true, updatedAt: now });
  }

  // Admin: list editable site assets
  if (method === 'GET' && path === '/admin/site-assets') {
    const assets: Record<string, ReturnType<typeof normalizeSiteAssetRow>> = {};
    for (const key of SITE_ASSET_KEYS) {
      const row = (await env.DB.prepare('SELECT key, object_key, alt, updated_at FROM site_assets WHERE key = ?')
        .bind(key)
        .first()) as SiteAssetRow | null;
      assets[key] = normalizeSiteAssetRow(row, key, await siteAssetObjectExists(env, key, row));
    }
    return json(200, { assets });
  }

  // Admin: upload/replace editable site asset
  const adminSiteAssetMatch = path.match(/^\/admin\/site-assets\/([^/]+)$/);
  if ((method === 'PUT' || method === 'POST') && adminSiteAssetMatch) {
    const key = safeFilename(safeDecodePathComponent(adminSiteAssetMatch[1]));
    if (!isAllowedSiteAssetKey(key)) return json(400, { error: 'Invalid asset key' });

    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) return json(400, { error: 'Expected multipart/form-data' });

    const form = await request.formData();
    const file = form.get('file');
    const alt = String(form.get('alt') || '').trim();
    const existing = (await env.DB.prepare('SELECT key, object_key, alt, updated_at FROM site_assets WHERE key = ?')
      .bind(key)
      .first()) as SiteAssetRow | null;

    let objectKey = existing?.object_key || '';
    if (file instanceof File) {
      if (!isAllowedUploadImage(file)) {
        return json(400, {
          error: `Unsupported file type for "${file.name}" (${file.type || 'unknown'}). Allowed: JPG/JPEG, PNG, WebP, AVIF.`,
        });
      }
      objectKey = `site/${key}.${extensionForUpload(file)}`;
      await env.R2_PHOTO_GALLERIES.put(objectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });
      if (existing?.object_key && existing.object_key !== objectKey) {
        await env.R2_PHOTO_GALLERIES.delete(existing.object_key).catch(() => {});
      }
    }

    if (!objectKey) return json(400, { error: 'file required' });
    const updatedAt = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO site_assets (key, object_key, alt, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET object_key=excluded.object_key, alt=excluded.alt, updated_at=excluded.updated_at'
    )
      .bind(key, objectKey, alt || existing?.alt || null, updatedAt)
      .run();

    const row = (await env.DB.prepare('SELECT key, object_key, alt, updated_at FROM site_assets WHERE key = ?')
      .bind(key)
      .first()) as SiteAssetRow | null;
    return json(200, { ok: true, asset: normalizeSiteAssetRow(row, key) });
  }

  // Admin: collection view analytics
  if (method === 'GET' && path === '/admin/analytics/collection-views') {
    const res = await env.DB.prepare(
      'SELECT g.id, g.title, IFNULL(cv.views, 0) as views, cv.last_viewed FROM galleries g LEFT JOIN collection_views cv ON cv.gallery_id = g.id ORDER BY views DESC, sort_order ASC, datetime(g.created_at) DESC'
    ).all();
    const stats = (((res as any).results || []) as any[]).map((r: any) => ({
      id: r.id,
      title: r.title,
      views: Number(r.views || 0),
      lastViewed: r.last_viewed || null,
    }));
    return json(200, { stats });
  }

  // POST /admin/gallery
  if (method === 'POST' && path === '/admin/gallery') {
  const body = await request.json();
    const id = String(body.id || body.slug || '').trim();
    const title = String(body.title || '').trim();
    const createdAt = String(body.createdAt || new Date().toISOString());
    const isPrivate = body.isPrivate === true ? 1 : 0;
    const visible = isPrivate ? 0 : body.visible === false ? 0 : 1;
    const zipEnabled = body.zipEnabled === false ? 0 : 1;
    const privateToken = isPrivate ? generateSecretToken() : null;
    if (!id || !title) return json(400, { error: 'id and title are required' });

    const maxRes = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM galleries').first();
    const nextSort = (maxRes?.m ?? 0) + 1;

    try {
      await env.DB.prepare('INSERT INTO galleries (id, title, visible, zip_enabled, sort_order, is_private, private_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, title, visible, zipEnabled, nextSort, isPrivate, privateToken, createdAt)
        .run();
    } catch {
      return json(409, { error: 'Gallery already exists' });
    }

    return json(200, {
      gallery: {
        id,
        title,
        visible: visible === 1,
        zipEnabled: zipEnabled === 1,
        sortOrder: nextSort,
        createdAt,
        isPrivate: isPrivate === 1,
        privateToken,
      },
    });
  }

  // PATCH /admin/gallery/:id
  // NOTE: ensure this does not greedily match deeper routes like
  // /admin/gallery/:id/photos or /admin/gallery/:id/photo/:photoId.
  const patchMatch = path.match(/^\/admin\/gallery\/([^/]+)$/);
  if (method === 'PATCH' && patchMatch) {
    const id = safeDecodePathComponent(patchMatch[1]);
  const existing = await ensureGalleryExists(env, id);
  if (!existing) return json(404, { error: 'Not found' });
  const body = await request.json();

    const title = body.title != null ? String(body.title).trim() : existing.title;
    const requestedPrivate = body.isPrivate != null ? (body.isPrivate ? 1 : 0) : existing.is_private || 0;
    const regenerateToken = body.regenerateToken === true;
    const visible = requestedPrivate === 1 ? 0 : body.visible != null ? (body.visible ? 1 : 0) : existing.visible;
    const zipEnabled = body.zipEnabled != null ? (body.zipEnabled ? 1 : 0) : (existing.zip_enabled == null ? 1 : existing.zip_enabled);
    const sortOrder = body.sortOrder != null ? Number(body.sortOrder) : existing.sort_order ?? 0;
    const privateToken = requestedPrivate === 1 ? (regenerateToken || !existing.private_token ? generateSecretToken() : existing.private_token) : existing.private_token || null;
    await env.DB.prepare('UPDATE galleries SET title = ?, visible = ?, zip_enabled = ?, sort_order = ?, is_private = ?, private_token = ? WHERE id = ?')
      .bind(title, visible, zipEnabled, sortOrder, requestedPrivate, privateToken, id)
      .run();

    return json(200, {
      gallery: {
        id,
        title,
        visible: visible === 1,
        zipEnabled: zipEnabled === 1,
        sortOrder,
        createdAt: existing.created_at,
        isPrivate: requestedPrivate === 1,
        privateToken,
      },
    });
  }

  // POST /admin/gallery/:id/zip — generate & store ZIP in R2 for downloads
  const zipGenMatch = path.match(/^\/admin\/gallery\/([^/]+)\/zip$/);
  if (method === 'POST' && zipGenMatch) {
    const id = safeDecodePathComponent(zipGenMatch[1]);
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return json(404, { error: 'Not found' });

    try {
      const photosRes = await env.DB.prepare(
        'SELECT filename, object_key, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
      )
        .bind(id)
        .all();

      const rows = (((photosRes as any).results || []) as any[])
        .map((r: any) => ({ filename: String(r.filename), object_key: String(r.object_key), created_at: String(r.created_at || '') }))
        .filter((r) => r.filename !== 'cover.jpg')
        .filter((r) => !r.filename.startsWith('thumbs/'));

      if (!rows.length) return json(404, { error: 'No photos to zip' });

      // Preflight size to avoid runaway memory/CPU; limit ~600MB.
      const headInfos = await Promise.all(
        rows.map(async (r) => {
          const meta = await env.R2_PHOTO_GALLERIES.head(r.object_key);
          return { row: r, size: meta?.size || 0 };
        })
      );
      const totalSize = headInfos.reduce((sum, h) => sum + (h.size || 0), 0);
      const zipKey = zipObjectKey(id);
      const estimatedZipSize = estimateZipLength(
        headInfos.map(({ row, size }) => ({ name: safeFilename(row.filename), size }))
      );
      const generatedAt = new Date().toISOString();

      const zipStreamInputs: ZipStreamFile[] = headInfos.map(({ row }) => ({
        name: safeFilename(row.filename),
        objectKey: row.object_key,
        mtime: row.created_at ? new Date(row.created_at) : undefined,
      }));
      if (!zipStreamInputs.length) return json(404, { error: 'No photos found' });

      const zipStream = buildZipStream(env, zipStreamInputs);
      await uploadZipMultipart(env, zipKey, zipStream, {
        contentDisposition: `attachment; filename="${safeFilename(id)}.zip"`,
        contentLength: estimatedZipSize || undefined,
        customMetadata: {
          generatedAt,
          totalSize: String(totalSize),
          fileCount: String(rows.length),
        },
      });

      return json(200, { ok: true, key: zipKey, totalSize });
    } catch (err: any) {
      console.error('zip generation failed', err);
      return json(500, { error: err?.message || 'ZIP generation failed' });
    }
  }

  // DELETE /admin/gallery/:id
  if (method === 'DELETE' && patchMatch) {
    const id = safeDecodePathComponent(patchMatch[1]);
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    // Delete R2 objects for that gallery (best-effort: list + delete)
  const prefix = `${id}/`;
    let cursor: string | undefined;
    do {
      const listed = await env.R2_PHOTO_GALLERIES.list({ prefix, cursor, limit: 1000 });
      const keys = (listed.objects || []).map((o: any) => o.key);
      if (keys.length) await env.R2_PHOTO_GALLERIES.delete(keys);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    await env.DB.prepare('DELETE FROM galleries WHERE id = ?').bind(id).run();
    return json(200, { ok: true, id });
  }

  // GET /admin/gallery/:id/photos
  const adminPhotosMatch = path.match(/^\/admin\/gallery\/([^/]+)\/photos$/);
  if (method === 'GET' && adminPhotosMatch) {
    const id = safeDecodePathComponent(adminPhotosMatch[1]);
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    const photosRes = await env.DB.prepare(
      'SELECT id, gallery_id, filename, object_key, thumb_object_key, sort_order, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();

    const photos = (((photosRes as any).results || []) as any[]).map((p: any) => {
      const fallbackThumbKey =
        p.filename && p.filename !== 'cover.jpg'
          ? `${id}/thumbs/${String(p.filename).replace(/\.[^.]+$/, '')}.jpg`
          : '';
      const thumbKey = p.thumb_object_key || fallbackThumbKey;
      const imageToken = existing.is_private === 1 && existing.private_token ? existing.private_token : null;
      return {
        id: p.id,
        filename: p.filename,
        isCover: p.filename === 'cover.jpg',
        order: p.sort_order,
        url: imageUrlForPath(id, String(p.filename), imageToken),
        thumbUrl: thumbKey ? imageUrlForObjectKey(String(thumbKey), imageToken) : undefined,
        createdAt: p.created_at,
      };
    });
    return json(200, { photos });
  }

  // POST /admin/gallery/:id/cover — set an existing photo as cover.jpg
  const adminCoverMatch = path.match(/^\/admin\/gallery\/([^/]+)\/cover$/);
  if (method === 'POST' && adminCoverMatch) {
    const id = safeDecodePathComponent(adminCoverMatch[1]);
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    const body = await request.json().catch(() => ({} as any));
    const photoId = body.photoId != null ? Number(body.photoId) : NaN;
    const filename = body.filename != null ? safeFilename(String(body.filename)) : '';
    const row = Number.isFinite(photoId) && Number.isInteger(photoId) && photoId > 0
      ? await env.DB.prepare('SELECT id, filename, object_key, thumb_object_key FROM photos WHERE id = ? AND gallery_id = ?')
          .bind(photoId, id)
          .first()
      : filename
        ? await env.DB.prepare('SELECT id, filename, object_key, thumb_object_key FROM photos WHERE gallery_id = ? AND filename = ?')
            .bind(id, filename)
            .first()
        : null;

    if (!row) return json(404, { error: 'Photo not found' });

    const sourceFilename = String((row as any).filename || '');
    const sourceKey = String((row as any).object_key || objectKeyFor(id, sourceFilename));
    const sourceObj = await env.R2_PHOTO_GALLERIES.get(sourceKey);
    if (!sourceObj || !sourceObj.body) return json(404, { error: 'Source image not found in R2' });

    const coverKey = objectKeyFor(id, 'cover.jpg');
    const sourceHeaders = new Headers();
    sourceObj.writeHttpMetadata(sourceHeaders);
    await env.R2_PHOTO_GALLERIES.put(coverKey, sourceObj.body, {
      httpMetadata: {
        contentType: sourceHeaders.get('content-type') || 'application/octet-stream',
      },
    });

    let coverThumbKey: string | null = null;
    const sourceThumbKey = String((row as any).thumb_object_key || '');
    if (sourceThumbKey) {
      const sourceThumb = await env.R2_PHOTO_GALLERIES.get(sourceThumbKey);
      if (sourceThumb && sourceThumb.body) {
        coverThumbKey = thumbKeyFor(id, 'cover.jpg');
        await env.R2_PHOTO_GALLERIES.put(coverThumbKey, sourceThumb.body, {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
        });
      }
    }

    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      'INSERT INTO photos (gallery_id, filename, object_key, thumb_object_key, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(gallery_id, filename) DO UPDATE SET object_key=excluded.object_key, thumb_object_key=excluded.thumb_object_key, sort_order=0, created_at=excluded.created_at'
    )
      .bind(id, 'cover.jpg', coverKey, coverThumbKey, createdAt)
      .run();

    const imageToken = existing.is_private === 1 && existing.private_token ? existing.private_token : null;
    return json(200, {
      ok: true,
      cover: {
        filename: 'cover.jpg',
        url: imageUrlForPath(id, 'cover.jpg', imageToken),
        thumbUrl: coverThumbKey ? imageUrlForObjectKey(coverThumbKey, imageToken) : undefined,
      },
    });
  }

  // DELETE /admin/gallery/:id/photo/:photoId  (robust delete by numeric id)
  const adminDeletePhotoByIdMatch = path.match(/^\/admin\/gallery\/([^/]+)\/photo\/([^/]+)$/);
  if (method === 'DELETE' && adminDeletePhotoByIdMatch) {
    const id = safeDecodePathComponent(adminDeletePhotoByIdMatch[1]);
    const photoIdRaw = safeDecodePathComponent(adminDeletePhotoByIdMatch[2]);
    const photoId = Number(photoIdRaw);
    if (!Number.isFinite(photoId) || !Number.isInteger(photoId) || photoId <= 0) {
      return json(400, { error: 'Invalid photo id' });
    }

    const row = await env.DB.prepare(
      'SELECT filename, object_key, thumb_object_key FROM photos WHERE id = ? AND gallery_id = ?'
    )
      .bind(photoId, id)
      .first();
    if (!row) return json(404, { error: 'Not found' });

    const filename = String((row as any).filename || '');
    const objectKey = String((row as any).object_key || objectKeyFor(id, filename));
  const thumbKey = String((row as any).thumb_object_key || thumbKeyFor(id, filename));
  const legacyDoubleExtThumbKey = `${id}/thumbs/${safeFilename(filename)}.jpg`;
  const derivedThumbKey = thumbKeyFor(id, filename);

    await env.R2_PHOTO_GALLERIES.delete(objectKey);
    await env.R2_PHOTO_GALLERIES.delete(thumbKey);
    // Backward-compat cleanup: old inserts stored thumbs as "<filename>.jpg" (double extension)
    // and some rows may have missing thumb_object_key.
    await env.R2_PHOTO_GALLERIES.delete(legacyDoubleExtThumbKey);
    await env.R2_PHOTO_GALLERIES.delete(derivedThumbKey);
    await env.DB.prepare('DELETE FROM photos WHERE id = ? AND gallery_id = ?').bind(photoId, id).run();
    return json(200, { ok: true, deleted: filename, photoId });
  }

  // POST /admin/gallery/:id/photos (multipart form-data)
  // fields:
  //  - files: File (can be multiple)
  //  - thumbs: File (optional, can be multiple; must correspond 1:1 to `files` by index)
  //           Each thumb is expected to be a JPEG preview for the matching file.
  //  - makeCover: '1' optional (if no cover exists, first uploaded becomes cover.jpg)
  const adminUploadMatch = path.match(/^\/admin\/gallery\/([^/]+)\/photos$/);
  if (method === 'POST' && adminUploadMatch) {
    const id = adminUploadMatch[1];
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('multipart/form-data')) return json(400, { error: 'Expected multipart/form-data' });

    const form = await request.formData();
    const files = form.getAll('files').filter((f) => f instanceof File) as File[];
  const thumbs = form.getAll('thumbs').filter((f) => f instanceof File) as File[];
    const makeCover = String(form.get('makeCover') || '') === '1';
    if (!files.length) return json(400, { error: 'No files uploaded' });

    const maxRes = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM photos WHERE gallery_id = ?')
      .bind(id)
      .first();
    let nextOrder = (maxRes?.m ?? 0) + 1;

    const inserted: Array<{ filename: string; url: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!isAllowedUploadImage(file)) {
        return json(400, {
          error: `Unsupported file type for "${file.name}" (${file.type || 'unknown'}). Allowed: JPG/JPEG, PNG, WebP, AVIF.`,
        });
      }
      const origName = safeFilename(file.name);
      const filename = makeCover && i === 0 ? 'cover.jpg' : origName;
      const key = objectKeyFor(id, filename);

      // If the client provided a thumbnail for this file, store it separately.
      const thumbFile = thumbs[i];
      const hasThumb = thumbFile instanceof File;
  // IMPORTANT: use the stored filename so thumb_object_key matches DB filename.
  const thumbKey = hasThumb ? thumbKeyFor(id, filename) : undefined;

      await env.R2_PHOTO_GALLERIES.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });

      if (hasThumb && thumbKey) {
        const tt = String((thumbFile as File).type || '').toLowerCase();
        if (tt && tt !== 'image/jpeg') {
          return json(400, { error: `Invalid thumbnail type for "${file.name}": expected image/jpeg` });
        }
        await env.R2_PHOTO_GALLERIES.put(thumbKey, (thumbFile as File).stream(), {
          httpMetadata: {
            contentType: 'image/jpeg',
          },
        });
      }

      const createdAt = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO photos (gallery_id, filename, object_key, thumb_object_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(gallery_id, filename) DO UPDATE SET object_key=excluded.object_key, thumb_object_key=excluded.thumb_object_key'
      )
        .bind(id, filename, key, thumbKey || null, filename === 'cover.jpg' ? 0 : nextOrder++, createdAt)
        .run();

      inserted.push({ filename, url: `/api/image/${id}/${encodeURIComponent(filename)}` });
    }

    return json(200, { ok: true, files: inserted });
  }

  // DELETE /admin/gallery/:id/photos/:filename
  const adminDeletePhotoMatch = path.match(/^\/admin\/gallery\/([^/]+)\/photos\/(.+)$/);
  if (method === 'DELETE' && adminDeletePhotoMatch) {
    const id = safeDecodePathComponent(adminDeletePhotoMatch[1]);
    const rawFilename = safeDecodePathComponent(adminDeletePhotoMatch[2]);
    const safeName = safeFilename(rawFilename);
    // Best-effort: even if gallery/row is missing, attempt to delete derived keys and clear DB rows.

    const row =
      (await env.DB.prepare('SELECT object_key, thumb_object_key, filename FROM photos WHERE gallery_id = ? AND filename = ?')
        .bind(id, rawFilename)
        .first()) ||
      (await env.DB.prepare('SELECT object_key, thumb_object_key, filename FROM photos WHERE gallery_id = ? AND filename = ?')
        .bind(id, safeName)
        .first()) ||
      (await env.DB.prepare('SELECT object_key, thumb_object_key, filename FROM photos WHERE gallery_id = ? AND object_key LIKE ?')
        .bind(id, `%/${safeName}`)
        .first());

    const storedName = (row as any)?.filename || rawFilename;
    const objectKey = (row as any)?.object_key || objectKeyFor(id, storedName);
    const thumbKey = (row as any)?.thumb_object_key || `${id}/thumbs/${safeFilename(storedName)}.jpg`;

    // Delete objects (best effort)
    await env.R2_PHOTO_GALLERIES.delete(objectKey);
    await env.R2_PHOTO_GALLERIES.delete(thumbKey);

    // Clean DB rows by stored/raw/safe names
    await env.DB.prepare('DELETE FROM photos WHERE gallery_id = ? AND filename = ?').bind(id, storedName).run();
    if (safeName !== storedName) {
      await env.DB.prepare('DELETE FROM photos WHERE gallery_id = ? AND filename = ?').bind(id, safeName).run();
    }
    if (rawFilename !== storedName && rawFilename !== safeName) {
      await env.DB.prepare('DELETE FROM photos WHERE gallery_id = ? AND filename = ?').bind(id, rawFilename).run();
    }

    return json(200, { ok: true, deleted: storedName, objectKey, thumbKey });
  }

  // Helpful debug for admin UI issues. Does not leak secrets.
  if (path.startsWith('/admin/')) {
    return jsonNoCache(404, {
      error: 'Not found',
      method,
      path,
      note: 'No matching admin route. If deleting a photo, ensure the filename is URI-encoded and does not contain unescaped slashes.',
    });
  }
  return jsonNoCache(404, { error: 'Not found' });
};
