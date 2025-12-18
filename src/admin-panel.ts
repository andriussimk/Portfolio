import './styles/base.css';
import './styles/layout.css';

const apiBase = '/api';
const TOKEN_KEY = 'admin_token';
let token = localStorage.getItem(TOKEN_KEY) || '';

type Gallery = { id: string; title: string; visible: boolean };
type Photo = { filename: string; url: string; thumbUrl?: string; order?: number };

let selectedGallery: Gallery | null = null;

function resetUploadForm() {
  const form = document.getElementById('photo-upload-form') as HTMLFormElement | null;
  const filesInput = document.getElementById('photo-files') as HTMLInputElement | null;
  // form.reset() doesn't reliably clear file inputs across all browsers, so also clear value.
  if (form) form.reset();
  if (filesInput) filesInput.value = '';
}

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
  if (res.status === 401) {
    // Nudge user toward token field
    const tokenInput = document.getElementById('token-input') as HTMLInputElement | null;
    if (tokenInput) {
      tokenInput.classList.add('invalid');
      tokenInput.focus();
      setTimeout(() => tokenInput.classList.remove('invalid'), 1400);
    }
    applyAuthUI();
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fileToJpegThumb(file: File, opts: { maxSize: number; quality: number }): Promise<Blob | null> {
  if (!file.type.startsWith('image/')) return null;

  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });

    const maxSize = Math.max(1, opts.maxSize);
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', opts.quality)
    );
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
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

function setAuthPill() {
  const pill = qs('auth-pill');
  if (!pill) return;
  pill.textContent = token ? 'Token set' : 'No token';
}

function applyAuthUI() {
  const adminOnly = document.getElementById('admin-only') as HTMLElement | null;
  if (adminOnly) adminOnly.style.display = token ? 'block' : 'none';

  if (!token) {
    setSelectedGallery(null);
    const list = document.getElementById('gallery-list') as HTMLElement | null;
    if (list) list.innerHTML = '<div class="muted" style="padding: 8px 4px;">Sign in to manage galleries.</div>';
  }

  setAuthPill();
}

function setSelectedGallery(g: Gallery | null) {
  selectedGallery = g;
  const titleEl = qs('selected-title');
  const subEl = qs('selected-subtitle');
  const visWrap = qs('visibility-wrap') as HTMLElement | null;
  const visSwitch = qs('visibility-switch') as HTMLInputElement | null;
  const delBtn = qs('delete-gallery-btn') as HTMLButtonElement | null;
  const photoWrap = qs('photo-manager') as HTMLElement | null;
  const gid = qs('photo-gallery-id') as HTMLInputElement | null;
  const photoList = qs('photo-list') as HTMLElement | null;

  if (!g) {
    if (titleEl) titleEl.textContent = 'Select a gallery';
    if (subEl) subEl.textContent = 'Pick one from the left to manage photos';
    if (visWrap) visWrap.style.display = 'none';
    if (delBtn) delBtn.style.display = 'none';
    if (photoWrap) photoWrap.style.display = 'none';
    if (gid) gid.value = '';
    if (photoList) photoList.innerHTML = '';
    resetUploadForm();
    return;
  }

  if (titleEl) titleEl.textContent = g.title;
  if (subEl) subEl.textContent = g.id;
  if (visWrap) visWrap.style.display = 'flex';
  if (visSwitch) visSwitch.checked = g.visible !== false;
  if (delBtn) delBtn.style.display = 'inline-block';
  if (photoWrap) photoWrap.style.display = 'block';
  if (gid) gid.value = g.id;

  // Important UX: switching galleries should not keep the previously selected files.
  resetUploadForm();
}

// Login modal flow removed in favor of the sidebar token input.

function bindTokenSidebar() {
  const input = qs('token-input') as HTMLInputElement | null;
  const save = qs('token-save') as HTMLButtonElement | null;
  const clear = qs('token-clear') as HTMLButtonElement | null;
  const pill = qs('auth-pill');

  const syncPill = () => {
    if (!pill) return;
    pill.textContent = token ? 'Token set' : 'No token';
  };

  if (input) input.value = token;
  syncPill();
  applyAuthUI();

  const applyToken = () => {
    if (!input) return;
    token = input.value.trim();
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    syncPill();
    applyAuthUI();
  };

  if (save) save.addEventListener('click', async () => {
    applyToken();
    setStatus(token ? 'Token saved.' : 'Token cleared.');
    await loadGalleries();
  });

  if (clear) clear.addEventListener('click', async () => {
    if (input) input.value = '';
    applyToken();
    setSelectedGallery(null);
    setStatus('Token cleared.');
  });

  if (input) {
    input.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      applyToken();
      await loadGalleries();
    });
  }
}

