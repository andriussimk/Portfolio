export const onRequest = async ({ request }: { request: Request }) => {
  // This function is intentionally a no-op.
  // We rely on Cloudflare Pages `_redirects` rule `/adminPanel /adminPanel.html 302`.
  // Keeping this file empty avoids redirect loops between `/adminPanel` and `/adminPanel.html`.
  return fetch(request);
};
