import './styles/base.css';
import './styles/layout.css';

const apiBase = '/api';
const TOKEN_KEY = 'admin_token';
let token = localStorage.getItem(TOKEN_KEY) || '';

type Gallery = { id: string; title: string; visible: boolean; zipEnabled: boolean; sortOrder?: number };
type Photo = { filename: string; url: string; thumbUrl?: string; order?: number };
type PageContent = { content: string; updatedAt?: string | null };
type Contacts = { email?: string | null; phone?: string | null; instagram?: string | null; facebook?: string | null; updated_at?: string | null };

type AllowedTag = 'p' | 'br' | 'strong' | 'b' | 'em' | 'i' | 'u' | 'h2' | 'h3' | 'ul' | 'ol' | 'li' | 'blockquote' | 'a' | 'span' | 'div';

const SANITIZE_ALLOWED_TAGS: Set<AllowedTag> = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'span',
  'div',
]);


function sanitizeHtml(input: string): string {
  if (!input) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');

  const walk = (parent: Node) => {
    const children = Array.from(parent.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        parent.removeChild(child);
        continue;
      }
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase() as AllowedTag;
      if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
        // unwrap disallowed elements but keep their children
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }

      // Strip disallowed attributes
      const allowedAttrs = tag === 'a' ? ['href', 'target', 'rel'] : tag === 'span' ? ['style'] : [];
      for (const attr of Array.from(el.attributes)) {
        if (!allowedAttrs.includes(attr.name)) el.removeAttribute(attr.name);
      }

      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        const safeHref = href && /^(https?:|mailto:|tel:)/i.test(href) ? href : '';
        if (safeHref) {
          el.setAttribute('href', safeHref);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noreferrer noopener');
        } else {
          el.removeAttribute('href');
        }
      }

      if (tag === 'span') {
        const style = el.getAttribute('style') || '';
        const match = style.match(/font-size\s*:\s*([0-9.]+(px|rem|em|%))/i);
        if (match) {
          el.setAttribute('style', `font-size:${match[1]}`);
        } else {
          el.removeAttribute('style');
        }
      }

      // Normalize div to paragraph for cleaner output
      if (tag === 'div') {
        const p = doc.createElement('p');
        while (el.firstChild) p.appendChild(el.firstChild);
        parent.replaceChild(p, el);
        walk(p);
        continue;
      }

      walk(el);
    }
  };

  walk(doc.body);
  return doc.body.innerHTML.trim();
}

let selectedGallery: Gallery | null = null;
let galleriesState: Gallery[] = [];

function renderGalleryList(galleries: Gallery[]) {
  const list = qs('gallery-list');
  if (!list) return;
  if (!galleries.length) {
    list.innerHTML = '<div class="muted" style="padding: 8px 4px;">No galleries yet.</div>';
    return;
  }
  list.innerHTML = galleries
    .map(
      (g, idx) => `
        <div class="gallery-item ${selectedGallery?.id === g.id ? 'active' : ''}" data-action="select" data-id="${g.id}">
          <div class="gallery-meta">
            <div class="gallery-title">${g.title}</div>
            <div class="gallery-id">${g.id}</div>
            <div class="muted" style="font-size:12px;">Order: ${g.sortOrder ?? idx + 1}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <div class="pill" style="${g.visible ? 'color: var(--ok);' : ''}">${g.visible ? 'Visible' : 'Hidden'}</div>
            <button class="btn small" data-action="reorder-up" data-id="${g.id}" aria-label="Move up">↑</button>
            <button class="btn small" data-action="reorder-down" data-id="${g.id}" aria-label="Move down">↓</button>
          </div>
        </div>
      `
    )
    .join('');
}

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
  if (!res.ok) {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    throw new Error(res.statusText || `Request failed (${res.status})`);
  }
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

function logEvent(type: 'success' | 'info' | 'error' | 'warn', message: string) {
  const colors: Record<typeof type, string> = {
    success: 'background: #163300; color: #b7ff80; padding:2px 6px; border-radius:6px;',
    info: 'background: #002b36; color: #7dd3fc; padding:2px 6px; border-radius:6px;',
    warn: 'background: #331b00; color: #ffdd8a; padding:2px 6px; border-radius:6px;',
    error: 'background: #330000; color: #ff9aa2; padding:2px 6px; border-radius:6px;',
  } as const;
  // eslint-disable-next-line no-console
  console.log(`%c${message}`, colors[type]);
}