async function loadGalleries() {
  try {
    applyAuthUI();
    if (!token) {
      setStatus('Paste admin token to continue.', true);
      return;
    }

    setStatus('Loading galleries...');
    const data = await api('/admin/galleries');
    const list = qs('gallery-list');
    if (!list) return;

    const galleries: Gallery[] = (data.galleries || []).map((g: any) => ({
      id: String(g.id),
      title: String(g.title),
      visible: g.visible !== false,
    }));

    if (!galleries.length) {
      list.innerHTML = '<div class="muted" style="padding: 8px 4px;">No galleries yet.</div>';
      setSelectedGallery(null);
      setStatus('Loaded.');
      return;
    }

    list.innerHTML = galleries
      .map(
        (g) => `
        <div class="gallery-item ${selectedGallery?.id === g.id ? 'active' : ''}" data-action="select" data-id="${g.id}">
          <div class="gallery-meta">
            <div class="gallery-title">${g.title}</div>
            <div class="gallery-id">${g.id}</div>
          </div>
          <div class="pill" style="${g.visible ? 'color: var(--ok);' : ''}">${g.visible ? 'Visible' : 'Hidden'}</div>
        </div>
      `
      )
      .join('');

    // Refresh selected gallery object + photos if needed
    if (selectedGallery) {
      const found = galleries.find((gg) => gg.id === selectedGallery?.id) || null;
      setSelectedGallery(found);
      if (found) await loadPhotos(found.id);
    } else {
      setSelectedGallery(null);
    }

    setStatus('Loaded.');
  } catch (err: any) {
    if (err.message === 'Unauthorized') {
      setStatus('Unauthorized — paste admin token in the sidebar.', true);
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
      if (action === 'select') {
        // Find title from DOM
        const title = (target.closest('.gallery-item')?.querySelector('.gallery-title') as HTMLElement | null)
          ?.textContent?.trim();
        setSelectedGallery({ id, title: title || id, visible: true });
        await loadPhotos(id);

        for (const el of Array.from(list.querySelectorAll('.gallery-item'))) {
          el.classList.toggle('active', el.getAttribute('data-id') === id);
        }
      }
    } catch (err: any) {
      setStatus(err.message || 'Action failed', true);
    }
  });
}

