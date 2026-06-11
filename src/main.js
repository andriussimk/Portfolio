/* Front-end script */

import { cfImageUrl } from './utils/cf-image';

const SITE = { name: "Shot by Andrius", owner: "Andrius Šimkus" };
const API_BASE = "/api";
const IMG_ROOT = "/images"; // changed to R2 storage now
const HOME_SHOWCASE_KEYS = Array.from({ length: 8 }, (_, i) => `home-showcase-${i + 1}`);

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function safeUrl(value, protocols = ['http:', 'https:']){
  if(!value) return '';
  try{
    const url = new URL(String(value), window.location.origin);
    return protocols.includes(url.protocol) ? url.href : '';
  }catch{
    return '';
  }
}

function withToken(url, token){
  if(!token) return url;
  if(/[?&]token=/.test(url)) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}token=${encodeURIComponent(token)}`;
}

function bindCoverCardLoading(root){
  if(!root) return;
  root.querySelectorAll('.gallery-card img').forEach((img)=>{
    const card = img.closest('.gallery-card');
    if(!card) return;

    card.classList.add('is-loading');
    const markReady = ()=> card.classList.remove('is-loading');
    const onError = ()=>{
      const fallback = img.getAttribute('data-orig');
      const alreadyRetried = img.dataset.fallbackTried === '1';
      const currentSrc = img.getAttribute('src') || '';
      const canRetry = !!fallback && !alreadyRetried && currentSrc !== fallback;
      if(canRetry){
        img.dataset.fallbackTried = '1';
        img.src = fallback;
        return;
      }
      img.removeEventListener('error', onError);
      markReady();
    };

    img.addEventListener('load', markReady, { once:true });
    img.addEventListener('error', onError);

    if(img.complete){
      if((img.naturalWidth || 0) > 0) markReady();
    }
  });
}

// Simple allowlist sanitizer for CMS-driven HTML
const ALLOWED_TAGS = new Set(['p','br','strong','b','em','i','u','h2','h3','ul','ol','li','blockquote','a','span']);
function sanitizePublicHtml(input){
  if(!input) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  const walk = (parent)=>{
    const kids = Array.from(parent.childNodes);
    for(const child of kids){
      if(child.nodeType === Node.TEXT_NODE) continue;
      if(child.nodeType !== Node.ELEMENT_NODE){ parent.removeChild(child); continue; }
      const el = child;
      const tag = el.tagName.toLowerCase();
      if(!ALLOWED_TAGS.has(tag)){
        while(el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
        continue;
      }
      const allowedAttrs = tag === 'a' ? ['href','target','rel'] : tag === 'span' ? ['style'] : [];
      for(const attr of Array.from(el.attributes)){
        if(!allowedAttrs.includes(attr.name)) el.removeAttribute(attr.name);
      }
      if(tag === 'a'){
        const href = el.getAttribute('href') || '';
        const safe = href && /^(https?:|mailto:|tel:)/i.test(href) ? href : '';
        if(safe){
          el.setAttribute('href', safe);
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noreferrer noopener');
        }else{
          el.removeAttribute('href');
        }
      }
      if(tag === 'span'){
        const style = el.getAttribute('style') || '';
        const match = style.match(/font-size\s*:\s*([0-9.]+(px|rem|em|%))/i);
        if(match){ el.setAttribute('style', `font-size:${match[1]}`); }
        else el.removeAttribute('style');
      }
      walk(el);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}

const SAMPLE_GALLERIES = [
  {
    id: "concerts",
    title: "Concerts",
    visible: true,
    createdAt: "2025-01-01",
    photos: [
      { filename: "cover.jpg", order: 1, url: `${API_BASE}/image/concerts/cover.jpg` },
      { filename: "concerts-1.jpg", order: 2, url: `${API_BASE}/image/concerts/concerts-1.jpg` },
    ],
  },
  {
    id: "events",
    title: "Events",
    visible: true,
    createdAt: "2025-01-02",
    photos: [
      { filename: "cover.jpg", order: 1, url: `${API_BASE}/image/events/cover.jpg` },
      { filename: "events-1.jpg", order: 2, url: `${API_BASE}/image/events/events-1.jpg` },
    ],
  },
];

let galleriesCache = [];
let siteAssetsCache = null;

async function fetchJSON(path, opts = {}){
  const res = await fetch(`${API_BASE}${path}`, opts);
  if(!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

async function getGalleries(){
  if(galleriesCache.length) return galleriesCache;
  try {
    const data = await fetchJSON('/galleries');
    galleriesCache = (data.galleries || []).map(g => ({
      ...g,
      zipEnabled: g.zipEnabled !== false,
    }));
    if(galleriesCache.length) return galleriesCache;
  } catch (err) {
    console.warn('Falling back to sample galleries', err);
  }
  galleriesCache = SAMPLE_GALLERIES;
  return galleriesCache;
}

async function getGallery(id, token){
  try {
    const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
    const res = await fetchJSON(`/galleries/${id}${suffix}`);
    const g = res.gallery;
    return g ? { ...g, zipEnabled: g.zipEnabled !== false } : g;
  } catch (err) {
    console.warn('Gallery fetch failed, using sample', err);
    const g = SAMPLE_GALLERIES.find(gal => gal.id === id);
    if (g) return g;
    throw err;
  }
}

async function getDownloadInfo(id, token){
  try{
    const suffix = token ? `?token=${encodeURIComponent(token)}` : '';
    const data = await fetchJSON(`/galleries/${encodeURIComponent(id)}/download-info${suffix}`);
    return data || null;
  }catch(err){
    console.warn('Download info unavailable', err);
    return null;
  }
}

function formatBytes(bytes){
  const n = Number(bytes || 0);
  if(!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let unit = 0;
  while(value >= 1024 && unit < units.length - 1){
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 10 || unit === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function photoCountLabel(count){
  const n = Number(count || 0);
  return `${n} ${n === 1 ? 'photo' : 'photos'}`;
}

async function getSiteAssets(){
  if(siteAssetsCache) return siteAssetsCache;
  try{
    const data = await fetchJSON('/site-assets');
    siteAssetsCache = data.assets || {};
  }catch{
    siteAssetsCache = {};
  }
  return siteAssetsCache;
}

/* --- Helpers --- */
function currentPage(){ return (location.pathname.split("/").pop() || "").toLowerCase(); }
function imageExists(url){
  return new Promise(r=>{
    const img = new Image();
    img.onload = ()=>r(true);
    img.onerror = ()=>r(false);
    img.src = url + "?v=" + Date.now(); // bust cache
  });
}

// Try multiple extensions and optional zero-padding; skip gaps safely
const EXT_VARIANTS = ["jpg","jpeg","JPG","JPEG","png","webp","WEBP"];

function imageExistsAny(candidates){
  return new Promise(resolve=>{
    let done = false, pending = candidates.length;
    candidates.forEach(url=>{
      const img = new Image();
      img.onload = ()=>{ if(!done){ done = true; resolve(url); } };
      img.onerror = ()=>{ if(--pending === 0 && !done) resolve(null); };
      img.src = url + "?v=" + Date.now();
    });
  });
}

function numberVariants(n){
  const s2 = String(n).padStart(2,"0");
  const s3 = String(n).padStart(3,"0");
  return [String(n), s2, s3];
}

async function enumeratePrefixedImages(key, max=300){
  const urls = [];
  const bases = (n)=>{
    const nums = numberVariants(n);
    const singular = key.endsWith("s") ? key.slice(0,-1) : key;
    // sports-1, sports-01, sports-001 and sport-1 fallbacks
    return [
      ...nums.map(num=>`${IMG_ROOT}/${key}/${key}-${num}`),
      ...nums.map(num=>`${IMG_ROOT}/${key}/${singular}-${num}`)
    ];
  };

  let foundAny = false;
  let missStreak = 0;
  for(let i=1;i<=max;i++){
    const baseCandidates = bases(i);
    const candidates = baseCandidates.flatMap(b => EXT_VARIANTS.map(ext => `${b}.${ext}`));
    /* eslint-disable no-await-in-loop */
    const hit = await imageExistsAny(candidates);
    if(hit){
      urls.push(hit);
      foundAny = true;
      missStreak = 0;
    }else{
      missStreak++;
      // stop after some consecutive misses once we started finding files
      if(foundAny && missStreak >= 8) break;
    }
  }
  return urls;
}

/* Resolve cover extension variants per collection */
const COVER_EXTS = ["jpg","jpeg","png","webp","JPG","JPEG","PNG","WEBP"];
async function pickExisting(candidates){
  for(const url of candidates){
    // eslint-disable-next-line no-await-in-loop
    if(await imageExists(url)) return url;
  }
  return candidates[0];
}
function resolveCoverFromPhotos(photos){
  if(!photos || !photos.length) return null;
  return photos[0].url || `${IMG_ROOT}/${photos[0].filename}`;
}

function apiImage(galleryId, filename){
  return `${API_BASE}/image/${galleryId}/${encodeURIComponent(filename)}`;
}

/* --- UI --- */
function renderNav(){
  const el = document.getElementById("navbar");
  if(!el) return;
  const path = currentPage();
  const active = p => path === p ? "active" : "";
  el.innerHTML = `
    <div class="container stack" style="justify-content:space-between;align-items:center;">
      <a class="brand" href="index.html" aria-label="${SITE.name}">
        <span class="brand-text">${SITE.name}</span>
      </a>
      <div class="nav">
        <a class="${active("about.html")}" href="about.html">About</a>
  <a class="${active("galleries.html")}" href="galleries.html">Gallery</a>
        <a class="${active("contacts.html")}" href="contacts.html">Contacts</a>
        <div class="nav-icons">
          <a href="https://instagram.com/" target="_blank" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor"/><circle cx="12" cy="12" r="4.5" stroke="currentColor"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>
          </a>
          <a href="https://facebook.com/" target="_blank" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="none"><path d="M14.5 8H16V5h-2c-2.2 0-3.5 1.5-3.5 3.6V11H8v3h2.5v5H14v-5h2.3l.2-3H14v-1.9c0-.6.2-1.1 1-1.1Z" fill="currentColor"/></svg>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderFooter(){
  const el = document.getElementById("footer");
  if(!el) return;
  el.innerHTML = `
    <div class="footer-bleed">
      <a href="index.html" class="footer-brand">${SITE.name}</a>
      <button type="button" class="footer-theme-btn" id="footerThemeBtn" aria-label="Cycle theme">Theme</button>
    </div>
  `;
}

