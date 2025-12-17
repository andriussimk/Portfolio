export const onRequest = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  url.pathname = '/adminPanel.html';
  return Response.redirect(url.toString(), 302);
};