function setAuthPill() {
  const pill = qs('auth-pill');
  if (!pill) return;
  pill.textContent = token ? 'Logged in' : 'Not signed in';
}

function applyAuthUI() {
  const authed = !!token;
  document.body.classList.toggle('authed', authed);

  const protectedEls = document.querySelectorAll('[data-requires-auth]');
  protectedEls.forEach((el) => {
    (el as HTMLElement).style.display = authed ? '' : 'none';
  });

  const authAccordion = document.getElementById('auth-accordion') as HTMLElement | null;
  if (authAccordion) authAccordion.style.display = authed ? 'none' : 'block';

  const authLogged = document.getElementById('auth-logged') as HTMLElement | null;
  if (authLogged) authLogged.style.display = authed ? 'flex' : 'none';

  if (!authed) {
    setSelectedGallery(null);
    const list = document.getElementById('gallery-list') as HTMLElement | null;
    if (list) list.innerHTML = '<div class="muted" style="padding: 8px 4px;">Sign in to manage galleries.</div>';
    // Close accordions on logout
    document.querySelectorAll('details.accordion, details.sub-accordion').forEach((d) => {
      (d as HTMLDetailsElement).open = false;
    });
  }

  setAuthPill();
}

function setSelectedGallery(g: Gallery | null) {
  selectedGallery = g;
  const titleEl = qs('selected-title');
  const subEl = qs('selected-subtitle');
  const visWrap = qs('visibility-wrap') as HTMLElement | null;
  const visSwitch = qs('visibility-switch') as HTMLInputElement | null;
  const zipWrap = qs('zip-wrap') as HTMLElement | null;
  const zipSwitch = qs('zip-switch') as HTMLInputElement | null;
  const delBtn = qs('delete-gallery-btn') as HTMLButtonElement | null;
  const photoWrap = qs('photo-manager') as HTMLElement | null;
  const gid = qs('photo-gallery-id') as HTMLInputElement | null;
  const photoList = qs('photo-list') as HTMLElement | null;

  if (!g) {
    if (titleEl) titleEl.textContent = 'Select a gallery';
    if (subEl) subEl.textContent = 'Pick one from the left to manage photos';
    if (visWrap) visWrap.style.display = 'none';
    if (zipWrap) zipWrap.style.display = 'none';
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
  if (zipWrap) zipWrap.style.display = 'flex';
  if (zipSwitch) zipSwitch.checked = g.zipEnabled !== false;
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
  const logout = qs('token-logout') as HTMLButtonElement | null;

  if (input) input.value = token;
  applyAuthUI();

  const saveToken = async () => {
    if (!input) return;
    token = input.value.trim();
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      setStatus('Logged in.');
      logEvent('success', 'Auth: logged in');
      applyAuthUI();
      await loadGalleries();
      await loadAbout();
      await loadContacts();
    } else {
      localStorage.removeItem(TOKEN_KEY);
      applyAuthUI();
      setStatus('Token missing.', true);
      logEvent('error', 'Auth: token missing');
    }
  };

  const clearToken = () => {
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    if (input) input.value = '';
    applyAuthUI();
    setSelectedGallery(null);
    setStatus('Logged out.');
    logEvent('info', 'Auth: logged out');
  };

  if (save) save.addEventListener('click', saveToken);
  if (logout) logout.addEventListener('click', clearToken);

  if (input) {
    input.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await saveToken();
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
    const galleries: Gallery[] = (data.galleries || [])
      .map((g: any, idx: number) => ({
        id: String(g.id),
        title: String(g.title),
        visible: g.visible !== false,
        zipEnabled: g.zipEnabled !== false,
        sortOrder: g.sortOrder ?? idx + 1,
      }))
      .sort((a: Gallery, b: Gallery) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.title.localeCompare(b.title));

    galleriesState = galleries;

    renderGalleryList(galleriesState);

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
    const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;
    try {
      if (action === 'reorder-up' || action === 'reorder-down') {
        e.stopPropagation();
        const idx = galleriesState.findIndex((g) => g.id === id);
        if (idx === -1) return;
        const swapWith = action === 'reorder-up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= galleriesState.length) return;
        const next = [...galleriesState];
        const [moved] = next.splice(idx, 1);
        next.splice(swapWith, 0, moved);
        galleriesState = next.map((g, i) => ({ ...g, sortOrder: i + 1 }));
        renderGalleryList(galleriesState);
        await api('/admin/galleries/order', {
          method: 'PUT',
          body: JSON.stringify({ order: galleriesState.map((g) => g.id) }),
        });
        setStatus('Order saved.');
        return;
      }

      if (action === 'select') {
        // Find title from DOM
        const title = (target.closest('.gallery-item')?.querySelector('.gallery-title') as HTMLElement | null)
          ?.textContent?.trim();
        // We don't have zipEnabled in the DOM list; it will be refreshed via loadGalleries()
        // after toggles anyway. Default to true when selecting by click.
        setSelectedGallery({ id, title: title || id, visible: true, zipEnabled: true });
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

/* --------- CMS: pages & contacts --------- */
function ensureCmsSections() {
  const aside = document.querySelector('.admin-shell aside.panel');
  if (!aside) return;

  let pagesAccordion = document.getElementById('pages-accordion');
  if (!pagesAccordion) {
    const details = document.createElement('details');
    details.className = 'accordion';
    details.id = 'pages-accordion';
    details.dataset.requiresAuth = 'true';
    details.open = false;
    details.innerHTML = `<summary><span class="label">Pages</span><span class="chevron" aria-hidden="true"></span></summary><div class="accordion-body" id="pages-body"></div>`;
    aside.appendChild(details);
    pagesAccordion = details;
  }

  const pagesBody = document.getElementById('pages-body');
  if (!pagesBody) return;

  if (!document.getElementById('about-accordion')) {
    const details = document.createElement('details');
    details.className = 'sub-accordion';
    details.id = 'about-accordion';
  details.open = false;
    details.innerHTML = `
      <summary><span class="label" style="font-weight:600;">About page</span><span class="chevron" aria-hidden="true"></span></summary>
      <div class="accordion-body" style="padding:0 12px 12px;">
        <div class="rich-editor" id="about-editor-wrap">
          <div class="rich-editor__toolbar" id="about-toolbar" aria-label="Formatting toolbar">
            <div class="toolbar-row">
              <button class="btn tiny" type="button" data-cmd="bold" title="Bold (Cmd/Ctrl+B)"><strong>B</strong></button>
              <button class="btn tiny" type="button" data-cmd="italic" title="Italic (Cmd/Ctrl+I)"><em>I</em></button>
              <button class="btn tiny" type="button" data-cmd="underline" title="Underline"><span style="text-decoration:underline;">U</span></button>
              <div class="divider"></div>
              <button class="btn tiny" type="button" data-cmd="h2" title="Heading 2">H2</button>
              <button class="btn tiny" type="button" data-cmd="h3" title="Heading 3">H3</button>
              <button class="btn tiny" type="button" data-cmd="p" title="Paragraph">P</button>
              <div class="divider"></div>
              <button class="btn tiny" type="button" data-cmd="ul" title="Bullet list">• List</button>
              <button class="btn tiny" type="button" data-cmd="ol" title="Numbered list">1. List</button>
              <button class="btn tiny" type="button" data-cmd="quote" title="Quote">“”</button>
              <button class="btn tiny" type="button" data-cmd="link" title="Insert link">Link</button>
              <button class="btn tiny" type="button" data-cmd="clear" title="Clear formatting">Clear</button>
            </div>
          </div>
          <div id="about-editor" class="rich-editor__area" contenteditable="true" aria-label="About content" data-placeholder="Write about content..."></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:10px; flex-wrap:wrap;">
          <button class="btn small" type="button" id="about-save">Save About</button>
          <div class="muted" id="about-updated" style="font-size:12px;"></div>
        </div>
      </div>
    `;
    pagesBody.appendChild(details);
  }

  if (!document.getElementById('contacts-accordion')) {
    const details = document.createElement('details');
    details.className = 'sub-accordion';
    details.id = 'contacts-accordion';
    details.open = false;
    details.innerHTML = `
      <summary><span class="label" style="font-weight:600;">Contacts page</span><span class="chevron" aria-hidden="true"></span></summary>
      <div class="accordion-body" style="padding:0 12px 12px;">
        <div class="grid-2">
          <div class="field">
            <div class="label">Email</div>
            <input class="input" id="contacts-email" placeholder="hello@shotbyandrius.com" />
          </div>
          <div class="field">
            <div class="label">Phone</div>
            <input class="input" id="contacts-phone" placeholder="+370..." />
          </div>
          <div class="field">
            <div class="label">Instagram URL</div>
            <input class="input" id="contacts-instagram" placeholder="https://instagram.com/..." />
          </div>
          <div class="field">
            <div class="label">Facebook URL</div>
            <input class="input" id="contacts-facebook" placeholder="https://facebook.com/..." />
          </div>
        </div>
        <button class="btn small" type="button" id="contacts-save">Save Contacts</button>
      </div>
    `;
    pagesBody.appendChild(details);
  }

  // Re-apply auth visibility in case sections were created after initial toggle
  applyAuthUI();
}

function applyToolbarCommand(editor: HTMLElement, cmd: string) {
  editor.focus();
  if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') {
    document.execCommand(cmd);
    return;
  }
  if (cmd === 'ul') {
    document.execCommand('insertUnorderedList');
    return;
  }
  if (cmd === 'ol') {
    document.execCommand('insertOrderedList');
    return;
  }
  if (cmd === 'quote') {
    document.execCommand('formatBlock', false, 'blockquote');
    return;
  }
  if (cmd === 'h2' || cmd === 'h3' || cmd === 'p') {
    document.execCommand('formatBlock', false, cmd === 'p' ? 'p' : cmd);
    return;
  }
  if (cmd === 'link') {
    const raw = window.prompt('Enter URL (https://, mailto:, or tel:)', 'https://');
    if (!raw) return;
    const safe = /^(https?:|mailto:|tel:)/i.test(raw.trim()) ? raw.trim() : '';
    if (!safe) return;
    document.execCommand('createLink', false, safe);
    return;
  }
  if (cmd === 'clear') {
    document.execCommand('removeFormat');
    document.execCommand('formatBlock', false, 'p');
  }
}

function bindAboutEditor() {
  const editor = document.getElementById('about-editor') as HTMLElement | null;
  const toolbar = document.getElementById('about-toolbar');
  if (!editor || !toolbar) return;

  toolbar.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-cmd]') as HTMLButtonElement | null;
    if (!btn) return;
    const cmd = btn.dataset.cmd || '';
    applyToolbarCommand(editor, cmd);
    editor.dispatchEvent(new Event('input'));
  });
}