/* Galleries listing (uses resolved covers) */
async function initGalleries(){
  const grid = document.getElementById("gallery-collections");
  if(!grid) return;
  const galleries = (await getGalleries()).filter(g=>g.visible !== false);
  grid.innerHTML = galleries.map(g=>{
    const cover = g.coverUrl || g.cover || resolveCoverFromPhotos(g.photos) || apiImage(g.id, 'cover.jpg');
    const coverThumb = cfImageUrl(cover, { width: 900, quality: 62, fit: 'cover' });
    const title = escapeHtml(g.title || g.id || 'Collection');
    return `<a class="gallery-card" href="collection.html?id=${encodeURIComponent(String(g.id || ''))}">
      <img src="${escapeHtml(coverThumb)}" data-orig="${escapeHtml(cover)}" alt="${title} cover" loading="lazy" decoding="async">
      <div class="gallery-title">${title}</div>
    </a>`;
  }).join("");
  bindCoverCardLoading(grid);
}

async function initAboutPage(){
  const container = document.getElementById('about-content');
  const photo = document.getElementById('about-photo');
  if(photo){
    const assets = await getSiteAssets();
    const aboutAsset = assets['about-photo'];
    photo.src = aboutAsset?.exists ? aboutAsset.url : apiImage('about', 'Andrius.jpeg');
    photo.onerror = () => {
      const fallback = apiImage('about', 'Andrius.jpeg');
      if (photo.src !== fallback) photo.src = fallback;
    };
    photo.alt = 'Andrius Šimkus portrait';
  }
  if(!container) return;
  try{
    const res = await fetchJSON('/pages/about');
    if(res && res.content){
      const safe = sanitizePublicHtml(res.content);
      if(safe) container.innerHTML = safe;
      return;
    }
  }catch(err){ console.warn('about load failed', err); }
  // fallback content
  container.innerHTML = `
    <p>I'm Andrius Šimkus, a professional photographer based in Lithuania. I specialize in concert, event, sports, portrait, and food photography—capturing authentic moments with clean, modern aesthetics.</p>
    <p>My work blends minimal composition with bold atmosphere. Whether tracking fast action, documenting an event, or crafting portraits and food sets, I aim for images that feel intentional, timeless, editorial.</p>
    <p>Explore the collections and reach out if you'd like to work together.</p>
  `;
}

