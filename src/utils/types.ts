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

export type ContactInfo = {
    email: string;
    phone: string;
    socialMedia: {
        platform: string;
        url: string;
    }[];
};