export function createElement(tag: string, className?: string, attributes?: Record<string, string>): HTMLElement {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (attributes) {
        Object.keys(attributes).forEach(key => {
            element.setAttribute(key, attributes[key]);
        });
    }
    return element;
}

export function appendChildren(parent: HTMLElement, children: HTMLElement[]): void {
    children.forEach(child => {
        parent.appendChild(child);
    });
}

export function removeElement(element: HTMLElement): void {
    if (element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

export function toggleClass(element: HTMLElement, className: string): void {
    element.classList.toggle(className);
}