function socialIcon(name){
  if(name==='instagram') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor"/><circle cx="12" cy="12" r="4.5" stroke="currentColor"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>`;
  if(name==='facebook') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14.5 8H16V5h-2c-2.2 0-3.5 1.5-3.5 3.6V11H8v3h2.5v5H14v-5h2.3l.2-3H14v-1.9c0-.6.2-1.1 1-1.1Z" fill="currentColor"/></svg>`;
  return '';
}

async function initContactsPage(){
  const emailEl = document.getElementById('contact-email');
  const phoneEl = document.getElementById('contact-phone');
  const socialsEl = document.getElementById('contact-socials');
  try{
    const res = await fetchJSON('/contacts');
    const c = res.contacts || {};
    if(emailEl && c.email){ emailEl.textContent = c.email; emailEl.href = `mailto:${c.email}`; }
    if(phoneEl && c.phone){ phoneEl.textContent = c.phone; phoneEl.href = `tel:${c.phone.replace(/[^+\d]/g,'')}`; }
    if(socialsEl){
      socialsEl.replaceChildren();
      [
        ['instagram', c.instagram, 'Instagram'],
        ['facebook', c.facebook, 'Facebook'],
      ].forEach(([name, href, label])=>{
        const safeHref = safeUrl(href);
        if(!safeHref) return;
        const a = document.createElement('a');
        a.href = safeHref;
        a.target = '_blank';
        a.rel = 'noreferrer noopener';
        a.setAttribute('aria-label', label);
        a.innerHTML = socialIcon(name);
        socialsEl.appendChild(a);
      });
    }
  }catch(err){ console.warn('contacts load failed', err); }
}

/* Collection page */

// Return ONLY the original source for now (no non-existent variants)
function imgTag(src, alt, full){
  const thumb = cfImageUrl(src, { width: 980, quality: 58, fit: 'scale-down' });
  const originalFull = full || src;
  const fullUrl = cfImageUrl(originalFull, { width: 2400, quality: 82, fit: 'scale-down' });
  return `<img class="ph-img" src="${escapeHtml(thumb)}" data-orig="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" data-lightbox data-lqip data-loading="1" data-full="${escapeHtml(fullUrl)}" data-full-orig="${escapeHtml(originalFull)}">`;
}

function showcaseImgTag(src, alt){
  const thumb = cfImageUrl(src, { width: 1100, quality: 64, fit: 'cover' });
  return `<img src="${escapeHtml(thumb)}" data-orig="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">`;
}

