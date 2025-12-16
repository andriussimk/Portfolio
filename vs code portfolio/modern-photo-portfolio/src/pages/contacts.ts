export function renderContactsPage() {
    const contactsContent = `
        <h1>Contact Me</h1>
        <p>If you would like to get in touch, feel free to reach out through any of the following methods:</p>
        <ul>
            <li>Email: <a href="mailto:your-email@example.com">your-email@example.com</a></li>
            <li>Phone: <a href="tel:+1234567890">+1 (234) 567-890</a></li>
        </ul>
        <h2>Follow Me</h2>
        <ul>
            <li><a href="https://www.instagram.com/yourprofile" target="_blank">Instagram</a></li>
            <li><a href="https://www.facebook.com/yourprofile" target="_blank">Facebook</a></li>
            <li><a href="https://www.twitter.com/yourprofile" target="_blank">Twitter</a></li>
        </ul>
    `;
    document.getElementById('app').innerHTML = contactsContent;
}