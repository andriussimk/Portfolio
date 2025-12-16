import { renderAbout } from './pages/about';
import { renderContacts } from './pages/contacts';
import { renderGalleries } from './pages/galleries';
import { renderCollection } from './pages/collection';
import { setupNavbar } from './components/navbar';
import { setupFooter } from './components/footer';

function init() {
    setupNavbar();
    setupFooter();

    const path = window.location.pathname;

    if (path === '/about.html') {
        renderAbout();
    } else if (path === '/contacts.html') {
        renderContacts();
    } else if (path === '/galleries.html') {
        renderGalleries();
    } else if (path.startsWith('/collection.html')) {
        renderCollection();
    } else {
        // Default to home or landing page
        renderGalleries();
    }
}

document.addEventListener('DOMContentLoaded', init);