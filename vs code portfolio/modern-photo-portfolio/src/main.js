/* Front-end script */

const SITE = { name: "Shot by Andrius", owner: "Andrius Šimkus" };
const API_BASE = "/api";
const IMG_ROOT = "/images"; // temporary local mode (will move to R2)

const SAMPLE_GALLERIES = [
  {
    id: "concerts",
    title: "Concerts",
    visible: true,
    createdAt: "2025-01-01",
    photos: [
      { filename: "cover.jpg", order: 1, url: `${IMG_ROOT}/concerts/cover.jpg` },
      { filename: "img001.jpg", order: 2, url: `${IMG_ROOT}/concerts/img001.jpg` },
    ],
  },
  {
    id: "events",
    title: "Events",
    visible: true,
    createdAt: "2025-01-02",
    photos: [
      { filename: "cover.jpg", order: 1, url: `${IMG_ROOT}/events/cover.jpg` },
    ],
  },
];

let galleriesCache = [];

async function fetchJSON(path, opts = {}){
  const res = await fetch(`${API_BASE}${path}`, opts);
  if(!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

async function getGalleries(){
  if(galleriesCache.length) return galleriesCache;
  try {
    const data = await fetchJSON('/galleries');
    galleriesCache = data.galleries || [];
    if(galleriesCache.length) return galleriesCache;
  } catch (err) {
    console.warn('Falling back to sample galleries', err);
  }
  galleriesCache = SAMPLE_GALLERIES;
  return galleriesCache;
}

async function getGallery(id){
  try {
    const res = await fetchJSON(`/galleries/${id}`);
    return res.gallery;
  } catch (err) {
    console.warn('Gallery fetch failed, using sample', err);
    const g = SAMPLE_GALLERIES.find(gal => gal.id === id);
    if (g) return g;
    throw err;
  }
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
async function resolveCoverFromPhotos(photos){
  if(!photos || !photos.length) return null;
  return photos[0].url || `${IMG_ROOT}/${photos[0].filename}`;
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
        <a class="${active("index.html")}" href="index.html">Home</a>
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
        <button class="theme-toggle" type="button" id="themeToggle" aria-label="Toggle theme">Auto</button>
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
    const cover = g.coverUrl || g.cover || resolveCoverFromPhotos(g.photos) || `${IMG_ROOT}/${g.id}/cover.jpg`;
    return `<a class="gallery-card" href="collection.html?id=${g.id}">
      <img src="${cover}" alt="${g.title} cover" loading="lazy">
      <div class="gallery-title">${g.title}</div>
    </a>`;
  }).join("");
}

/* Collection page */
// (Replace previous buildSrcset + imgTag with simplified versions)

// Return ONLY the original source for now (no non-existent variants)
function imgTag(src, alt){
  return `<img src="${src}" alt="${alt}" loading="lazy" data-lightbox data-lqip>`;
}

// Enhanced collection rendering with robust LQIP removal
async function initCollection(){
  const grid = document.querySelector(".photo-grid");
  if(!grid) return;
  const id = (new URLSearchParams(location.search).get("id") || "").toLowerCase();
  const titleEl = document.querySelector("[data-collection-title]");
  const gallery = await getGallery(id).catch(()=>null);
  if(titleEl) titleEl.textContent = gallery ? gallery.title : "Collection";
  if(!gallery){
    grid.innerHTML = "<p>Collection not found.</p>";
    return;
  }

  const photos = gallery.photos || [];
  grid.innerHTML = photos.map(photo=>{
    const src = photo.url || `${IMG_ROOT}/${gallery.id}/${photo.filename}`;
    return `<figure class="ph">${imgTag(src, gallery.title)}</figure>`;
  }).join("");

  grid.querySelectorAll("img[data-lqip]").forEach(img=>{
    const markLoaded = ()=>{
      if(!img.classList.contains("loaded")){
        img.classList.add("loaded");
        img.removeAttribute("data-lqip");
      }
    };
    img.addEventListener("load", markLoaded, { once:true });
    if(img.complete) markLoaded();
    setTimeout(()=>{
      if(!img.classList.contains("loaded")) markLoaded();
    }, 3000);
  });

  bindLightbox();
}

/* Lightbox */
function bindLightbox(){
  // Collect thumbnails (must exist now)
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
  }

  function show(i){
    if(i<0 || i>=thumbs.length) return;
    index = i;
    const src = thumbs[i].getAttribute("src");
    if(!src){ console.warn("Thumb missing src"); return; }
    resetZoom();
    imgEl.src = src;
    downloadEl.href = src;
    downloadEl.download = src.split("/").pop() || "photo.jpg";
    lb.classList.add("open");
    imgEl.focus();
    updateNav();
    // preload neighbors
    [i-1,i+1].forEach(n=>{
      if(n>=0 && n<thumbs.length){
        const p = new Image(); p.src = thumbs[n].getAttribute("src");
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
  }else{
    document.documentElement.removeAttribute("data-theme"); // auto: follow system
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
  if(!grid) return;
  const galleries = (await getGalleries()).filter(g=>g.visible !== false).slice(0,3);
  grid.innerHTML = galleries.map(g=>{
    const cover = g.coverUrl || g.cover || resolveCoverFromPhotos(g.photos) || `${IMG_ROOT}/${g.id}/cover.jpg`;
    return `<a class="gallery-card" href="collection.html?id=${g.id}">
      <img src="${cover}" alt="${g.title} cover" loading="lazy">
      <div class="gallery-title">${g.title}</div>
    </a>`;
  }).join("");
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
  await initHomeFeatured();
  await initGalleries();
  await initCollection();
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