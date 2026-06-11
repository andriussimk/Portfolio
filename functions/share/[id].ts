type D1Database = any;

interface Env {
  DB: D1Database;
}

type GalleryRow = {
  id: string;
  title: string;
  visible: number;
  is_private?: number;
  private_token?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  } as Record<string, string>)[ch]);
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function canAccessGallery(g: GalleryRow, token: string | null) {
  const privateOk = g.is_private === 1 && !!g.private_token && !!token && token === g.private_token;
  const publicVisible = g.visible === 1 && (g.is_private == null || g.is_private === 0);
  return publicVisible || privateOk;
}

function imageUrlForObjectKey(origin: string, objectKey: string, token?: string | null) {
  const parts = objectKey.split('/').filter(Boolean).map((part) => encodeURIComponent(part));
  const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${origin}/api/image/${parts.join('/')}${tokenSuffix}`;
}

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { id?: string } }) => {
  const url = new URL(request.url);
  const id = safeDecode(String(params.id || '')).trim();
  const token = url.searchParams.get('token');
  if (!id) return new Response('Not found', { status: 404 });

  const gallery = (await env.DB.prepare('SELECT id, title, visible, is_private, private_token FROM galleries WHERE id = ?')
    .bind(id)
    .first()) as GalleryRow | null;
  if (!gallery || !canAccessGallery(gallery, token)) {
    return new Response('Not found', { status: 404 });
  }

  const cover = (await env.DB.prepare(
    `SELECT filename, object_key
     FROM photos
     WHERE gallery_id = ?
     ORDER BY CASE WHEN filename = 'cover.jpg' THEN 0 ELSE 1 END, sort_order ASC, datetime(created_at) ASC
     LIMIT 1`
  )
    .bind(id)
    .first()) as { filename?: string; object_key?: string } | null;

  const origin = url.origin;
  const collectionPath = `/collection.html?id=${encodeURIComponent(id)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  const collectionUrl = `${origin}${collectionPath}`;
  const imageUrl = cover?.object_key
    ? imageUrlForObjectKey(origin, String(cover.object_key), gallery.is_private === 1 ? token : null)
    : `${origin}/api/image/${encodeURIComponent(id)}/cover.jpg${gallery.is_private === 1 && token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const title = `${gallery.title} - Shot by Andrius`;
  const description = 'Private photography collection by Shot by Andrius.';

  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${escapeHtml(collectionUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url.href)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:alt" content="${escapeHtml(gallery.title)} cover photo">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
  <script>window.location.replace(${JSON.stringify(collectionPath)});</script>
</head>
<body>
  <a href="${escapeHtml(collectionUrl)}">Open collection</a>
</body>
</html>`, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