async function loadAbout() {
  const el = qs('about-editor') as HTMLElement | null;
  const meta = qs('about-updated') as HTMLElement | null;
  if (!el) return;
  try {
    const res = await api('/pages/about', { method: 'GET', headers: { ...authHeaders(), 'content-type': 'application/json' } });
    const safe = sanitizeHtml(res.content || '');
    el.innerHTML = safe || '';
    if (meta && res.updatedAt) meta.textContent = `Last updated ${new Date(res.updatedAt).toLocaleString()}`;
  } catch {
    el.innerHTML = el.innerHTML || '';
  }
}

async function saveAbout() {
  const el = qs('about-editor') as HTMLElement | null;
  const meta = qs('about-updated') as HTMLElement | null;
  if (!el) return;
  const raw = el.innerHTML.trim();
  const content = sanitizeHtml(raw);
  const plain = el.textContent?.trim() || '';
  if (!plain) return setStatus('About content is empty', true);
  const res = await api('/admin/page/about', { method: 'PUT', body: JSON.stringify({ content }) });
  setStatus('About saved.');
  if (meta && res?.updatedAt) meta.textContent = `Last updated ${new Date(res.updatedAt).toLocaleString()}`;
  logEvent('success', 'About page saved');
}

async function loadContacts() {
  const email = qs('contacts-email') as HTMLInputElement | null;
  const phone = qs('contacts-phone') as HTMLInputElement | null;
  const ig = qs('contacts-instagram') as HTMLInputElement | null;
  const fb = qs('contacts-facebook') as HTMLInputElement | null;
  if (!email || !phone || !ig || !fb) return;
  try {
    const res = await api('/admin/contacts');
    const c: Contacts | null = res.contacts || null;
    if (!c) return;
    email.value = c.email || '';
    phone.value = c.phone || '';
    ig.value = c.instagram || '';
    fb.value = c.facebook || '';
  } catch {
    /* ignore */
  }
}

