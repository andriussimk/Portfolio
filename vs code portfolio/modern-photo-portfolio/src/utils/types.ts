export type GalleryCollection = {
    id: string;
    title: string;
    description: string;
    images: string[];
};

export type ContactInfo = {
    email: string;
    phone: string;
    socialMedia: {
        platform: string;
        url: string;
    }[];
};