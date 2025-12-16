export function renderCollection(collectionId: string) {
    // Fetch the collection data based on the collectionId
    fetch(`/src/data/galleries.json`)
        .then(response => response.json())
        .then(data => {
            const collection = data.collections.find(col => col.id === collectionId);
            if (!collection) {
                document.getElementById('app').innerHTML = '<h1>Collection Not Found</h1>';
                return;
            }

            // Create the HTML for the collection page
            const collectionHTML = `
                <h1>${collection.title}</h1>
                <div class="gallery-grid">
                    ${collection.photos.map(photo => `
                        <div class="gallery-item">
                            <img src="${photo.thumbnail}" alt="${photo.alt}" onclick="openLightbox('${photo.fullRes}')">
                        </div>
                    `).join('')}
                </div>
            `;

            // Render the collection HTML
            document.getElementById('app').innerHTML = collectionHTML;
        })
        .catch(error => {
            console.error('Error fetching collection data:', error);
            document.getElementById('app').innerHTML = '<h1>Error loading collection</h1>';
        });
}