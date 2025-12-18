import { fetchGalleries } from '../utils/dom';
import type { ApiGalleryDetail, GallerySummary } from '../utils/types';

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
        // Prefer the live API detail so admin uploads show up immediately.
        try {
            const res = await fetch(`/api/galleries/${encodeURIComponent(collectionId)}`, {
                headers: {
                    accept: 'application/json',
                },
            });
            if (!res.ok) throw new Error(`Failed to load gallery (${res.status})`);
            const data = (await res.json()) as { gallery?: ApiGalleryDetail };
            const gallery = data.gallery;
            if (!gallery) throw new Error('Missing gallery');

                const downloadUrl = `/api/galleries/${encodeURIComponent(gallery.id)}/download.zip`;

            const photos = (gallery.photos || []).filter(p => p.filename !== 'cover.jpg');
            const collectionHTML = `
                <h1>${gallery.title}</h1>
                    <div class="collection__actions">
                        <a class="button" href="${downloadUrl}" download>
                            Download all photos (ZIP)
                        </a>
                    </div>
                <div class="gallery-grid">
                    ${photos
                        .map(
                            photo => `
                        <div class="gallery-item">
                            <img src="${photo.url}" alt="${gallery.title}">
                        </div>
                    `
                        )
                        .join('')}
                </div>
            `;

            container.innerHTML = collectionHTML;
            return;
        } catch {
            // Fallback: use legacy JSON-derived content.
            const galleries: GallerySummary[] = await fetchGalleries();
            const collection = galleries.find(col => col.id === collectionId);

            if (!collection) {
                container.innerHTML = '<h1>Collection Not Found</h1>';
                return;
            }

            const downloadUrl = `/api/galleries/${encodeURIComponent(collectionId)}/download.zip`;

            const collectionHTML = `
                <h1>${collection.title}</h1>
                <div class="collection__actions">
                    <a class="button" href="${downloadUrl}" download>
                        Download all photos (ZIP)
                    </a>
                </div>
                <div class="gallery-grid">
                    ${collection.images
                        .map(
                            photo => `
                        <div class="gallery-item">
                            <img src="${photo.src}" alt="${photo.alt || collection.title}">
                        </div>
                    `
                        )
                        .join('')}
                </div>
            `;

            container.innerHTML = collectionHTML;
        }
    } catch (error) {
        console.error('Error fetching collection data:', error);
        container.innerHTML = '<h1>Error loading collection</h1>';
    }
}