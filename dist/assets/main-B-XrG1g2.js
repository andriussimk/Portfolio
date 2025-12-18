const T={name:"Shot by Andrius"},_="/api",p="/images",z=[{id:"concerts",title:"Concerts",visible:!0,createdAt:"2025-01-01",photos:[{filename:"cover.jpg",order:1,url:`${p}/concerts/cover.jpg`},{filename:"img001.jpg",order:2,url:`${p}/concerts/img001.jpg`}]},{id:"events",title:"Events",visible:!0,createdAt:"2025-01-02",photos:[{filename:"cover.jpg",order:1,url:`${p}/events/cover.jpg`}]}];let s=[];async function D(e,n={}){const t=await fetch(`${_}${e}`,n);if(!t.ok)throw new Error(`API ${e} failed: ${t.status}`);return t.json()}async function G(){if(s.length)return s;try{if(s=(await D("/galleries")).galleries||[],s.length)return s}catch(e){console.warn("Falling back to sample galleries",e)}return s=z,s}async function U(e){try{return(await D(`/galleries/${e}`)).gallery}catch(n){console.warn("Gallery fetch failed, using sample",n);const t=z.find(r=>r.id===e);if(t)return t;throw n}}function Y(){return(location.pathname.split("/").pop()||"").toLowerCase()}async function O(e){return!e||!e.length?null:e[0].url||`${p}/${e[0].filename}`}function R(e,n){return`${_}/image/${e}/${encodeURIComponent(n)}`}function X(){const e=document.getElementById("navbar");if(!e)return;const n=Y(),t=r=>n===r?"active":"";e.innerHTML=`
    <div class="container stack" style="justify-content:space-between;align-items:center;">
      <a class="brand" href="index.html" aria-label="${T.name}">
        <span class="brand-text">${T.name}</span>
      </a>
      <div class="nav">
        <a class="${t("about.html")}" href="about.html">About</a>
  <a class="${t("galleries.html")}" href="galleries.html">Gallery</a>
        <a class="${t("contacts.html")}" href="contacts.html">Contacts</a>
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
  `}function W(){const e=document.getElementById("footer");e&&(e.innerHTML=`
    <div class="footer-bleed">
      <a href="index.html" class="footer-brand">${T.name}</a>
      <button type="button" class="footer-theme-btn" id="footerThemeBtn" aria-label="Cycle theme">Theme</button>
    </div>
  `)}async function Z(){const e=document.getElementById("gallery-collections");if(!e)return;const n=(await G()).filter(t=>t.visible!==!1);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||O(t.photos)||R(t.id,"cover.jpg");return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}function V(e,n){return`<img src="${e}" alt="${n}" loading="lazy" data-lightbox data-lqip>`}async function J(){const e=document.querySelector(".photo-grid");if(!e)return;const n=(new URLSearchParams(location.search).get("id")||"").toLowerCase(),t=document.querySelector("[data-collection-title]"),r=await U(n).catch(()=>null);if(t&&(t.textContent=r?r.title:"Collection"),!r){e.innerHTML="<p>Collection not found.</p>";return}if(!document.querySelector(".collection__actions")){const l=document.createElement("div");l.className="collection__actions";const a=document.createElement("a");a.className="btn",a.href=`/api/galleries/${encodeURIComponent(r.id)}/download.zip`,a.setAttribute("download",""),a.textContent="Download all photos (ZIP)",l.appendChild(a),t&&t.parentElement?t.insertAdjacentElement("afterend",l):e.insertAdjacentElement("beforebegin",l)}const d=(r.photos||[]).filter(l=>l.filename!=="cover.jpg");e.innerHTML=d.map(l=>{const a=l.url||`${p}/${r.id}/${l.filename}`;return`<figure class="ph">${V(a,r.title)}</figure>`}).join(""),e.querySelectorAll("img[data-lqip]").forEach(l=>{const a=()=>{l.classList.contains("loaded")||(l.classList.add("loaded"),l.removeAttribute("data-lqip"))};l.addEventListener("load",a,{once:!0}),l.complete&&a(),setTimeout(()=>{l.classList.contains("loaded")||a()},3e3)}),K()}function K(){const e=Array.from(document.querySelectorAll("[data-lightbox]"));if(!e.length)return;let n=document.querySelector(".lightbox");n||(n=document.createElement("div"),n.className="lightbox",n.innerHTML=`
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
    `,document.body.appendChild(n));const t=n.querySelector("#lbImage"),r=n.querySelector(".prev"),v=n.querySelector(".next"),d=n.querySelector("#lbDownload"),l=n.querySelector(".close");t.style.transformOrigin="0 0";let a=-1,u=!1,m=1.8,f=0,h=0,I=0,A=0,E=0,w=0,b=!1,B=0,M=0,S=0,j=0;function y(o,i,c){return Math.max(i,Math.min(c,o))}function q(){t.style.transform=u?`translate(${f}px,${h}px) scale(${m})`:""}function x(){u=!1,f=h=0,t.classList.remove("zoomed","dragging"),t.style.transform=""}function N(){r.disabled=a<=0,v.disabled=a>=e.length-1}function g(o){if(o<0||o>=e.length)return;a=o;const i=e[o].getAttribute("src");if(!i){console.warn("Thumb missing src");return}x(),t.src=i,d.href=i,d.download=i.split("/").pop()||"photo.jpg",n.classList.add("open"),t.focus(),N(),[o-1,o+1].forEach(c=>{if(c>=0&&c<e.length){const C=new Image;C.src=e[c].getAttribute("src")}})}function L(){n.classList.remove("open"),x()}e.forEach((o,i)=>o.addEventListener("click",()=>g(i))),r.onclick=()=>g(a-1),v.onclick=()=>g(a+1),l.onclick=L,n.addEventListener("click",o=>{o.target===n&&L()}),document.addEventListener("keydown",o=>{n.classList.contains("open")&&(o.key==="Escape"?L():o.key==="ArrowRight"?g(a+1):o.key==="ArrowLeft"?g(a-1):o.key===" "&&(o.preventDefault(),t.click()))}),t.addEventListener("click",o=>{if(!b)if(u)x();else{const i=t.getBoundingClientRect();I=i.width,A=i.height,E=I*(1-m),w=A*(1-m);const c=o.clientX-i.left,C=o.clientY-i.top;f=y(c*(1-m),E,0),h=y(C*(1-m),w,0),u=!0,t.classList.add("zoomed"),q()}}),t.addEventListener("pointerdown",o=>{u&&(b=!1,t.classList.add("dragging"),t.setPointerCapture(o.pointerId),B=o.clientX,M=o.clientY,S=f,j=h)}),t.addEventListener("pointermove",o=>{if(!u||!t.hasPointerCapture(o.pointerId))return;const i=o.clientX-B,c=o.clientY-M;(Math.abs(i)>3||Math.abs(c)>3)&&(b=!0),f=y(S+i,E,0),h=y(j+c,w,0),q()}),t.addEventListener("pointerup",o=>{t.hasPointerCapture(o.pointerId)&&t.releasePointerCapture(o.pointerId),t.classList.remove("dragging"),setTimeout(()=>b=!1,0)})}const H="theme-pref";function F(){return window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}function k(e){e==="light"||e==="dark"?document.documentElement.setAttribute("data-theme",e):document.documentElement.removeAttribute("data-theme")}function P(e){return e.charAt(0).toUpperCase()+e.slice(1)}function $(e){return P(e==="auto"?F():e)}function Q(){const e=[document.getElementById("themeToggle"),document.getElementById("footerThemeBtn")].filter(Boolean);if(e.length===0)return;let n=localStorage.getItem(H)||"auto";k(n),e.forEach(r=>r.textContent=$(n));const t=window.matchMedia("(prefers-color-scheme: light)");t?.addEventListener&&t.addEventListener("change",()=>{n==="auto"&&(k("auto"),e.forEach(r=>r.textContent=$("auto")))}),e.forEach(r=>{r.onclick=()=>{n=(n==="auto"?F():n)==="light"?"dark":"light",k(n),localStorage.setItem(H,n),e.forEach(d=>d.textContent=$(n))}})}async function ee(){const e=document.getElementById("featured-collections");if(!e)return;const n=(await G()).filter(t=>t.visible!==!1).slice(0,4);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||O(t.photos)||R(t.id,"cover.jpg");return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}document.addEventListener("DOMContentLoaded",async()=>{X(),W(),document.querySelectorAll("footer .dot").forEach(e=>e.remove()),Q(),await ee(),await Z(),await J(),"serviceWorker"in navigator&&navigator.serviceWorker.register("/sw.js").catch(()=>{})});const te=()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.onclick=()=>{n.click(),e.textContent=n.textContent})};document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.addEventListener("click",()=>{n.click(),e.textContent=n.textContent})),te()});document.addEventListener("DOMContentLoaded",()=>{const e=document.querySelector(".lightbox");e&&e.classList.remove("open")});