function bindShowcaseImages(grid){
  const section = grid.closest('.home-highlights');
  const updateVisibility = ()=>{
    const visibleCards = Array.from(grid.querySelectorAll('.highlight-card')).filter(card => !card.hidden);
    if(section) section.style.display = visibleCards.length ? '' : 'none';
  };

  grid.querySelectorAll('.highlight-card img').forEach((img)=>{
    const card = img.closest('.highlight-card');
    const hideBroken = ()=>{
      if(card) card.hidden = true;
      updateVisibility();
    };
    img.addEventListener('error', hideBroken, { once:true });
    img.addEventListener('load', updateVisibility, { once:true });
    if(img.complete && !img.naturalWidth) hideBroken();
  });
  updateVisibility();
}

function thumbUrl(photo, galleryId){
  if(photo.thumbUrl) return photo.thumbUrl;
  if(photo.thumbnail) return photo.thumbnail;
  if(photo.url){
    // Try swapping /images/ with /images/thumbnails/
    return photo.url.replace('/images/','/images/thumbnails/');
  }
  if(photo.filename) return `${IMG_ROOT}/thumbnails/${galleryId}/${photo.filename}`;
  return null;
}

// Enhanced collection rendering with robust LQIP removal
async function initCollection(){
  const grid = document.querySelector(".photo-grid");
  if(!grid) return;
  const id = (new URLSearchParams(location.search).get("id") || "").toLowerCase();
  const token = new URLSearchParams(location.search).get("token") || "";
  const titleEl = document.querySelector("[data-collection-title]");
  const gallery = await getGallery(id, token).catch(()=>null);
  if(titleEl) titleEl.textContent = gallery ? gallery.title : "Collection";
  if(!gallery){
    grid.innerHTML = "<p>Collection not found.</p>";
    return;
  }

  // Track view (analytics)
  (async ()=>{
    try{
      await fetch(`${API_BASE}/analytics/collection-view`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ id: gallery.id, token: token || undefined })
      });
    }catch(err){ console.warn('view track failed', err); }
  })();

  // Remove generated collection controls if the page is re-initialized.
  document.querySelectorAll('.collection__actions, .download-note, .selection-tray').forEach(el => el.remove());
  const photos = (gallery.photos || []).filter(p => p.filename !== 'cover.jpg');
  const zipEnabled = (gallery.zipEnabled !== false);
  const downloadInfo = await getDownloadInfo(gallery.id, token);
  const downloadAllMode = downloadInfo?.downloadAllMode || (zipEnabled && photos.length <= 40 ? 'on-demand' : 'prepare-required');
  const zipSize = formatBytes(downloadInfo?.zipSize);
  const canDownloadAll = downloadAllMode === 'prepared' || downloadAllMode === 'on-demand';

  const header = document.createElement('div');
  header.className = 'collection__header';
  const titleWrap = document.createElement('div');
  titleWrap.className = 'collection__title-wrap';
  if(titleEl){
    titleEl.parentElement.insertBefore(header, titleEl);
    titleWrap.appendChild(titleEl);
  }
  const meta = document.createElement('div');
  meta.className = 'collection__meta';
  meta.textContent = photoCountLabel(photos.length);
  titleWrap.appendChild(meta);
  header.appendChild(titleWrap);

  const actions = document.createElement('div');
  actions.className = 'collection__actions';

  const triggerBrowserDownload = (href, filename = '')=>{
    const a = document.createElement('a');
    a.href = href;
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  let downloadAllBtn;
  if(zipEnabled && canDownloadAll){
    downloadAllBtn = document.createElement('button');
    downloadAllBtn.type = 'button';
    downloadAllBtn.className = 'btn primary-action';
    downloadAllBtn.textContent = zipSize ? `Download all (${zipSize})` : 'Download all';
    downloadAllBtn.addEventListener('click', ()=>{
      downloadAllBtn.classList.add('loading');
      downloadAllBtn.setAttribute('aria-busy', 'true');
      const href = downloadInfo?.downloadUrl || `/api/galleries/${encodeURIComponent(gallery.id)}/download.zip${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      triggerBrowserDownload(href, `${gallery.id}.zip`);
      setTimeout(()=>{
        downloadAllBtn.classList.remove('loading');
        downloadAllBtn.removeAttribute('aria-busy');
      }, 2400);
    });
    actions.appendChild(downloadAllBtn);
  }

  let selectBtn;
  let downloadSelectedBtn;
  let cancelSelectBtn;
  let selectedCountEl;
  let selectionTray;
  if(photos.length){
    selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'btn';
    selectBtn.textContent = 'Select';
    actions.appendChild(selectBtn);

    selectionTray = document.createElement('div');
    selectionTray.className = 'selection-tray';
    selectionTray.hidden = true;
    selectedCountEl = document.createElement('div');
    selectedCountEl.className = 'selection-tray__count';
    selectedCountEl.textContent = '0 selected';
    downloadSelectedBtn = document.createElement('button');
    downloadSelectedBtn.type = 'button';
    downloadSelectedBtn.className = 'btn primary-action';
    downloadSelectedBtn.textContent = 'Download';
    cancelSelectBtn = document.createElement('button');
    cancelSelectBtn.type = 'button';
    cancelSelectBtn.className = 'btn';
    cancelSelectBtn.textContent = 'Cancel';
    selectionTray.appendChild(selectedCountEl);
    selectionTray.appendChild(downloadSelectedBtn);
    selectionTray.appendChild(cancelSelectBtn);
    document.body.appendChild(selectionTray);
  }

  if(actions.children.length){
    header.appendChild(actions);
  }
  if(zipEnabled && !canDownloadAll){
    const note = document.createElement('p');
    note.className = 'download-note';
    note.textContent = 'Full gallery download is not ready yet. Select photos below.';
    header.insertAdjacentElement('afterend', note);
  }

  grid.innerHTML = photos.map(photo=>{
    const thumb = thumbUrl(photo, gallery.id);
    const src = withToken(thumb || photo.url || `${IMG_ROOT}/${gallery.id}/${photo.filename}`, token);
    const full = withToken(photo.url || `${IMG_ROOT}/${gallery.id}/${photo.filename}`, token);
    return `<figure class="ph" data-filename="${escapeHtml(photo.filename)}" data-full-url="${escapeHtml(full)}">
      <label class="ph-select" aria-label="Select ${escapeHtml(photo.filename)}">
        <input class="photo-select-input" type="checkbox" value="${escapeHtml(photo.filename)}">
      </label>
      ${imgTag(src, gallery.title, full)}
      <figcaption class="ph-caption">${escapeHtml(photo.filename)}</figcaption>
    </figure>`;
  }).join("");

  const selectedFilenames = new Set();
  const updateSelectionButtons = ()=>{
    const count = selectedFilenames.size;
    if(selectedCountEl) selectedCountEl.textContent = count ? `${count} selected` : 'Select photos';
    if(downloadSelectedBtn) downloadSelectedBtn.textContent = 'Download';
    if(downloadSelectedBtn) downloadSelectedBtn.disabled = count === 0;
  };
  const setSelectionMode = (on)=>{
    grid.classList.toggle('selection-mode', on);
    actions.classList.toggle('selection-mode', on);
    if(selectionTray) selectionTray.hidden = !on;
    if(!on){
      selectedFilenames.clear();
      grid.querySelectorAll('.photo-select-input').forEach(input => { input.checked = false; });
    }
    updateSelectionButtons();
  };
  const toggleCardSelection = (card)=>{
    if(!card) return;
    const filename = card.getAttribute('data-filename') || '';
    const input = card.querySelector('.photo-select-input');
    if(!filename || !input) return;
    input.checked = !input.checked;
    if(input.checked) selectedFilenames.add(filename);
    else selectedFilenames.delete(filename);
    updateSelectionButtons();
  };
  const selectedRows = ()=> Array.from(grid.querySelectorAll('.ph'))
    .filter(card => selectedFilenames.has(card.getAttribute('data-filename') || ''));
  const downloadSelectedZip = async ()=>{
    if(!selectedFilenames.size) return;
    const res = await fetch(`/api/galleries/${encodeURIComponent(gallery.id)}/download-selected.zip`, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ filenames:Array.from(selectedFilenames), token: token || undefined }),
    });
    if(!res.ok){
      const message = await res.text().catch(()=> '');
      throw new Error(message || `Selected download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gallery.id}-selected.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 30000);
  };
  const downloadSelected = async ()=>{
    if(!selectedFilenames.size) return;
    const rows = selectedRows();
    if(rows.length > 12 || !navigator.share || !navigator.canShare || !window.File){
      await downloadSelectedZip();
      return;
    }
    const files = [];
    for(const card of rows){
      const url = card.getAttribute('data-full-url');
      const filename = card.getAttribute('data-filename') || 'photo.jpg';
      if(!url) continue;
      const res = await fetch(url, { credentials:'same-origin' });
      if(!res.ok) continue;
      const blob = await res.blob();
      files.push(new File([blob], filename, { type: blob.type || 'image/jpeg' }));
    }
    if(files.length && navigator.canShare({ files })){
      await navigator.share({ files, title: gallery.title });
    }else{
      await downloadSelectedZip();
    }
  };

  if(selectBtn) selectBtn.addEventListener('click', ()=> setSelectionMode(true));
  if(cancelSelectBtn) cancelSelectBtn.addEventListener('click', ()=> setSelectionMode(false));
  if(downloadSelectedBtn) downloadSelectedBtn.addEventListener('click', async ()=>{
    try{
      downloadSelectedBtn.classList.add('loading');
      if(selectedCountEl) selectedCountEl.textContent = 'Preparing...';
      await downloadSelected();
      if(selectedCountEl) selectedCountEl.textContent = 'Download started';
    }catch(err){
      console.warn(err);
      const message = err?.message || 'Selected download failed';
      if(selectedCountEl) selectedCountEl.textContent = 'Could not download';
      toast(message, 2600);
    }finally{ downloadSelectedBtn.classList.remove('loading'); }
  });
  grid.addEventListener('click', e=>{
    if(!grid.classList.contains('selection-mode')) return;
    const card = e.target.closest('.ph');
    if(!card) return;
    e.preventDefault();
    e.stopPropagation();
    toggleCardSelection(card);
  }, true);
  grid.addEventListener('change', e=>{
    const input = e.target;
    if(!input.classList || !input.classList.contains('photo-select-input')) return;
    if(input.checked) selectedFilenames.add(input.value);
    else selectedFilenames.delete(input.value);
    updateSelectionButtons();
  });
  setSelectionMode(false);

  const rowHeight = (()=>{
    const val = getComputedStyle(grid).getPropertyValue('grid-auto-rows');
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8;
  })();
  const rowGap = (()=>{
    const val = getComputedStyle(grid).getPropertyValue('row-gap');
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  })();

  const sizeMasonrySpan = (img)=>{
    const card = img.closest('.ph');
    if(!card) return;
    const width = card.clientWidth || img.naturalWidth || img.clientWidth || 1;
    const ratio = (img.naturalWidth && img.naturalHeight) ? (img.naturalHeight / img.naturalWidth) : 1;
    const height = width * ratio;
    const span = Math.ceil((height + rowGap) / (rowHeight + rowGap)) || 1;
    card.style.gridRowEnd = `span ${span}`;
  };

  const resizeAllMasonry = ()=>{
    grid.querySelectorAll('img[data-lightbox]').forEach((img)=>{
      if(img.complete) sizeMasonrySpan(img);
    });
  };

  grid.querySelectorAll("img[data-lqip]").forEach(img=>{
    const markLoaded = ()=>{
      if(!img.classList.contains("loaded")){
        img.classList.add("loaded");
        img.removeAttribute("data-lqip");
        img.removeAttribute("data-loading");
        const parent = img.closest('.ph');
        if(parent) parent.classList.add('img-loaded');
        sizeMasonrySpan(img);
      }
    };
    const markFailed = ()=>{
      img.removeAttribute("data-lqip");
      img.removeAttribute("data-loading");
      const parent = img.closest('.ph');
      if(parent) parent.classList.add('img-error');
    };
    const onError = ()=>{
      const fallback = img.getAttribute('data-orig');
      const alreadyRetried = img.dataset.fallbackTried === '1';
      const currentSrcAttr = img.getAttribute('src') || '';
      const canRetry = !!fallback && !alreadyRetried && currentSrcAttr !== fallback;

      if(canRetry){
        img.dataset.fallbackTried = '1';
        img.src = fallback;
        return;
      }
      img.removeEventListener('error', onError);
      markFailed();
    };
    img.addEventListener("load", markLoaded, { once:true });
    img.addEventListener("error", onError);
    if(img.complete){
      if((img.naturalWidth || 0) > 0) markLoaded();
      else markFailed();
    }
  });

  bindLightbox();

  // Recalculate spans on resize / container changes to avoid gaps at bottom.
  const ro = new ResizeObserver(()=> resizeAllMasonry());
  ro.observe(grid);
  window.addEventListener('resize', resizeAllMasonry, { passive:true });
}

