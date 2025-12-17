const T={name:"Shot by Andrius"},R="/api",u="/images",G=[{id:"concerts",title:"Concerts",visible:!0,createdAt:"2025-01-01",photos:[{filename:"cover.jpg",order:1,url:`${u}/concerts/cover.jpg`},{filename:"img001.jpg",order:2,url:`${u}/concerts/img001.jpg`}]},{id:"events",title:"Events",visible:!0,createdAt:"2025-01-02",photos:[{filename:"cover.jpg",order:1,url:`${u}/events/cover.jpg`}]}];let d=[];async function O(e,n={}){const t=await fetch(`${R}${e}`,n);if(!t.ok)throw new Error(`API ${e} failed: ${t.status}`);return t.json()}async function z(){if(d.length)return d;try{if(d=(await O("/galleries")).galleries||[],d.length)return d}catch(e){console.warn("Falling back to sample galleries",e)}return d=G,d}async function Y(e){try{return(await O(`/galleries/${e}`)).gallery}catch(n){console.warn("Gallery fetch failed, using sample",n);const t=G.find(r=>r.id===e);if(t)return t;throw n}}function N(){return(location.pathname.split("/").pop()||"").toLowerCase()}async function D(e){return!e||!e.length?null:e[0].url||`${u}/${e[0].filename}`}function X(){const e=document.getElementById("navbar");if(!e)return;const n=N(),t=r=>n===r?"active":"";e.innerHTML=`
    <div class="container stack" style="justify-content:space-between;align-items:center;">
      <a class="brand" href="index.html" aria-label="${T.name}">
        <span class="brand-text">${T.name}</span>
      </a>
      <div class="nav">
        <a class="${t("index.html")}" href="index.html">Home</a>
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
        <button class="theme-toggle" type="button" id="themeToggle" aria-label="Toggle theme">Auto</button>
      </div>
    </div>
  `}function U(){const e=document.getElementById("footer");e&&(e.innerHTML=`
    <div class="footer-bleed">
      <a href="index.html" class="footer-brand">${T.name}</a>
      <button type="button" class="footer-theme-btn" id="footerThemeBtn" aria-label="Cycle theme">Theme</button>
    </div>
  `)}async function W(){const e=document.getElementById("gallery-collections");if(!e)return;const n=(await z()).filter(t=>t.visible!==!1);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||D(t.photos)||`${u}/${t.id}/cover.jpg`;return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}function V(e,n){return`<img src="${e}" alt="${n}" loading="lazy" data-lightbox data-lqip>`}async function Z(){const e=document.querySelector(".photo-grid");if(!e)return;const n=(new URLSearchParams(location.search).get("id")||"").toLowerCase(),t=document.querySelector("[data-collection-title]"),r=await Y(n).catch(()=>null);if(t&&(t.textContent=r?r.title:"Collection"),!r){e.innerHTML="<p>Collection not found.</p>";return}const h=r.photos||[];e.innerHTML=h.map(l=>{const c=l.url||`${u}/${r.id}/${l.filename}`;return`<figure class="ph">${V(c,r.title)}</figure>`}).join(""),e.querySelectorAll("img[data-lqip]").forEach(l=>{const c=()=>{l.classList.contains("loaded")||(l.classList.add("loaded"),l.removeAttribute("data-lqip"))};l.addEventListener("load",c,{once:!0}),l.complete&&c(),setTimeout(()=>{l.classList.contains("loaded")||c()},3e3)}),J()}function J(){const e=Array.from(document.querySelectorAll("[data-lightbox]"));if(!e.length)return;let n=document.querySelector(".lightbox");n||(n=document.createElement("div"),n.className="lightbox",n.innerHTML=`
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
    `,document.body.appendChild(n));const t=n.querySelector("#lbImage"),r=n.querySelector(".prev"),h=n.querySelector(".next"),l=n.querySelector("#lbDownload"),c=n.querySelector(".close");t.style.transformOrigin="0 0";let s=-1,m=!1,f=1.8,g=0,v=0,B=0,M=0,E=0,w=0,b=!1,I=0,A=0,S=0,j=0;function y(o,a,i){return Math.max(a,Math.min(i,o))}function q(){t.style.transform=m?`translate(${g}px,${v}px) scale(${f})`:""}function L(){m=!1,g=v=0,t.classList.remove("zoomed","dragging"),t.style.transform=""}function _(){r.disabled=s<=0,h.disabled=s>=e.length-1}function p(o){if(o<0||o>=e.length)return;s=o;const a=e[o].getAttribute("src");if(!a){console.warn("Thumb missing src");return}L(),t.src=a,l.href=a,l.download=a.split("/").pop()||"photo.jpg",n.classList.add("open"),t.focus(),_(),[o-1,o+1].forEach(i=>{if(i>=0&&i<e.length){const k=new Image;k.src=e[i].getAttribute("src")}})}function x(){n.classList.remove("open"),L()}e.forEach((o,a)=>o.addEventListener("click",()=>p(a))),r.onclick=()=>p(s-1),h.onclick=()=>p(s+1),c.onclick=x,n.addEventListener("click",o=>{o.target===n&&x()}),document.addEventListener("keydown",o=>{n.classList.contains("open")&&(o.key==="Escape"?x():o.key==="ArrowRight"?p(s+1):o.key==="ArrowLeft"?p(s-1):o.key===" "&&(o.preventDefault(),t.click()))}),t.addEventListener("click",o=>{if(!b)if(m)L();else{const a=t.getBoundingClientRect();B=a.width,M=a.height,E=B*(1-f),w=M*(1-f);const i=o.clientX-a.left,k=o.clientY-a.top;g=y(i*(1-f),E,0),v=y(k*(1-f),w,0),m=!0,t.classList.add("zoomed"),q()}}),t.addEventListener("pointerdown",o=>{m&&(b=!1,t.classList.add("dragging"),t.setPointerCapture(o.pointerId),I=o.clientX,A=o.clientY,S=g,j=v)}),t.addEventListener("pointermove",o=>{if(!m||!t.hasPointerCapture(o.pointerId))return;const a=o.clientX-I,i=o.clientY-A;(Math.abs(a)>3||Math.abs(i)>3)&&(b=!0),g=y(S+a,E,0),v=y(j+i,w,0),q()}),t.addEventListener("pointerup",o=>{t.hasPointerCapture(o.pointerId)&&t.releasePointerCapture(o.pointerId),t.classList.remove("dragging"),setTimeout(()=>b=!1,0)})}const H="theme-pref";function F(){return window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}function C(e){e==="light"||e==="dark"?document.documentElement.setAttribute("data-theme",e):document.documentElement.removeAttribute("data-theme")}function P(e){return e.charAt(0).toUpperCase()+e.slice(1)}function $(e){return P(e==="auto"?F():e)}function K(){const e=[document.getElementById("themeToggle"),document.getElementById("footerThemeBtn")].filter(Boolean);if(e.length===0)return;let n=localStorage.getItem(H)||"auto";C(n),e.forEach(r=>r.textContent=$(n));const t=window.matchMedia("(prefers-color-scheme: light)");t?.addEventListener&&t.addEventListener("change",()=>{n==="auto"&&(C("auto"),e.forEach(r=>r.textContent=$("auto")))}),e.forEach(r=>{r.onclick=()=>{n=(n==="auto"?F():n)==="light"?"dark":"light",C(n),localStorage.setItem(H,n),e.forEach(l=>l.textContent=$(n))}})}async function Q(){const e=document.getElementById("featured-collections");if(!e)return;const n=(await z()).filter(t=>t.visible!==!1).slice(0,3);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||D(t.photos)||`${u}/${t.id}/cover.jpg`;return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}document.addEventListener("DOMContentLoaded",async()=>{X(),U(),document.querySelectorAll("footer .dot").forEach(e=>e.remove()),K(),await Q(),await W(),await Z(),"serviceWorker"in navigator&&navigator.serviceWorker.register("/sw.js").catch(()=>{})});const ee=()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.onclick=()=>{n.click(),e.textContent=n.textContent})};document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.addEventListener("click",()=>{n.click(),e.textContent=n.textContent})),ee()});document.addEventListener("DOMContentLoaded",()=>{const e=document.querySelector(".lightbox");e&&e.classList.remove("open")});
