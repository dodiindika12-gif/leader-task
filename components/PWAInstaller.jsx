'use client';

import React, { useState, useEffect } from 'react';

export default function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 1. Daftarkan Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (reg) => {
            console.log('[PWA] Service Worker aktif di scope:', reg.scope);
          },
          (err) => {
            console.warn('[PWA] Gagal mendaftarkan Service Worker:', err);
          }
        );
      });
    }

    // 2. Deteksi apakah sudah terinstal (Standalone mode)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      
      setIsInstalled(isStandaloneMode);
    };
    checkStandalone();

    // 3. Deteksi iOS
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
      setIsIOS(isIosDevice);
    };
    checkIOS();

    // 4. Tangkap event beforeinstallprompt (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Tangkap event saat aplikasi berhasil diinstal
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('[PWA] Aplikasi berhasil diinstal!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Dengarkan trigger instalasi manual dari tombol sidebar / settings
    const handleManualTrigger = () => {
      setIsDismissed(false);
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
      if (isIosDevice) {
        setShowIOSGuide(true);
      } else if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        alert('Panduan Instalasi:\n- Android (Chrome): Ketuk menu titik tiga (⋮) > "Instal aplikasi" atau "Tambahkan ke Layar Utama".\n- Komputer (Chrome/Edge): Klik ikon instalasi (layar komputer dengan panah ke bawah) di ujung kanan bilah alamat URL.');
      }
    };

    window.addEventListener('open-pwa-install', handleManualTrigger);

    // 7. Cek status dismiss dari session/localStorage
    try {
      const dismissedUntil = localStorage.getItem('task_abs_pwa_dismissed');
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install', handleManualTrigger);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Fallback panduan jika browser tidak mendukung trigger otomatis
      alert('Untuk menginstal aplikasi ini:\n1. Buka menu browser (ikon titik tiga di kanan atas).\n2. Pilih "Instal Aplikasi" atau "Tambahkan ke Layar Utama".');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Keputusan pengguna: ${outcome}`);
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error('[PWA] Kesalahan instalasi:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      // Sembunyikan banner selama 3 hari
      const expiry = Date.now() + 3 * 24 * 60 * 60 * 1000;
      localStorage.setItem('task_abs_pwa_dismissed', String(expiry));
    } catch (e) {}
  };

  // Jangan tampilkan jika sudah diinstal atau pengguna menutupnya
  if (isInstalled || isDismissed) {
    return null;
  }

  // Hanya tampilkan jika browser memberi sinyal installable atau di perangkat iOS (belum standalone)
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {/* Banner / Floating Card Instalasi PWA */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
        <div className="rounded-3xl bg-slate-900/95 backdrop-blur-xl text-white p-4 shadow-2xl border border-white/15 flex items-center gap-3.5">
          {/* App Icon */}
          <div className="w-12 h-12 rounded-2xl bg-white p-1 shrink-0 overflow-hidden shadow-md flex items-center justify-center">
            <img 
              src="/icons/icon-192x192.png" 
              alt="Task ABS Logo" 
              className="w-full h-full object-contain"
            />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white tracking-tight">Instal Task ABS</h4>
              <span className="text-[9px] bg-indigo-500/30 text-indigo-300 font-extrabold px-1.5 py-0.2 rounded-md border border-indigo-400/30">
                PWA
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2">
              Buka lebih cepat dari Home Screen layaknya aplikasi native tanpa bilah browser.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition transform active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-download mr-1.5 text-[11px]"></i>
              Instal
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-xs transition cursor-pointer"
              title="Tutup banner"
              aria-label="Tutup"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Panduan Khusus iOS (Safari) */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-slate-800 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shadow-xs">
                  <i className="fa-brands fa-apple"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Instal di iPhone / iPad</h3>
                  <p className="text-[11px] text-slate-400">Tambahkan ke Layar Utama</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Ketuk Ikon Bagikan (*Share*)</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ketuk tombol <i className="fa-solid fa-arrow-up-from-bracket text-indigo-600 font-bold mx-1"></i> di bilah menu bawah browser Safari.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Pilih "Add to Home Screen"</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Gulir ke bawah dan ketuk opsi <strong>"Tambahkan ke Layar Utama" (➕)</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="w-6 h-6 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <div>
                  <p className="font-semibold text-slate-800">Konfirmasi & Nikmati</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ketuk <strong>Tambah (*Add*)</strong> di sudut kanan atas. Aplikasi Task ABS siap digunakan dari layar depan Anda!
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
