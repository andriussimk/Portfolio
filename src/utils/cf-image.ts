export function canUseCfImage() {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    if (!window.location.protocol.startsWith('http')) return false;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
}

export function cfImageUrl(src: string | null | undefined, opts: {
    width?: number;
    quality?: number;
    fit?: 'scale-down' | 'cover' | 'contain' | 'pad' | 'crop';
} = {}) {
    if (!src) return src || '';
    if (!canUseCfImage()) return src;
    if (src.startsWith('data:') || src.startsWith('blob:')) return src;
    if (src.includes('/cdn-cgi/image/')) return src;
    // Worker-proxied API images can fail under /cdn-cgi/image transforms on some setups.
    // Keep them as-is and rely on pre-generated thumbnails.
    if (src.startsWith('/api/image/')) return src;

    const width = opts.width ? Math.max(1, Math.round(opts.width)) : null;
    const quality = opts.quality ? Math.max(30, Math.min(95, Math.round(opts.quality))) : null;
    const fit = opts.fit || 'scale-down';
    const dpr = window.devicePixelRatio > 1.35 ? 2 : 1;

    const parts = ['format=auto', 'metadata=none', `fit=${fit}`, `dpr=${dpr}`];
    if (width) parts.push(`width=${width}`);
    if (quality) parts.push(`quality=${quality}`);

    const normalizedSrc = /^https?:\/\//i.test(src)
        ? src
        : src.replace(/^\/+/, '');
    return `/cdn-cgi/image/${parts.join(',')}/${normalizedSrc}`;
}

export function bindCfFallback(img: HTMLImageElement, originalSrc: string | null | undefined) {
    if (!originalSrc) return;
    if (!img.dataset) return;
    if (img.dataset.cfFallbackBound === '1') return;
    img.dataset.cfFallbackBound = '1';

    img.addEventListener('error', () => {
        img.src = originalSrc;
    }, { once: true });
}
