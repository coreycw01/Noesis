import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Noesis',
    short_name: 'Noesis',
    description: 'A private workspace for sources, inquiries, positions, works, practices, and intellectual change.',
    start_url: '/',
    display: 'standalone',
    background_color: '#11100d',
    theme_color: '#11100d',
    // Writing, maps, and drawing all benefit from rotation on phones and tablets.
    orientation: 'any',
    categories: ['education', 'productivity', 'books'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
