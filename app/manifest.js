export default function manifest() {
  return {
    name: 'Task ABS Tools | Semua Divisi',
    short_name: 'Task ABS',
    description: 'Dashboard manajemen tugas, jadwal rapat & worksheet, notulensi MoM, dan koordinasi kerja tim.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#4f46e5',
    lang: 'id',
    categories: ['productivity', 'business', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard Utama',
        short_name: 'Dashboard',
        description: 'Buka dashboard utama tugas & KPI',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
      },
      {
        name: 'Jadwal Rapat & Worksheet',
        short_name: 'Jadwal',
        description: 'Lihat agenda rapat dan worksheet hari ini',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
      },
      {
        name: 'Notes & MoM',
        short_name: 'Notes',
        description: 'Buka notulensi rapat dan catatan post-it',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
      }
    ]
  };
}
