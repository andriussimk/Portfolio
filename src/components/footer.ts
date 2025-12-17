export const Footer = () => {
    return `
        <footer>
            <div class="footer-content">
                <p>&copy; ${new Date().getFullYear()} Your Name. All rights reserved.</p>
                <ul class="social-links">
                    <li><a href="https://www.instagram.com/yourprofile" target="_blank">Instagram</a></li>
                    <li><a href="https://www.facebook.com/yourprofile" target="_blank">Facebook</a></li>
                    <li><a href="https://www.twitter.com/yourprofile" target="_blank">Twitter</a></li>
                </ul>
            </div>
        </footer>
    `;
};

export function setupFooter(containerId = 'footer') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Footer();
}