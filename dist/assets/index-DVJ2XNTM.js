(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const l of document.querySelectorAll('link[rel="modulepreload"]'))r(l);new MutationObserver(l=>{for(const a of l)if(a.type==="childList")for(const c of a.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&r(c)}).observe(document,{childList:!0,subtree:!0});function t(l){const a={};return l.integrity&&(a.integrity=l.integrity),l.referrerPolicy&&(a.referrerPolicy=l.referrerPolicy),l.crossOrigin==="use-credentials"?a.credentials="include":l.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(l){if(l.ep)return;l.ep=!0;const a=t(l);fetch(l.href,a)}})();const T={name:"Shot by Andrius"},_="/api",f="/images",O=[{id:"concerts",title:"Concerts",visible:!0,createdAt:"2025-01-01",photos:[{filename:"cover.jpg",order:1,url:`${f}/concerts/cover.jpg`},{filename:"img001.jpg",order:2,url:`${f}/concerts/img001.jpg`}]},{id:"events",title:"Events",visible:!0,createdAt:"2025-01-02",photos:[{filename:"cover.jpg",order:1,url:`${f}/events/cover.jpg`}]}];let u=[];async function F(e,n={}){const t=await fetch(`${_}${e}`,n);if(!t.ok)throw new Error(`API ${e} failed: ${t.status}`);return t.json()}async function G(){if(u.length)return u;try{if(u=(await F("/galleries")).galleries||[],u.length)return u}catch(e){console.warn("Falling back to sample galleries",e)}return u=O,u}async function R(e){try{return(await F(`/galleries/${e}`)).gallery}catch(n){console.warn("Gallery fetch failed, using sample",n);const t=O.find(r=>r.id===e);if(t)return t;throw n}}function Y(){return(location.pathname.split("/").pop()||"").toLowerCase()}async function N(e){return!e||!e.length?null:e[0].url||`${f}/${e[0].filename}`}function X(){const e=document.getElementById("navbar");if(!e)return;const n=Y(),t=r=>n===r?"active":"";e.innerHTML=`
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
  `)}async function W(){const e=document.getElementById("gallery-collections");if(!e)return;const n=(await G()).filter(t=>t.visible!==!1);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||N(t.photos)||`${f}/${t.id}/cover.jpg`;return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}function K(e,n){return`<img src="${e}" alt="${n}" loading="lazy" data-lightbox data-lqip>`}async function V(){const e=document.querySelector(".photo-grid");if(!e)return;const n=(new URLSearchParams(location.search).get("id")||"").toLowerCase(),t=document.querySelector("[data-collection-title]"),r=await R(n).catch(()=>null);if(t&&(t.textContent=r?r.title:"Collection"),!r){e.innerHTML="<p>Collection not found.</p>";return}const l=r.photos||[];e.innerHTML=l.map(a=>{const c=a.url||`${f}/${r.id}/${a.filename}`;return`<figure class="ph">${K(c,r.title)}</figure>`}).join(""),e.querySelectorAll("img[data-lqip]").forEach(a=>{const c=()=>{a.classList.contains("loaded")||(a.classList.add("loaded"),a.removeAttribute("data-lqip"))};a.addEventListener("load",c,{once:!0}),a.complete&&c(),setTimeout(()=>{a.classList.contains("loaded")||c()},3e3)}),Z()}function Z(){const e=Array.from(document.querySelectorAll("[data-lightbox]"));if(!e.length)return;let n=document.querySelector(".lightbox");n||(n=document.createElement("div"),n.className="lightbox",n.innerHTML=`
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
    `,document.body.appendChild(n));const t=n.querySelector("#lbImage"),r=n.querySelector(".prev"),l=n.querySelector(".next"),a=n.querySelector("#lbDownload"),c=n.querySelector(".close");t.style.transformOrigin="0 0";let d=-1,m=!1,h=1.8,g=0,p=0,M=0,B=0,E=0,w=0,b=!1,I=0,A=0,S=0,j=0;function y(o,i,s){return Math.max(i,Math.min(s,o))}function q(){t.style.transform=m?`translate(${g}px,${p}px) scale(${h})`:""}function L(){m=!1,g=p=0,t.classList.remove("zoomed","dragging"),t.style.transform=""}function D(){r.disabled=d<=0,l.disabled=d>=e.length-1}function v(o){if(o<0||o>=e.length)return;d=o;const i=e[o].getAttribute("src");if(!i){console.warn("Thumb missing src");return}L(),t.src=i,a.href=i,a.download=i.split("/").pop()||"photo.jpg",n.classList.add("open"),t.focus(),D(),[o-1,o+1].forEach(s=>{if(s>=0&&s<e.length){const C=new Image;C.src=e[s].getAttribute("src")}})}function x(){n.classList.remove("open"),L()}e.forEach((o,i)=>o.addEventListener("click",()=>v(i))),r.onclick=()=>v(d-1),l.onclick=()=>v(d+1),c.onclick=x,n.addEventListener("click",o=>{o.target===n&&x()}),document.addEventListener("keydown",o=>{n.classList.contains("open")&&(o.key==="Escape"?x():o.key==="ArrowRight"?v(d+1):o.key==="ArrowLeft"?v(d-1):o.key===" "&&(o.preventDefault(),t.click()))}),t.addEventListener("click",o=>{if(!b)if(m)L();else{const i=t.getBoundingClientRect();M=i.width,B=i.height,E=M*(1-h),w=B*(1-h);const s=o.clientX-i.left,C=o.clientY-i.top;g=y(s*(1-h),E,0),p=y(C*(1-h),w,0),m=!0,t.classList.add("zoomed"),q()}}),t.addEventListener("pointerdown",o=>{m&&(b=!1,t.classList.add("dragging"),t.setPointerCapture(o.pointerId),I=o.clientX,A=o.clientY,S=g,j=p)}),t.addEventListener("pointermove",o=>{if(!m||!t.hasPointerCapture(o.pointerId))return;const i=o.clientX-I,s=o.clientY-A;(Math.abs(i)>3||Math.abs(s)>3)&&(b=!0),g=y(S+i,E,0),p=y(j+s,w,0),q()}),t.addEventListener("pointerup",o=>{t.hasPointerCapture(o.pointerId)&&t.releasePointerCapture(o.pointerId),t.classList.remove("dragging"),setTimeout(()=>b=!1,0)})}const P="theme-pref";function z(){return window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}function $(e){e==="light"||e==="dark"?document.documentElement.setAttribute("data-theme",e):document.documentElement.removeAttribute("data-theme")}function H(e){return e.charAt(0).toUpperCase()+e.slice(1)}function k(e){return H(e==="auto"?z():e)}function J(){const e=[document.getElementById("themeToggle"),document.getElementById("footerThemeBtn")].filter(Boolean);if(e.length===0)return;let n=localStorage.getItem(P)||"auto";$(n),e.forEach(r=>r.textContent=k(n));const t=window.matchMedia("(prefers-color-scheme: light)");t?.addEventListener&&t.addEventListener("change",()=>{n==="auto"&&($("auto"),e.forEach(r=>r.textContent=k("auto")))}),e.forEach(r=>{r.onclick=()=>{n=(n==="auto"?z():n)==="light"?"dark":"light",$(n),localStorage.setItem(P,n),e.forEach(a=>a.textContent=k(n))}})}async function Q(){const e=document.getElementById("featured-collections");if(!e)return;const n=(await G()).filter(t=>t.visible!==!1).slice(0,3);e.innerHTML=n.map(t=>{const r=t.coverUrl||t.cover||N(t.photos)||`${f}/${t.id}/cover.jpg`;return`<a class="gallery-card" href="collection.html?id=${t.id}">
      <img src="${r}" alt="${t.title} cover" loading="lazy">
      <div class="gallery-title">${t.title}</div>
    </a>`}).join("")}document.addEventListener("DOMContentLoaded",async()=>{X(),U(),document.querySelectorAll("footer .dot").forEach(e=>e.remove()),J(),await Q(),await W(),await V(),"serviceWorker"in navigator&&navigator.serviceWorker.register("/sw.js").catch(()=>{})});const ee=()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.onclick=()=>{n.click(),e.textContent=n.textContent})};document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("footerThemeBtn"),n=document.getElementById("themeToggle");e&&n&&(e.textContent=n.textContent,e.addEventListener("click",()=>{n.click(),e.textContent=n.textContent})),ee()});document.addEventListener("DOMContentLoaded",()=>{const e=document.querySelector(".lightbox");e&&e.classList.remove("open")});
