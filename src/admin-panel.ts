import './styles/base.css';
import './styles/layout.css';

const apiBase = '/api';
const TOKEN_KEY = 'admin_token';
let token = localStorage.getItem(TOKEN_KEY) || '';

function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...authHeaders(),
    ...(opts.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${apiBase}${path}`, { ...opts, headers });
  if (res.status === 401) throw new Error('Unauthorized');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function qs(id: string) {
  return document.getElementById(id);
}

function setStatus(msg: string, isError = false) {
  const el = qs('status');
  if (el) {
    el.textContent = msg;
    el.className = isError ? 'status error' : 'status';
  }
}

function showLogin(show = true, error?: string) {
  const modal = qs('login-modal');
  const err = qs('login-error');
  if (modal) {
    modal.classList.toggle('show', show);
    modal.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  if (err) err.textContent = error || '';
}

function bindLogin() {
  const submit = qs('login-submit');
  const cancel = qs('login-cancel');
  const input = qs('login-token') as HTMLInputElement | null;
  if (submit) {
    submit.addEventListener('click', () => {
      if (!input) return;
      const value = input.value.trim();
      if (!value) return showLogin(true, 'Token required');
      token = value;
      localStorage.setItem(TOKEN_KEY, token);
      showLogin(false);
      loadGalleries();
    });
  }
  if (cancel) cancel.addEventListener('click', () => showLogin(false));
}

async function loadGalleries() {
  try {
    setStatus('Loading galleries...');
    const data = await api('/admin/galleries');
    const list = qs('gallery-list');
    if (!list) return;
    list.innerHTML = (data.galleries || []).map((g: any) => `
      <div class="card">
        <div><strong>${g.title}</strong> <small>(${g.id})</small></div>
        <div>Visible: ${g.visible !== false ? 'Yes' : 'No'}</div>
        <div class="actions">
          <button data-action="toggle" data-id="${g.id}">${g.visible !== false ? 'Hide' : 'Show'}</button>
          <button data-action="delete" data-id="${g.id}" class="danger">Delete</button>
          <button data-action="manage" data-id="${g.id}">Manage photos</button>
        </div>
      </div>
    `).join('');
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      setStatus('Login required', true);
      showLogin(true, 'Enter admin token');
      return;
    }
    setStatus(err.message || 'Failed to load galleries', true);
  }
}

function bindActions() {
  const list = qs('gallery-list');
  if (!list) return;
  list.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;
    try {
      if (action === 'delete') {
        await api(`/admin/gallery/${id}`, { method: 'DELETE' });
        setStatus('Deleted.');
      }
      if (action === 'toggle') {
        const visible = target.textContent?.includes('Hide') ? false : true;
        await api(`/admin/gallery/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ visible: !visible }),
        });
        setStatus('Updated visibility.');
      }
      if (action === 'manage') {
        (document.getElementById('photo-gallery-id') as HTMLInputElement | null)!.value = id;
        await loadPhotos(id);
        setStatus(`Managing photos for ${id}`);
      }
      await loadGalleries();
    } catch (err: any) {
      setStatus(err.message || 'Action failed', true);
    }
  });
}

async function loadPhotos(galleryId: string) {
  const wrap = document.getElementById('photo-manager');
  const list = document.getElementById('photo-list');
  if (wrap) wrap.style.display = 'block';
  if (!list) return;
  list.innerHTML = 'Loading...';
  try {
    const data = await api(`/admin/gallery/${galleryId}/photos`);
    const photos = data.photos || [];
    if (!photos.length) {
      list.innerHTML = '<div class="muted">No photos yet.</div>';
      return;
    }
    list.innerHTML = photos
      .map(
        (p: any) => `
        <div class="card" style="display:flex;align-items:center;gap:12px;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:12px">
            <img src="${p.url}" alt="${p.filename}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,0.15)" />
            <div>
              <div><strong>${p.filename}</strong></div>
              <small>order: ${p.order ?? 0}</small>
            </div>
          </div>
          <div class="actions">
            <button class="danger" data-photo-action="delete" data-photo="${encodeURIComponent(p.filename)}" data-gallery="${galleryId}">Delete</button>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err: any) {
    list.innerHTML = '';
    setStatus(err.message || 'Failed to load photos', true);
  }
}

function bindPhotoActions() {
  const list = document.getElementById('photo-list');
  if (!list) return;
  list.addEventListener('click', async (e) => {
    const el = e.target as HTMLElement;
    const action = el.getAttribute('data-photo-action');
    if (action !== 'delete') return;
    const galleryId = el.getAttribute('data-gallery') || '';
    const filenameEnc = el.getAttribute('data-photo') || '';
    const filename = decodeURIComponent(filenameEnc);
    if (!galleryId || !filename) return;
    try {
      await api(`/admin/gallery/${galleryId}/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setStatus('Deleted photo.');
      await loadPhotos(galleryId);
    } catch (err: any) {
      setStatus(err.message || 'Delete failed', true);
    }
  });
}

function bindUpload() {
  const form = document.getElementById('photo-upload-form') as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const galleryId = (document.getElementById('photo-gallery-id') as HTMLInputElement | null)?.value.trim();
    const filesInput = document.getElementById('photo-files') as HTMLInputElement | null;
    const makeCover = (document.getElementById('make-cover') as HTMLInputElement | null)?.checked;
    if (!galleryId) return setStatus('Pick a gallery first (Manage photos).', true);
    if (!filesInput?.files || filesInput.files.length === 0) return setStatus('Select at least one file.', true);

    const fd = new FormData();
    Array.from(filesInput.files).forEach((f) => fd.append('files', f));
    if (makeCover) fd.set('makeCover', '1');

    try {
      setStatus('Uploading...');
      const res = await fetch(`${apiBase}/admin/gallery/${galleryId}/photos`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      if (res.status === 401) throw new Error('Unauthorized');
      if (!res.ok) throw new Error(await res.text());
      setStatus('Uploaded.');
      form.reset();
      await loadPhotos(galleryId);
    } catch (err: any) {
      setStatus(err.message || 'Upload failed', true);
    }
  });
}

function bindCreate() {
  const form = qs('create-form') as HTMLFormElement | null;
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = (qs('title') as HTMLInputElement).value.trim();
    const id = (qs('slug') as HTMLInputElement).value.trim();
    if (!title || !id) return setStatus('Title and slug required', true);
    try {
      await api('/admin/gallery', {
        method: 'POST',
        body: JSON.stringify({ title, id, createdAt: new Date().toISOString(), visible: true }),
      });
      setStatus('Created gallery');
      form.reset();
      await loadGalleries();
    } catch (err: any) {
      setStatus(err.message || 'Create failed', true);
    }
  });
}

function boot() {
  bindLogin();
  bindCreate();
  bindActions();
  bindPhotoActions();
  bindUpload();
  if (!token) showLogin(true);
  loadGalleries();
}

document.addEventListener('DOMContentLoaded', boot);
