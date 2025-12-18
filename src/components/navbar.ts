export default function Navbar() {
    return `
        <nav>
            <ul>
                <li><a href="about.html">About</a></li>
                <li><a href="galleries.html">Galleries</a></li>
                <li><a href="contacts.html">Contact</a></li>
            </ul>
        </nav>
    `;
}

export function setupNavbar(containerId = 'navbar') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = Navbar();
}