/* Lightbox */
function bindLightbox(){
  // Collect thumbnails
  const thumbs = Array.from(document.querySelectorAll("[data-lightbox]"));
  if(!thumbs.length) return;

  // Create lightbox once
  let lb = document.querySelector(".lightbox");
  if(!lb){
    lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `
      <div class="lb-inner" role="dialog" aria-modal="true">
        <div class="img-wrap">
          <img id="lbImage" alt="" tabindex="0">
          <button class="nav-btn prev" aria-label="Previous">&larr;</button>
          <button class="nav-btn next" aria-label="Next">&rarr;</button>
        </div>
        <div class="lb-counter" id="lbCounter" aria-live="polite"></div>
        <button class="icon-btn close" aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6l12 12M18 6L6 18"></path>
          </svg>
        </button>
        <a class="icon-btn dl-btn" id="lbDownload" href="#" download aria-label="Download">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M4 20h16"></path>
          </svg>
        </a>
      </div>
    `;
    document.body.appendChild(lb);
  }

  // Elements
  const imgEl = lb.querySelector("#lbImage");
  const prevBtn = lb.querySelector(".prev");
  const nextBtn = lb.querySelector(".next");
  const downloadEl = lb.querySelector("#lbDownload");
  const closeBtn = lb.querySelector(".close");
  const counterEl = lb.querySelector("#lbCounter");

  imgEl.style.transformOrigin = "0 0";

  // State
  let index = -1;
  let zoomed = false, z = 1.8, tx = 0, ty = 0, baseW = 0, baseH = 0, minX = 0, minY = 0;
  let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;

  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }
  function applyTransform(){
    imgEl.style.transform = zoomed ? `translate(${tx}px,${ty}px) scale(${z})` : "";
  }
  function resetZoom(){ zoomed=false; tx=ty=0; imgEl.classList.remove("zoomed","dragging"); imgEl.style.transform=""; }

  function updateNav(){
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= thumbs.length - 1;
    // Update counter
    if(counterEl) counterEl.textContent = `${index + 1} / ${thumbs.length}`;
  }

  function show(i){
    if(i<0 || i>=thumbs.length) return;
    index = i;
    const src = thumbs[i].getAttribute("src");
    const full = thumbs[i].getAttribute("data-full") || src;
    const fullOrig = thumbs[i].getAttribute("data-full-orig") || src;
    if(!src){ console.warn("Thumb missing src"); return; }
    resetZoom();
    imgEl.dataset.fallbackTried = '0';
    imgEl.onerror = ()=>{
      if(imgEl.dataset.fallbackTried === '1') return;
      imgEl.dataset.fallbackTried = '1';
      imgEl.src = fullOrig;
    };
    imgEl.src = full || src;
    downloadEl.href = full || src;
    downloadEl.download = (full || src).split("/").pop() || "photo.jpg";
    downloadEl.dataset.url = fullOrig || full || src;
    downloadEl.dataset.filename = (fullOrig || full || src).split("/").pop() || "photo.jpg";
    lb.classList.add("open");
    imgEl.focus();
    updateNav();
    // preload neighbors
    [i-1,i+1].forEach(n=>{
      if(n>=0 && n<thumbs.length){
        const p = new Image(); p.src = thumbs[n].getAttribute("data-full") || thumbs[n].getAttribute("src");
      }
    });
  }

  function close(){
    lb.classList.remove("open");
    resetZoom();
  }

  // Thumbnail clicks
  thumbs.forEach((t,i)=> t.addEventListener("click", ()=> show(i)));

  // Buttons
  prevBtn.onclick = ()=> show(index-1);
  nextBtn.onclick = ()=> show(index+1);
  closeBtn.onclick = close;
  if(downloadEl){
    downloadEl.onclick = async (event)=>{
      event.preventDefault();
      const url = downloadEl.dataset.url || downloadEl.href;
      const fallbackDownload = ()=>{
        const a = document.createElement('a');
        a.href = downloadEl.href || url;
        a.download = downloadEl.download || downloadEl.dataset.filename || 'photo.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };

      if(!navigator.share || !window.File){
        fallbackDownload();
        return;
      }

      try{
        downloadEl.classList.add('loading');
        const res = await fetch(url, { credentials:'same-origin' });
        if(!res.ok) throw new Error('Unable to fetch image');
        const blob = await res.blob();
        const type = blob.type || 'image/jpeg';
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('avif') ? 'avif' : 'jpg';
        const rawName = decodeURIComponent((downloadEl.dataset.filename || `photo.${ext}`).split('?')[0]);
        const filename = /\.[a-z0-9]+$/i.test(rawName) ? rawName : `${rawName}.${ext}`;
        const file = new File([blob], filename, { type });
        if(navigator.canShare && navigator.canShare({ files:[file] })){
          await navigator.share({ files:[file], title:'Photo' });
        }else{
          fallbackDownload();
        }
      }catch(err){
        console.warn('native share failed', err);
        fallbackDownload();
      }finally{
        downloadEl.classList.remove('loading');
      }
    };
  }
  lb.addEventListener("click", e=>{
    // If user clicked the overlay (lightbox itself) not the image/buttons, close
    if(e.target === lb) close();
  });

  // Keyboard
  document.addEventListener("keydown", e=>{
    if(!lb.classList.contains("open")) return;
    if(e.key === "Escape") close();
    else if(e.key === "ArrowRight") show(index+1);
    else if(e.key === "ArrowLeft") show(index-1);
    else if(e.key === " ") { e.preventDefault(); imgEl.click(); }
  });

  // Cursor zoom
  imgEl.addEventListener("click", e=>{
    if(dragging) return;
    if(!zoomed){
      const r = imgEl.getBoundingClientRect();
      baseW = r.width; baseH = r.height;
      minX = baseW * (1 - z);
      minY = baseH * (1 - z);
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      tx = clamp(px * (1 - z), minX, 0);
      ty = clamp(py * (1 - z), minY, 0);
      zoomed = true;
      imgEl.classList.add("zoomed");
      applyTransform();
    }else{
      resetZoom();
    }
  });

  // Drag pan
  imgEl.addEventListener("pointerdown", e=>{
    if(!zoomed) return;
    dragging=false;
    imgEl.classList.add("dragging");
    imgEl.setPointerCapture(e.pointerId);
    startX=e.clientX; startY=e.clientY; startTx=tx; startTy=ty;
  });
  imgEl.addEventListener("pointermove", e=>{
    if(!zoomed || !imgEl.hasPointerCapture(e.pointerId)) return;
    const dx=e.clientX-startX, dy=e.clientY-startY;
    if(Math.abs(dx)>3 || Math.abs(dy)>3) dragging=true;
    tx = clamp(startTx+dx, minX, 0);
    ty = clamp(startTy+dy, minY, 0);
    applyTransform();
  });
  imgEl.addEventListener("pointerup", e=>{
    if(imgEl.hasPointerCapture(e.pointerId)) imgEl.releasePointerCapture(e.pointerId);
    imgEl.classList.remove("dragging");
    setTimeout(()=> dragging=false,0);
  });
}

