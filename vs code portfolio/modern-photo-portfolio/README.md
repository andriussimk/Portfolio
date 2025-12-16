# Modern Photography Portfolio

This project is a minimalist and modern photography portfolio/gallery website designed to showcase photography collections. It includes various pages such as an About page, a Contacts page, and a Galleries page, along with individual collection pages for detailed viewing.

## Project Structure

```
modern-photo-portfolio
├── index.html          # Main entry point of the website
├── about.html          # About page detailing the photographer's work
├── contacts.html       # Contact information and social media links
├── galleries.html      # Displays photography gallery collections
├── collection.html     # Showcases a specific photography collection
├── src
│   ├── main.ts         # Initializes the application and handles routing
│   ├── pages
│   │   ├── about.ts    # Renders the About page content
│   │   ├── contacts.ts  # Renders the Contacts page content
│   │   ├── galleries.ts  # Renders the Galleries page
│   │   └── collection.ts # Renders a specific collection page
│   ├── components
│   │   ├── navbar.ts    # Navbar component for navigation
│   │   ├── footer.ts     # Footer component with copyright info
│   │   ├── gallery-grid.ts # Displays photos in a grid layout
│   │   └── lightbox.ts   # Handles full-resolution image display
│   ├── styles
│   │   ├── base.css      # Base styles for typography and layout
│   │   ├── layout.css     # Overall layout styles
│   │   └── components
│   │       ├── navbar.css  # Styles for the Navbar component
│   │       ├── grid.css    # Styles for the photo grid layout
│   │       └── lightbox.css # Styles for the Lightbox component
│   ├── data
│   │   ├── galleries.json  # Data for photography gallery collections
│   │   └── contacts.json   # Contact information
│   └── utils
│       ├── dom.ts         # Utility functions for DOM manipulation
│       └── types.ts       # TypeScript types and interfaces
├── public
│   └── images
│       ├── collections
│       │   └── .gitkeep   # Placeholder for collections directory
│       └── thumbnails
│           └── .gitkeep   # Placeholder for thumbnails directory
├── package.json           # npm configuration file
├── tsconfig.json          # TypeScript configuration file
├── vite.config.ts         # Vite configuration file
└── README.md              # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the project directory:
   ```
   cd modern-photo-portfolio
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and go to `http://localhost:3000` to view the website.

## Features

- Minimalist design focused on showcasing photography.
- Responsive layout for optimal viewing on various devices.
- Lightbox feature for viewing full-resolution images.
- Easy navigation between different pages and collections.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.