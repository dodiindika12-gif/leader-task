export default function manifest() {
  return {
    name: 'Busana | Beauty Asana',
    short_name: 'Busana',
    description: 'Beauty Asana. Manajemen task dan project untuk Beauty agar bisa balance dan seimbang.',
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#ff008c',
    lang: 'id',
    categories: ['productivity', 'business', 'lifestyle'],
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
        name: 'Dashboard Busana',
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
        description: 'Buka notulensi rapat dan catatan kerja',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }]
      }
    ]
  };
}