async function saveContacts() {
  const email = (qs('contacts-email') as HTMLInputElement | null)?.value.trim();
  const phone = (qs('contacts-phone') as HTMLInputElement | null)?.value.trim();
  const instagram = (qs('contacts-instagram') as HTMLInputElement | null)?.value.trim();
  const facebook = (qs('contacts-facebook') as HTMLInputElement | null)?.value.trim();
  await api('/admin/contacts', { method: 'PUT', body: JSON.stringify({ email, phone, instagram, facebook }) });
  setStatus('Contacts saved.');
  logEvent('success', 'Contacts saved');
}

function bindCms() {
  ensureCmsSections();
  bindAboutEditor();
  const aboutBtn = qs('about-save');
  if (aboutBtn) aboutBtn.addEventListener('click', () => saveAbout());
  const contactBtn = qs('contacts-save');
  if (contactBtn) contactBtn.addEventListener('click', () => saveContacts());
}

/* --------- Analytics --------- */
function ensureAnalyticsSection() {
  const aside = document.querySelector('.admin-shell aside.panel');
  if (!aside) return;
  if (qs('analytics-section')) return;
  const wrap = document.createElement('div');
  wrap.dataset.requiresAuth = 'true';
  wrap.id = 'analytics-section';
  wrap.innerHTML = `
    <details class="accordion">
      <summary><span class="label">Analytics</span><span class="chevron" aria-hidden="true"></span></summary>
      <div class="accordion-body">
        <div class="statusbar" style="margin-top:0;">
          <div class="status" id="analytics-status">Page views.</div>
          <button class="btn small" id="analytics-refresh" type="button">Refresh</button>
        </div>
        <div style="overflow:auto; margin-top:10px;">
          <table id="analytics-table" style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="text-align:left; border-bottom:1px solid var(--line);">
                <th style="padding:6px 4px;">Collection</th>
                <th style="padding:6px 4px;">Views</th>
                <th style="padding:6px 4px;">Last viewed</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </details>
  `;
  aside.appendChild(wrap);
}

