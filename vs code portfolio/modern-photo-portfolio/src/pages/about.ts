export function renderAboutPage() {
    const aboutContent = `
        <section class="about">
            <h1>About Me</h1>
            <p>Welcome to my photography portfolio! I am a passionate photographer with a love for capturing the beauty of the world around us. My journey in photography began at a young age, and over the years, I have honed my skills and developed my unique style.</p>
            <p>Through my lens, I aim to tell stories and evoke emotions, whether it's through landscapes, portraits, or candid moments. I believe that photography is not just about taking pictures; it's about capturing memories and experiences that last a lifetime.</p>
            <p>Thank you for visiting my portfolio. I hope you enjoy exploring my work as much as I enjoyed creating it!</p>
        </section>
    `;
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = aboutContent;
}

export const renderAbout = renderAboutPage;