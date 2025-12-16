// Define Env locally to avoid missing module error
interface Env {
  ADMIN_TOKEN?: string;
  ADMIN_EMAIL?: string;
}

// Simple in-memory sample data (replace with D1/R2 persistence)
const SAMPLE_GALLERIES = [
  {
    id: 'concerts',
    title: 'Concerts',
    visible: true,
    createdAt: '2025-01-01',
    photos: [
      { filename: 'cover.jpg', order: 1, url: '/images/concerts/cover.jpg' },
      { filename: 'img001.jpg', order: 2, url: '/images/concerts/img001.jpg' },
    ],
  },
  {
    id: 'events',
    title: 'Events',
    visible: true,
    createdAt: '2025-01-02',
    photos: [
      { filename: 'cover.jpg', order: 1, url: '/images/events/cover.jpg' },
    ],
  },
];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

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

  // Public: GET /galleries
  if (method === 'GET' && (path === '/' || path === '/galleries')) {
    const galleries = SAMPLE_GALLERIES.filter((g) => g.visible !== false).map((g) => ({
      id: g.id,
      title: g.title,
      visible: g.visible,
      createdAt: g.createdAt,
      coverUrl: g.photos?.[0]?.url,
      photos: g.photos,
    }));
    return json(200, { galleries });
  }

  // Public: GET /galleries/:id
  const galleryMatch = path.match(/^\/galleries\/(.+)$/);
  if (method === 'GET' && galleryMatch) {
    const id = galleryMatch[1];
    const gallery = SAMPLE_GALLERIES.find((g) => g.id === id);
    if (!gallery || gallery.visible === false) return json(404, { error: 'Not found' });
    return json(200, { gallery });
  }

  // Admin-only routes
  if (!isAdmin(request, env)) return json(401, { error: 'Unauthorized' });

  // POST /admin/gallery
  if (method === 'POST' && path === '/admin/gallery') {
    const body = await request.json();
    return json(200, { gallery: { ...body, id: body.id || body.slug, visible: true, photos: [] } });
  }

  // PATCH /admin/gallery/:id
  const patchMatch = path.match(/^\/admin\/gallery\/(.+)$/);
  if (method === 'PATCH' && patchMatch) {
    const body = await request.json();
    return json(200, { gallery: { id: patchMatch[1], ...body } });
  }

  // DELETE /admin/gallery/:id
  if (method === 'DELETE' && patchMatch) {
    return json(200, { ok: true, id: patchMatch[1] });
  }

  // POST /admin/upload (stub)
  if (method === 'POST' && path === '/admin/upload') {
    return json(200, { ok: true, uploadUrl: 'https://r2-upload-url.example.com' });
  }

  // DELETE /admin/photo (stub)
  if (method === 'DELETE' && path === '/admin/photo') {
    return json(200, { ok: true });
  }

  return json(404, { error: 'Not found' });
};
