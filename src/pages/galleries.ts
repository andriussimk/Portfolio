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
        const list = featured ? galleries.slice(0, 3) : galleries;

        list.forEach(gallery => {
            const galleryElement = document.createElement('div');
            galleryElement.className = 'gallery-item';
            galleryElement.innerHTML = `
                <h3>${gallery.title}</h3>
                <a href="collection.html?id=${gallery.id}">
                    <img src="${gallery.thumbnail}" alt="${gallery.title}">
                </a>
            `;
            container.appendChild(galleryElement);
        });
    } catch (error) {
        console.error('Error rendering galleries', error);
        container.innerHTML = '<p>Unable to load galleries.</p>';
    }
}