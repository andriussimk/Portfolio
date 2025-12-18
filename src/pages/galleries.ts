import { fetchGalleries } from '../utils/dom';
import type { GallerySummary } from '../utils/types';

function pickContainer(): { el: HTMLElement | null; featured: boolean } {
    const featuredEl = document.getElementById('featured-collections');
    if (featuredEl) return { el: featuredEl, featured: true };
    const galleriesEl = document.getElementById('galleries-container');
    return { el: galleriesEl, featured: false };
}

export async function renderGalleries() {
    const { el: container, featured } = pickContainer();
    if (!container) return;

    try {
        const galleries: GallerySummary[] = await fetchGalleries();
        const list = featured ? galleries.slice(0, 4) : galleries;

        list.forEach(gallery => {
            const galleryElement = document.createElement('div');
            galleryElement.className = 'gallery-item';
            const cover = gallery.thumbnail
                ? `<img src="${gallery.thumbnail}" alt="${gallery.title}">`
                : `<div class="gallery-cover-placeholder" aria-label="${gallery.title}"></div>`;
            galleryElement.innerHTML = `
                <h3>${gallery.title}</h3>
                <a href="collection.html?id=${gallery.id}">
                    ${cover}
                </a>
            `;
            container.appendChild(galleryElement);
        });
    } catch (error) {
        console.error('Error rendering galleries', error);
        container.innerHTML = '<p>Unable to load galleries.</p>';
    }
}