async function loadAnalytics() {
  const table = qs('analytics-table') as HTMLTableElement | null;
  const statusEl = qs('analytics-status');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  try {
    if (statusEl) statusEl.textContent = 'Loading...';
    const res = await api('/admin/analytics/collection-views');
    const stats: Array<{ id: string; title: string; views: number; lastViewed: string | null }> = res.stats || [];
    if (!stats.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="padding:8px 4px;" class="muted">No data yet</td></tr>';
    } else {
      tbody.innerHTML = stats
        .map(
          (s) => `
            <tr>
              <td style="padding:8px 4px;">${s.title} <div class="muted" style="font-size:11px;">${s.id}</div></td>
              <td style="padding:8px 4px;">${s.views}</td>
              <td style="padding:8px 4px;">${s.lastViewed ? new Date(s.lastViewed).toLocaleString() : '—'}</td>
            </tr>
          `
        )
        .join('');
    }
    if (statusEl) statusEl.textContent = 'Views loaded.';
  } catch (err: any) {
    if (statusEl) statusEl.textContent = err.message || 'Analytics error';
  }
}

function bindAnalytics() {
  ensureAnalyticsSection();
  const btn = qs('analytics-refresh');
  if (btn) btn.addEventListener('click', () => loadAnalytics());

  const accordion = document.querySelector('#analytics-section details.accordion') as HTMLDetailsElement | null;
  if (accordion) {
    accordion.addEventListener('toggle', () => {
      if (accordion.open) loadAnalytics();
    });
  }
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
        body: JSON.stringify({ title, id, createdAt: new Date().toISOString(), visible: true, zipEnabled: true }),
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

  const zip = qs('zip-switch') as HTMLInputElement | null;
  if (zip) {
    zip.addEventListener('change', async () => {
      if (!selectedGallery) return;
      const next = zip.checked;
      try {
        setStatus('Updating ZIP setting...');
        await api(`/admin/gallery/${selectedGallery.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ zipEnabled: next }),
        });
        selectedGallery.zipEnabled = next;
        setStatus('Updated ZIP setting.');
        await loadGalleries();
      } catch (err: any) {
        zip.checked = selectedGallery.zipEnabled !== false;
        setStatus(err.message || 'ZIP setting update failed', true);
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
  ensureAnalyticsSection();
  bindTokenSidebar();
  bindCreate();
  bindActions();
  bindPhotoActions();
  bindUpload();
  bindHeaderActions();
  bindCms();
  bindAnalytics();
  setSelectedGallery(null);
  applyAuthUI();
  if (token) {
    // Start with accordions closed; user can open.
    document.querySelectorAll('details.accordion, details.sub-accordion').forEach((d) => {
      (d as HTMLDetailsElement).open = false;
    });
    loadGalleries();
    loadAbout();
    loadContacts();
  }
}

document.addEventListener('DOMContentLoaded', boot);
