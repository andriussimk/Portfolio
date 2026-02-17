import { fetchGalleries } from '../utils/dom';
import { bindCfFallback, cfImageUrl } from '../utils/cf-image';
import type { GallerySummary } from '../utils/types';

function pickContainer(): { el: HTMLElement | null; featured: boolean } {
    const featuredEl = document.getElementById('featured-collections');
    if (featuredEl) return { el: featuredEl, featured: true };
    const galleriesEl = document.getElementById('gallery-collections');
    return { el: galleriesEl, featured: false };
}

export async function renderGalleries() {
    const { el: container, featured } = pickContainer();
    if (!container) return;

    try {
        const galleries: GallerySummary[] = await fetchGalleries();
        const list = featured ? galleries.slice(0, 4) : galleries;

        list.forEach(gallery => {
            const card = document.createElement('a');
            card.href = `collection.html?id=${gallery.id}`;
            card.className = 'gallery-card';
            
            const coverSrc = (gallery as any).coverThumbUrl || gallery.thumbnail;
            if (coverSrc) {
                card.classList.add('is-loading');
                const img = document.createElement('img');
                const transformed = cfImageUrl(coverSrc, { width: 900, quality: 62, fit: 'cover' });
                img.src = transformed || coverSrc;
                img.alt = gallery.title;
                img.loading = 'lazy';
                img.decoding = 'async';
                bindCfFallback(img, coverSrc);
                const markReady = () => card.classList.remove('is-loading');
                img.addEventListener('load', markReady, { once: true });
                img.addEventListener('error', markReady, { once: true });
                if (img.complete) {
                    if ((img.naturalWidth || 0) > 0) markReady();
                    else requestAnimationFrame(markReady);
                }
                card.appendChild(img);
            } else {
                const placeholder = document.createElement('div');
                placeholder.className = 'gallery-cover-placeholder';
                placeholder.setAttribute('aria-label', gallery.title);
                card.appendChild(placeholder);
            }

            const title = document.createElement('div');
            title.className = 'gallery-title';
            title.textContent = gallery.title;
            card.appendChild(title);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering galleries', error);
        container.innerHTML = '<p>Unable to load galleries.</p>';
    }
}