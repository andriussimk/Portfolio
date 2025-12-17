import { fetchGalleries } from '../utils/dom';
import type { GallerySummary } from '../utils/types';

export async function renderCollection() {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('id');
    const container = document.getElementById('app') || document.getElementById('collection-container');

    if (!container) return;
    if (!collectionId) {
        container.innerHTML = '<h1>Collection Not Found</h1>';
        return;
    }

    try {
        const galleries: GallerySummary[] = await fetchGalleries();
        const collection = galleries.find(col => col.id === collectionId);

        if (!collection) {
            container.innerHTML = '<h1>Collection Not Found</h1>';
            return;
        }

        const collectionHTML = `
            <h1>${collection.title}</h1>
            <div class="gallery-grid">
                ${collection.images.map(photo => `
                    <div class="gallery-item">
                        <img src="${photo.src}" alt="${photo.alt || collection.title}">
                    </div>
                `).join('')}
            </div>
        `;

        container.innerHTML = collectionHTML;
    } catch (error) {
        console.error('Error fetching collection data:', error);
        container.innerHTML = '<h1>Error loading collection</h1>';
    }
}