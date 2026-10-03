'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * BebieAvatar - Komponen Avatar Pintar Bebie (Beauty Bestie AI)
 * Terinspirasi dari muse.ai:
 * - State 'idle': video idle.mp4 (looping halus) atau static.webp jika mode hemat/statis aktif
 * - State 'working': video working.mp4 saat AI memproses data, streaming, atau meracik laporan
 * - State 'learning': video learning.mp4 saat AI mengingat memori atau mempelajari skill baru
 * - State 'static': gambar statis static.webp
 */

const VIDEO_SOURCES = {
    idle: '/bebie/idle.mp4',
    working: '/bebie/working.mp4',
    learning: '/bebie/learning.mp4',
};

const STATIC_IMAGE = '/bebie/static.webp';

const SIZE_CLASSES = {
    xs: 'w-6 h-6 rounded-lg text-[9px]',
    sm: 'w-8 h-8 rounded-full text-xs',
    md: 'w-10 h-10 rounded-2xl text-sm',
    lg: 'w-16 h-16 rounded-2xl text-base',
    xl: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl text-xl',
};

export default function BebieAvatar({
    state = 'idle', // 'idle' | 'working' | 'learning' | 'static'
    size = 'md',    // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom'
    className = '',
    useStaticIdle = false,
    glow = true,
    title,
    onClick,
}) {
    const videoRef = useRef(null);
    const [hasVideoError, setHasVideoError] = useState(false);

    // Tentukan apakah harus menggunakan gambar statis atau video
    const isStatic = state === 'static' || (state === 'idle' && useStaticIdle) || hasVideoError;
    const activeVideoSrc = VIDEO_SOURCES[state] || VIDEO_SOURCES.idle;

    // Pastikan video otomatis diputar saat source atau state berubah
    useEffect(() => {
        if (!isStatic && videoRef.current) {
            const el = videoRef.current;
            el.currentTime = 0;
            const playPromise = el.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Browser autoplay policy / low battery mode handling
                });
            }
        }
    }, [state, isStatic, activeVideoSrc]);

    // Ukuran kontainer avatar
    const sizeClass = SIZE_CLASSES[size] || (size === 'custom' ? '' : SIZE_CLASSES.md);

    // Styling aura / ring berdasarkan state
    let stateStyles = {
        ring: 'border-pink-200/90 shadow-xs shadow-pink-500/10',
        glowAura: 'from-pink-300/30 to-rose-200/30',
    };

    if (state === 'working') {
        stateStyles = {
            ring: 'border-pink-400 ring-2 ring-pink-400/40 shadow-md shadow-pink-500/25',
            glowAura: 'from-pink-500/50 via-rose-500/50 to-amber-400/40 animate-pulse',
        };
    } else if (state === 'learning') {
        stateStyles = {
            ring: 'border-purple-400 ring-2 ring-purple-400/50 shadow-md shadow-purple-500/30',
            glowAura: 'from-purple-500/60 via-fuchsia-500/50 to-indigo-500/50 animate-pulse',
        };
    }

    const defaultTitle = title || (
        state === 'working' ? 'Bebie sedang memproses data' :
        state === 'learning' ? 'Bebie sedang menyimpan memori / mempelajari skill' :
        'Bebie - Beauty Bestie AI'
    );

    return (
        <div
            className={`relative shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
            title={defaultTitle}
        >
            {/* Ambient Glow Aura di belakang avatar */}
            {glow && (
                <div
                    className={`absolute -inset-1 rounded-full bg-gradient-to-r ${stateStyles.glowAura} blur-xs -z-10 transition-all duration-500`}
                    aria-hidden="true"
                />
            )}

            {/* Kontainer Avatar */}
            <div
                className={`relative overflow-hidden border bg-pink-100 flex items-center justify-center transition-all duration-300 ${sizeClass} ${stateStyles.ring}`}
            >
                {isStatic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={STATIC_IMAGE}
                        alt="Bebie AI"
                        className="w-full h-full object-cover"
                        loading="eager"
                    />
                ) : (
                    <video
                        ref={videoRef}
                        key={activeVideoSrc}
                        src={activeVideoSrc}
                        poster={STATIC_IMAGE}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        onError={() => setHasVideoError(true)}
                        className="w-full h-full object-cover pointer-events-none"
                    />
                )}
            </div>
        </div>
    );
}
