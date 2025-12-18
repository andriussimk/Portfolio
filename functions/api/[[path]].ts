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
  created_at: string;
};

type PhotoRow = {
  id: number;
  gallery_id: string;
  filename: string;
  object_key: string;
  sort_order: number;
  created_at: string;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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

function safeDecodePathComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function ensureGalleryExists(env: Env, id: string) {
  const g = await env.DB.prepare('SELECT id, title, visible, created_at FROM galleries WHERE id = ?')
    .bind(id)
    .first();
  return g as GalleryRow | null;
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

  // Public: GET /image/:galleryId/:filename -> stream from R2
  const imageMatch = path.match(/^\/image\/([^/]+)\/(.+)$/);
  if (method === 'GET' && imageMatch) {
    const galleryId = imageMatch[1];
    const filename = safeFilename(safeDecodePathComponent(imageMatch[2]));
    const key = objectKeyFor(galleryId, filename);
    const obj = await env.R2_PHOTO_GALLERIES.get(key);
    if (!obj) return text(404, 'Not found');
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    // Keep it cacheable, but short enough that new uploads become visible quickly.
    if (!headers.has('cache-control')) headers.set('cache-control', 'public, max-age=300');
    return new Response(obj.body, { headers });
  }

  // Public: GET /galleries
  if (method === 'GET' && (path === '/' || path === '/galleries')) {
    const includeHidden = url.searchParams.get('all') === '1';
    const stmt = includeHidden
      ? env.DB.prepare('SELECT id, title, visible, created_at FROM galleries ORDER BY datetime(created_at) DESC')
      : env.DB.prepare('SELECT id, title, visible, created_at FROM galleries WHERE visible = 1 ORDER BY datetime(created_at) DESC');

    const res = await stmt.all();
    const galleries = ((res as any).results || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      visible: g.visible === 1,
      createdAt: g.created_at,
      coverUrl: `/api/image/${g.id}/cover.jpg`,
    }));
    return json(200, { galleries });
  }

  // Public: GET /galleries/:id
  const galleryMatch = path.match(/^\/galleries\/(.+)$/);
  if (method === 'GET' && galleryMatch) {
    const id = galleryMatch[1];
    const gallery = await ensureGalleryExists(env, id);
    if (!gallery) return json(404, { error: 'Not found' });
    if (gallery.visible !== 1) return json(404, { error: 'Not found' });

    const photosRes = await env.DB.prepare(
      'SELECT id, gallery_id, filename, object_key, sort_order, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();
    const photos = (((photosRes as any).results || []) as any[]).map((p: any) => ({
      filename: p.filename,
      order: p.sort_order,
      url: `/api/image/${id}/${encodeURIComponent(p.filename)}`,
    }));

    // If a cover.jpg object isn't present, fall back to first non-cover photo.
    const coverPhoto = photos.find((p) => p.filename === 'cover.jpg') || photos.find((p) => p.filename !== 'cover.jpg');

    return json(200, {
      gallery: {
        id: gallery.id,
        title: gallery.title,
        visible: gallery.visible === 1,
        createdAt: gallery.created_at,
        coverUrl: coverPhoto ? coverPhoto.url : `/api/image/${id}/cover.jpg`,
        photos,
      },
    });
  }

  // Admin-only routes
  if (!isAdmin(request, env)) return json(401, { error: 'Unauthorized' });

  // Admin: list galleries (includes hidden)
  if (method === 'GET' && path === '/admin/galleries') {
    const res = await env.DB.prepare('SELECT id, title, visible, created_at FROM galleries ORDER BY datetime(created_at) DESC').all();
    const galleries = (((res as any).results || []) as any[]).map((g: any) => ({
      id: g.id,
      title: g.title,
      visible: g.visible === 1,
      createdAt: g.created_at,
    }));
    return json(200, { galleries });
  }

  // POST /admin/gallery
  if (method === 'POST' && path === '/admin/gallery') {
  const body = await request.json();
    const id = String(body.id || body.slug || '').trim();
    const title = String(body.title || '').trim();
    const createdAt = String(body.createdAt || new Date().toISOString());
    const visible = body.visible === false ? 0 : 1;
    if (!id || !title) return json(400, { error: 'id and title are required' });

    try {
      await env.DB.prepare('INSERT INTO galleries (id, title, visible, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, title, visible, createdAt)
        .run();
    } catch {
      return json(409, { error: 'Gallery already exists' });
    }

    return json(200, { gallery: { id, title, visible: visible === 1, createdAt } });
  }

  // PATCH /admin/gallery/:id
  const patchMatch = path.match(/^\/admin\/gallery\/(.+)$/);
  if (method === 'PATCH' && patchMatch) {
    const id = patchMatch[1];
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });
  const body = await request.json();

    const title = body.title != null ? String(body.title).trim() : existing.title;
    const visible = body.visible != null ? (body.visible ? 1 : 0) : existing.visible;
    await env.DB.prepare('UPDATE galleries SET title = ?, visible = ? WHERE id = ?')
      .bind(title, visible, id)
      .run();

    return json(200, { gallery: { id, title, visible: visible === 1, createdAt: existing.created_at } });
  }

  // DELETE /admin/gallery/:id
  if (method === 'DELETE' && patchMatch) {
    const id = patchMatch[1];
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
    const id = adminPhotosMatch[1];
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    const photosRes = await env.DB.prepare(
      'SELECT id, gallery_id, filename, object_key, sort_order, created_at FROM photos WHERE gallery_id = ? ORDER BY sort_order ASC, datetime(created_at) ASC'
    )
      .bind(id)
      .all();

    const photos = (((photosRes as any).results || []) as any[]).map((p: any) => ({
      filename: p.filename,
      order: p.sort_order,
      url: `/api/image/${id}/${encodeURIComponent(p.filename)}`,
      createdAt: p.created_at,
    }));
    return json(200, { photos });
  }

  // POST /admin/gallery/:id/photos (multipart form-data)
  // fields:
  //  - files: File (can be multiple)
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
    const makeCover = String(form.get('makeCover') || '') === '1';
    if (!files.length) return json(400, { error: 'No files uploaded' });

    const maxRes = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM photos WHERE gallery_id = ?')
      .bind(id)
      .first();
    let nextOrder = (maxRes?.m ?? 0) + 1;

    let coverExists = false;
    if (makeCover) {
      const coverObj = await env.R2_PHOTO_GALLERIES.get(objectKeyFor(id, 'cover.jpg'));
      coverExists = !!coverObj;
    }

    const inserted: Array<{ filename: string; url: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const origName = safeFilename(file.name);
      const filename = makeCover && i === 0 && !coverExists ? 'cover.jpg' : origName;
      const key = objectKeyFor(id, filename);

      await env.R2_PHOTO_GALLERIES.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });

      const createdAt = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO photos (gallery_id, filename, object_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(gallery_id, filename) DO UPDATE SET object_key=excluded.object_key'
      )
        .bind(id, filename, key, filename === 'cover.jpg' ? 0 : nextOrder++, createdAt)
        .run();

      inserted.push({ filename, url: `/api/image/${id}/${encodeURIComponent(filename)}` });
    }

    return json(200, { ok: true, files: inserted });
  }

  // DELETE /admin/gallery/:id/photos/:filename
  const adminDeletePhotoMatch = path.match(/^\/admin\/gallery\/([^/]+)\/photos\/(.+)$/);
  if (method === 'DELETE' && adminDeletePhotoMatch) {
    const id = adminDeletePhotoMatch[1];
    const filename = decodeURIComponent(adminDeletePhotoMatch[2]);
    const existing = await ensureGalleryExists(env, id);
    if (!existing) return json(404, { error: 'Not found' });

    const key = objectKeyFor(id, filename);
    await env.R2_PHOTO_GALLERIES.delete(key);
    await env.DB.prepare('DELETE FROM photos WHERE gallery_id = ? AND filename = ?')
      .bind(id, filename)
      .run();
    return json(200, { ok: true });
  }

  return json(404, { error: 'Not found' });
};
