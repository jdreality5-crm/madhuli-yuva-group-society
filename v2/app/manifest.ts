import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Madhuli Yuva Group',
    short_name: 'Madhuli Yuva Group',
    description: 'Madhuli Yuva Group Society Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf8f3',
    theme_color: '#42131c',
    lang: 'gu',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
