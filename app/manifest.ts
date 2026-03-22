import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OrderFlow',
    short_name: 'OrderFlow',
    description: 'Internal order management system',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617', // slate-950
    theme_color: '#4f46e5', // indigo-600
  }
}
