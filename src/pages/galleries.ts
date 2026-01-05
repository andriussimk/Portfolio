import { fetchGalleries } from '../utils/dom';
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
            const coverImg = coverSrc
                ? `<img src="${coverSrc}" alt="${gallery.title}">`
                : `<div class="gallery-cover-placeholder" aria-label="${gallery.title}"></div>`;
            
            card.innerHTML = `
                ${coverImg}
                <div class="gallery-title">${gallery.title}</div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering galleries', error);
        container.innerHTML = '<p>Unable to load galleries.</p>';
    }
}