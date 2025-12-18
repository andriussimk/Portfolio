export type GalleryImage = {
    src: string;
    alt?: string;
    thumbnail?: string;
    fullRes?: string;
};

export type GallerySummary = {
    id: string;
    title: string;
    description?: string;
    thumbnail: string;
    images: GalleryImage[];
};

// API (D1/R2-backed) shapes
export type ApiGallerySummary = {
    id: string;
    title: string;
    description?: string | null;
    visible: boolean;
    createdAt?: string;
    coverUrl?: string | null;
};

export type ApiGalleryPhoto = {
    filename: string;
    order: number;
    url: string;
};

export type ApiGalleryDetail = {
    id: string;
    title: string;
    description?: string | null;
    visible: boolean;
    createdAt?: string;
    coverUrl?: string | null;
    photos: ApiGalleryPhoto[];
};

export type ContactInfo = {
    email: string;
    phone: string;
    socialMedia: {
        platform: string;
        url: string;
    }[];
};