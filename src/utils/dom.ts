export function createElement(tag: string, className?: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (attributes) {
        Object.keys(attributes).forEach(key => {
            element.setAttribute(key, attributes[key]);
        });
    }
    return element;
}

export function appendChildren(parent: HTMLElement, children: HTMLElement[]): void {
    children.forEach(child => {
        parent.appendChild(child);
    });
}

export function removeElement(element: HTMLElement): void {
    if (element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

export function toggleClass(element: HTMLElement, className: string): void {
    element.classList.toggle(className);
}

import galleriesData from '../data/galleries.json';
import type { ApiGallerySummary, GallerySummary } from './types';

type GalleryJson = typeof galleriesData;

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export async function fetchGalleries() {
    // Prefer live data (D1/R2 via Pages Functions) so admin changes show up immediately.
    // If the API isn't available (e.g., local static preview), fall back to bundled JSON.
    try {
        const res = await fetch('/api/galleries', {
            headers: {
                accept: 'application/json',
            },
        });
        if (!res.ok) throw new Error(`Failed to fetch /api/galleries (${res.status})`);
        const data = (await res.json()) as { galleries?: ApiGallerySummary[] };
        const apiGalleries = data.galleries || [];

        return apiGalleries
            .filter(g => g.visible)
            .map(
                (g): GallerySummary => ({
                    id: g.id,
                    title: g.title,
                    description: g.description ?? undefined,
                    thumbnail: g.coverUrl || '',
                    // Summary endpoint doesn't need to ship all images; collection page will load details.
                    images: [],
                })
            );
    } catch {
        const galleries = (galleriesData as any).galleries || [];

        const normalizePath = (src?: string) => {
            if (!src) return '';
            return src.startsWith('public/') ? src.replace(/^public\//, '/') : src;
        };

        return galleries.map((gallery: any, index: number) => {
            const images = (gallery.images || []).map((img: any) => ({
                ...img,
                src: normalizePath(img.src),
            }));
            const thumbnail = images[0]?.src || '';
            return {
                id: slugify(gallery.title || `gallery-${index}`) || `gallery-${index}`,
                title: gallery.title,
                description: gallery.description,
                thumbnail,
                images,
            } as GallerySummary;
        });
    }
}