import { fetchGalleries } from '../utils/dom';
import { bindCfFallback, cfImageUrl } from '../utils/cf-image';
import type { ApiGalleryDetail, GallerySummary } from '../utils/types';

function thumbUrl(photo: any, galleryId: string){
    if (photo.thumbnail) return photo.thumbnail;
    if (photo.url) return photo.url.replace('/images/','/images/thumbnails/');
    if (photo.filename) return `/images/thumbnails/${galleryId}/${photo.filename}`;
    return undefined;
}

type RenderPhoto = {
    filename?: string;
    url?: string;
    src?: string;
    alt?: string;
    thumbnail?: string;
};

function renderGalleryGrid(
    root: HTMLElement,
    params: {
        galleryId: string;
        title: string;
        token: string | null;
        photos: RenderPhoto[];
    }
) {
    const { galleryId, title, token, photos } = params;
    const downloadUrl = `/api/galleries/${encodeURIComponent(galleryId)}/download.zip${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    root.innerHTML = `
        <div class="collection__header">
            <h1>${title}</h1>
            <div class="collection__actions">
                <a class="btn" href="${downloadUrl}" download>
                    Download all photos (ZIP)
                </a>
            </div>
        </div>
        <div class="gallery-grid" id="collection-gallery-grid"></div>
        <div id="collection-gallery-sentinel" aria-hidden="true"></div>
    `;

    const grid = root.querySelector('#collection-gallery-grid') as HTMLElement | null;
    const sentinel = root.querySelector('#collection-gallery-sentinel') as HTMLElement | null;
    if (!grid || !sentinel) return;

    const batchSize = 36;
    let cursor = 0;

    const appendNextBatch = () => {
        if (cursor >= photos.length) {
            sentinel.remove();
            return;
        }

        const frag = document.createDocumentFragment();
        const end = Math.min(cursor + batchSize, photos.length);
        for (let i = cursor; i < end; i++) {
            const photo = photos[i];
            const src = thumbUrl(photo, galleryId) || photo.url || photo.src;
            if (!src) continue;

            const item = document.createElement('div');
            item.className = 'gallery-item is-loading';

            const spinner = document.createElement('span');
            spinner.className = 'gallery-item__spinner';
            spinner.setAttribute('aria-hidden', 'true');

            const img = document.createElement('img');
            const transformed = cfImageUrl(src, { width: 980, quality: 58, fit: 'scale-down' });
            img.src = transformed || src;
            img.alt = photo.alt || title;
            img.loading = i < 10 ? 'eager' : 'lazy';
            img.decoding = 'async';
            img.fetchPriority = i < 4 ? 'high' : 'low';
            bindCfFallback(img, src);

            const markLoaded = () => {
                item.classList.remove('is-loading');
                spinner.remove();
            };

            img.addEventListener('load', markLoaded, { once: true });
            img.addEventListener('error', markLoaded, { once: true });
            if (img.complete) {
                requestAnimationFrame(markLoaded);
            }

            item.appendChild(spinner);
            item.appendChild(img);
            frag.appendChild(item);
        }

        grid.appendChild(frag);
        cursor = end;
    };

    appendNextBatch();

    const observer = new IntersectionObserver(
        (entries) => {
            const entry = entries[0];
            if (!entry?.isIntersecting) return;
            appendNextBatch();
        },
        { rootMargin: '600px 0px' }
    );

    observer.observe(sentinel);
}

export async function renderCollection() {
    const params = new URLSearchParams(window.location.search);
    const collectionId = params.get('id');
    const token = params.get('token');
    const container = document.getElementById('app') || document.getElementById('collection-container');

    if (!container) return;
    if (!collectionId) {
        container.innerHTML = '<h1>Collection Not Found</h1>';
        return;
    }

    try {
        // Prefer the live API detail so admin uploads show up immediately.
        try {
            const tokenSuffix = token ? `?token=${encodeURIComponent(token)}` : '';
            const res = await fetch(`/api/galleries/${encodeURIComponent(collectionId)}${tokenSuffix}`, {
                headers: {
                    accept: 'application/json',
                },
            });
            if (!res.ok) throw new Error(`Failed to load gallery (${res.status})`);
            const data = (await res.json()) as { gallery?: ApiGalleryDetail };
            const gallery = data.gallery;
            if (!gallery) throw new Error('Missing gallery');
            const photos = (gallery.photos || []).filter(p => p.filename !== 'cover.jpg');
            renderGalleryGrid(container, {
                galleryId: gallery.id,
                title: gallery.title,
                token,
                photos,
            });
            return;
        } catch {
            // Fallback: use legacy JSON-derived content.
            const galleries: GallerySummary[] = await fetchGalleries();
            const collection = galleries.find(col => col.id === collectionId);

            if (!collection) {
                container.innerHTML = '<h1>Collection Not Found</h1>';
                return;
            }

            renderGalleryGrid(container, {
                galleryId: collectionId,
                title: collection.title,
                token,
                photos: collection.images,
            });
        }
    } catch (error) {
        console.error('Error fetching collection data:', error);
        container.innerHTML = '<h1>Error loading collection</h1>';
    }
}