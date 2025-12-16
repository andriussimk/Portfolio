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

type GalleryJson = typeof galleriesData;

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export async function fetchGalleries() {
    const galleries = galleriesData.galleries || [];

    const normalizePath = (src?: string) => {
        if (!src) return '';
        return src.startsWith('public/') ? src.replace(/^public\//, '/') : src;
    };

    return galleries.map((gallery, index) => {
        const images = (gallery.images || []).map(img => ({
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
        };
    });
}