// 2-state theme toggle: Light/Dark. Default = system (auto, not on button).
const THEME_STORAGE_KEY = "theme-pref";

function systemMode(){
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function applyThemePref(pref){
  if(pref === "light" || pref === "dark"){
    document.documentElement.setAttribute("data-theme", pref);
    document.documentElement.dataset.themeAuto = "false";
  }else{
    const system = systemMode();
    document.documentElement.setAttribute("data-theme", system);
    document.documentElement.dataset.themeAuto = "true"; // mark auto for styling/debug
  }
}
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
function labelFor(pref){ return pref === "auto" ? cap(systemMode()) : cap(pref); }

function initThemeToggle(){
  const btns = [document.getElementById("themeToggle"), document.getElementById("footerThemeBtn")].filter(Boolean);
  if(btns.length === 0) return;

  let pref = localStorage.getItem(THEME_STORAGE_KEY) || "auto";
  applyThemePref(pref);
  btns.forEach(b => b.textContent = labelFor(pref));

  // Update on OS theme change only when in auto
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  if(mql?.addEventListener){
    mql.addEventListener("change", ()=>{
      if(pref === "auto"){
        applyThemePref("auto");
        btns.forEach(b => b.textContent = labelFor("auto"));
      }
    });
  }

  btns.forEach(b=>{
    b.onclick = ()=>{
      const current = (pref === "auto") ? systemMode() : pref;
      pref = current === "light" ? "dark" : "light";
      applyThemePref(pref);
      localStorage.setItem(THEME_STORAGE_KEY, pref);
      btns.forEach(bb => bb.textContent = labelFor(pref));
    };
  });
}

/* Home featured: show all categories */
async function initHomeFeatured(){
  const grid = document.getElementById("featured-collections");
  const [assets, galleriesRaw] = await Promise.all([
    getSiteAssets(),
    getGalleries(),
  ]);
  const galleries = galleriesRaw.filter(g=>g.visible !== false).slice(0,4);
  const heroCover = document.getElementById('hero-cover');
  if(heroCover && assets['home-hero']?.exists){
    heroCover.src = assets['home-hero'].url;
    heroCover.alt = assets['home-hero'].alt || 'Featured';
  }else if(heroCover && galleries.length){
    const first = galleries[0];
    const cover = first.coverUrl || first.cover || resolveCoverFromPhotos(first.photos) || apiImage(first.id, 'cover.jpg');
    heroCover.src = cover;
    heroCover.alt = `${first.title || 'Featured'} cover`;
  }

  const highlightGrid = document.getElementById('home-highlights');
  if(highlightGrid){
    const section = highlightGrid.closest('.home-highlights');
    const showcaseAssets = HOME_SHOWCASE_KEYS
      .map(key => assets[key])
      .filter(asset => asset?.exists);
    if(!showcaseAssets.length){
      if(section) section.style.display = 'none';
    }else{
      if(section) section.style.display = '';
      highlightGrid.innerHTML = showcaseAssets.map((asset, idx)=>{
        const alt = asset.alt || `Portfolio showcase ${idx + 1}`;
        return `<figure class="highlight-card">${showcaseImgTag(asset.url, alt)}</figure>`;
      }).join('');
      bindShowcaseImages(highlightGrid);
    }
  }

  if(!grid) return;
  grid.innerHTML = galleries.map(g=>{
    const cover = g.coverUrl || g.cover || resolveCoverFromPhotos(g.photos) || apiImage(g.id, 'cover.jpg');
    const coverThumb = cfImageUrl(cover, { width: 900, quality: 62, fit: 'cover' });
    const title = escapeHtml(g.title || g.id || 'Collection');
    return `<a class="gallery-card" href="collection.html?id=${encodeURIComponent(String(g.id || ''))}">
      <img src="${escapeHtml(coverThumb)}" data-orig="${escapeHtml(cover)}" alt="${title} cover" loading="lazy" decoding="async">
      <div class="gallery-title">${title}</div>
    </a>`;
  }).join("");
  bindCoverCardLoading(grid);
}

/* Toast message (simple fade-in/out) */
function toast(msg, ms=1600){
  let t = document.querySelector(".toast");
  if(!t){ t = document.createElement("div"); t.className="toast"; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("show");
  setTimeout(()=> t.classList.remove("show"), ms);
}

/* Boot */
document.addEventListener("DOMContentLoaded", async ()=>{
  renderNav();
  renderFooter();
  document.querySelectorAll("footer .dot").forEach(d=>d.remove());
  initThemeToggle();
  const page = document.body.dataset.page || currentPage();

  if(page === 'home' || page === 'index.html' || page === '') await initHomeFeatured();
  if(page === 'galleries' || page === 'galleries.html') await initGalleries();
  if(page === 'collection' || page === 'collection.html') await initCollection();
  if(page === 'about' || page === 'about.html') await initAboutPage();
  if(page === 'contacts' || page === 'contacts.html') await initContactsPage();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
});
const syncFooterThemeBtn = () => {
  const btn = document.getElementById("footerThemeBtn");
  const headerBtn = document.getElementById("themeToggle");
  if(btn && headerBtn){
    btn.textContent = headerBtn.textContent;
    btn.onclick = ()=>{ headerBtn.click(); btn.textContent = headerBtn.textContent; };
  }
};
document.addEventListener("DOMContentLoaded", ()=> {
  const btn = document.getElementById("footerThemeBtn");
  const headerBtn = document.getElementById("themeToggle");
  if(btn && headerBtn){
    btn.textContent = headerBtn.textContent;
    btn.addEventListener("click", ()=>{
      headerBtn.click();
      btn.textContent = headerBtn.textContent;
    });
  }
  syncFooterThemeBtn();
});
document.addEventListener("DOMContentLoaded", ()=>{
  const lb = document.querySelector(".lightbox");
  if(lb) lb.classList.remove("open");
});
