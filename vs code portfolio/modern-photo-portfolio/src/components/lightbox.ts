export class Lightbox {
    private lightboxElement: HTMLElement;
    private currentImageIndex: number = 0;
    private images: string[] = [];

    constructor(images: string[]) {
        this.images = images;
        this.lightboxElement = this.createLightboxElement();
        this.addEventListeners();
    }

    private createLightboxElement(): HTMLElement {
        const lightbox = document.createElement('div');
        lightbox.classList.add('lightbox');
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <span class="close">&times;</span>
                <img class="lightbox-image" src="" alt="Lightbox Image" />
                <div class="lightbox-navigation">
                    <button class="prev">&lt;</button>
                    <button class="next">&gt;</button>
                </div>
            </div>
        `;
        document.body.appendChild(lightbox);
        return lightbox;
    }

    private addEventListeners(): void {
        this.lightboxElement.querySelector('.close')?.addEventListener('click', () => this.close());
        this.lightboxElement.querySelector('.prev')?.addEventListener('click', () => this.showPreviousImage());
        this.lightboxElement.querySelector('.next')?.addEventListener('click', () => this.showNextImage());
    }

    public open(index: number): void {
        this.currentImageIndex = index;
        this.updateImage();
        this.lightboxElement.classList.add('active');
    }

    public close(): void {
        this.lightboxElement.classList.remove('active');
    }

    private updateImage(): void {
        const imgElement = this.lightboxElement.querySelector('.lightbox-image') as HTMLImageElement;
        imgElement.src = this.images[this.currentImageIndex];
    }

    private showPreviousImage(): void {
        this.currentImageIndex = (this.currentImageIndex > 0) ? this.currentImageIndex - 1 : this.images.length - 1;
        this.updateImage();
    }

    private showNextImage(): void {
        this.currentImageIndex = (this.currentImageIndex < this.images.length - 1) ? this.currentImageIndex + 1 : 0;
        this.updateImage();
    }
}