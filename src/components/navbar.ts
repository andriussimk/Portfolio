export default function Navbar() {
    return `
        <nav>
            <ul>
                <li><a href="about.html">About</a></li>
                <li><a href="galleries.html">Collections</a></li>
                <li><a href="contacts.html">Let's work together</a></li>
            </ul>
        </nav>
    `;
}

export function setupNavbar(containerId = 'navbar') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Navbar();
}