function authHeadersForUpload(): Record<string, string> {
  // IMPORTANT: don't set content-type for FormData; the browser will set boundary.
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadPhotos(galleryId: string) {
  const wrap = document.getElementById('photo-manager');
  const list = document.getElementById('photo-list');
  if (wrap) wrap.style.display = 'block';
  if (!list) return;
  list.innerHTML = '<div class="muted">Loading...</div>';
  try {
    const data = await api(`/admin/gallery/${galleryId}/photos`);
    const photos: Photo[] = (data.photos || []).map((p: any) => ({
      filename: String(p.filename),
      url: String(p.url),
      thumbUrl: p.thumbUrl ? String(p.thumbUrl) : undefined,
      order: p.order ?? 0,
    }));
    if (!photos.length) {
      list.innerHTML = '<div class="muted">No photos yet.</div>';
      return;
    }
    list.innerHTML = photos
      .map(
        (p) => `
        <div class="photo-card">
          <img src="${p.thumbUrl || p.url}" alt="${p.filename}" />
          <div class="photo-meta">
            <div class="name">${p.filename}</div>
            <button class="btn danger small" data-photo-action="delete" data-photo="${encodeURIComponent(p.filename)}" data-gallery="${galleryId}">Delete</button>
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
      const ok = window.confirm(`Delete photo "${filename}"?`);
      if (!ok) return;
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

  const filesInput = document.getElementById('photo-files') as HTMLInputElement | null;
  if (filesInput) {
    // If user changes selection then switches galleries, our resetUploadForm clears it.
    // This handler just ensures the UI stays consistent if we ever add custom labels.
    filesInput.addEventListener('change', () => {
      // no-op placeholder for future enhancements
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const galleryId = (document.getElementById('photo-gallery-id') as HTMLInputElement | null)?.value.trim();
    const filesInput = document.getElementById('photo-files') as HTMLInputElement | null;
    const makeCover = (document.getElementById('make-cover') as HTMLInputElement | null)?.checked;
    if (!galleryId) return setStatus('Pick a gallery first (Manage photos).', true);
    if (!filesInput?.files || filesInput.files.length === 0) return setStatus('Select at least one file.', true);

    const files = Array.from(filesInput.files);

    try {
      setStatus(`Uploading 0/${files.length}...`);
      const uploadBtn = qs('upload-btn') as HTMLButtonElement | null;
      if (uploadBtn) uploadBtn.disabled = true;

      // Upload sequentially so large batches show steady progress and are less likely to time out.
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        const file = files[i];
        fd.append('files', file);

        // Generate and attach a JPEG thumbnail for faster gallery listing loads (Option 2).
        // If it fails for any reason, we still upload the original.
        try {
          const thumb = await fileToJpegThumb(file, { maxSize: 900, quality: 0.72 });
          if (thumb) fd.append('thumbs', thumb, `${file.name}.jpg`);
        } catch {
          // ignore thumbnail errors
        }
        // If requested, ask the API to use the first uploaded file as the cover (if none exists).
        if (makeCover && i === 0) fd.set('makeCover', '1');

        setStatus(`Uploading ${i}/${files.length}...`);
        const res = await fetch(`${apiBase}/admin/gallery/${galleryId}/photos`, {
          method: 'POST',
          headers: authHeadersForUpload(),
          body: fd,
        });
        if (res.status === 401) throw new Error('Unauthorized');
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Upload failed (${res.status})`);
        }
      }

      setStatus(`Uploaded ${files.length}/${files.length}.`);
      resetUploadForm();
      await loadPhotos(galleryId);
    } catch (err: any) {
      setStatus(err.message || 'Upload failed', true);
    } finally {
      const uploadBtn = qs('upload-btn') as HTMLButtonElement | null;
      if (uploadBtn) uploadBtn.disabled = false;
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
      const btn = qs('create-btn') as HTMLButtonElement | null;
      if (btn) btn.disabled = true;
      await api('/admin/gallery', {
        method: 'POST',
        body: JSON.stringify({ title, id, createdAt: new Date().toISOString(), visible: true }),
      });
      setStatus('Created gallery');
      form.reset();
      await loadGalleries();
    } catch (err: any) {
      setStatus(err.message || 'Create failed', true);
    } finally {
      const btn = qs('create-btn') as HTMLButtonElement | null;
      if (btn) btn.disabled = false;
    }
  });
}

function bindHeaderActions() {
  const refresh = qs('refresh-btn');
  if (refresh) refresh.addEventListener('click', () => loadGalleries());

  const vis = qs('visibility-switch') as HTMLInputElement | null;
  if (vis) {
    vis.addEventListener('change', async () => {
      if (!selectedGallery) return;
      const next = vis.checked;
      try {
        setStatus('Updating visibility...');
        await api(`/admin/gallery/${selectedGallery.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ visible: next }),
        });
        selectedGallery.visible = next;
        setStatus('Updated visibility.');
        await loadGalleries();
      } catch (err: any) {
        vis.checked = selectedGallery.visible !== false;
        setStatus(err.message || 'Visibility update failed', true);
      }
    });
  }

  const del = qs('delete-gallery-btn') as HTMLButtonElement | null;
  if (del) {
    del.addEventListener('click', async () => {
      if (!selectedGallery) return;
      const ok = window.confirm(
        `Delete gallery "${selectedGallery.title}" (${selectedGallery.id})?\n\nThis removes the gallery + DB entries and deletes its R2 objects.`
      );
      if (!ok) return;
      try {
        del.disabled = true;
        setStatus('Deleting gallery...');
        await api(`/admin/gallery/${selectedGallery.id}`, { method: 'DELETE' });
        setSelectedGallery(null);
        await loadGalleries();
        setStatus('Gallery deleted.');
      } catch (err: any) {
        setStatus(err.message || 'Delete failed', true);
      } finally {
        del.disabled = false;
      }
    });
  }
}

function boot() {
  bindTokenSidebar();
  bindCreate();
  bindActions();
  bindPhotoActions();
  bindUpload();
  bindHeaderActions();
  setSelectedGallery(null);
  applyAuthUI();
  if (token) loadGalleries();
}

document.addEventListener('DOMContentLoaded', boot);
