import { fetchGalleries } from '../utils/dom';

export function renderGalleries() {
    const galleriesContainer = document.getElementById('galleries-container');
    
    fetchGalleries().then(galleries => {
        galleries.forEach(gallery => {
            const galleryElement = document.createElement('div');
            galleryElement.className = 'gallery-item';
            galleryElement.innerHTML = `
                <h3>${gallery.title}</h3>
                <a href="collection.html?id=${gallery.id}">
                    <img src="${gallery.thumbnail}" alt="${gallery.title}">
                </a>
            `;
            galleriesContainer.appendChild(galleryElement);
        });
    });
}