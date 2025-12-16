export default class GalleryGrid {
    constructor(images) {
        this.images = images;
    }

    render() {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'gallery-grid';

        this.images.forEach(image => {
            const imgElement = document.createElement('img');
            imgElement.src = image.thumbnail;
            imgElement.alt = image.title;
            imgElement.className = 'gallery-image';
            imgElement.addEventListener('click', () => this.openLightbox(image.fullRes));

            gridContainer.appendChild(imgElement);
        });

        return gridContainer;
    }

    openLightbox(imageSrc) {
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        const imgElement = document.createElement('img');
        imgElement.src = imageSrc;
        lightbox.appendChild(imgElement);

        lightbox.addEventListener('click', () => {
            lightbox.remove();
        });

        document.body.appendChild(lightbox);
    }
}