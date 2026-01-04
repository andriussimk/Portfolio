export function renderContactsPage() {
    const contactsContent = `
        <h1>Let's work together</h1>
        <p>If you'd like to collaborate, book a shoot, or ask a question, reach out through any of these:</p>
        <ul>
            <li>Email: <a href="mailto:hello@shotbyandrius.com">hello@shotbyandrius.com</a></li>
            <li>Phone: <a href="tel:+37061804969">+37061804969</a></li>
        </ul>
        <h2>Follow</h2>
        <ul>
            <li><a href="https://www.instagram.com/shot_by_andrius" target="_blank">Instagram</a></li>
            <li><a href="https://www.facebook.com/andriussimk" target="_blank">Facebook</a></li>
        </ul>
    `;
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = contactsContent;
}

export const renderContacts = renderContactsPage;