import type { MetadataRoute } from 'next';

/** Lets owners and suppliers add IZVOR to the phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IZVOR – sledljivost lesa za EUDR',
    short_name: 'IZVOR',
    description: 'Parcele, dokumenti in izjave o skrbnem pregledu za EUDR.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#14532d',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
