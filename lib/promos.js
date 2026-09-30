/**
 * Service to fetch and filter active outlet promos from Beauty Kendari Promo API
 * Endpoint: https://promo.beautykendari.id/api/promos/list
 * Auth: Bearer absgroup-kdi
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROMO_API_URL = process.env.PROMO_API_URL || 'https://promo.beautykendari.id/api/promos/list';
const PROMO_API_TOKEN = process.env.PROMO_API_TOKEN || 'absgroup-kdi';

// Simple in-memory cache to keep response times near-instant
let promoCache = {
    timestamp: 0,
    meta: null,
    data: null,
};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

/**
 * Fetch raw today promos with retry and curl fallback
 */
export async function fetchTodayPromos({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && promoCache.data && (now - promoCache.timestamp < CACHE_TTL_MS)) {
        return {
            meta: promoCache.meta,
            promos: promoCache.data,
        };
    }

    // Attempt standard fetch with retry
    for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
            const res = await fetch(PROMO_API_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${PROMO_API_TOKEN}`,
                    'Accept': 'application/json',
                    'User-Agent': 'Bebie-AI-Assistant/1.0',
                },
                signal: controller.signal,
                cache: 'no-store',
            });

            clearTimeout(timeoutId);

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Promo API status ${res.status}: ${errText.slice(0, 100)}`);
            }

            const json = await res.json();
            const promoList = Array.isArray(json) ? json : (Array.isArray(json?.promos) ? json.promos : []);

            const meta = {
                date: json?.date || new Date().toISOString().split('T')[0],
                timezone: json?.timezone || 'Asia/Makassar',
                count: json?.count || promoList.length,
                generated_at: json?.generated_at || new Date().toISOString(),
            };

            promoCache = {
                timestamp: now,
                meta,
                data: promoList,
            };

            return {
                meta,
                promos: promoList,
            };
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            console.warn(`[PromoAPI] Fetch attempt ${attempt} failed:`, fetchErr.message);
            if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 800));
            }
        }
    }

    // If fetch failed twice, try system curl as fallback
    try {
        console.warn('[PromoAPI] Trying curl fallback...');
        const { stdout } = await execAsync(
            `curl -s --ipv4 --max-time 15 "${PROMO_API_URL}" -H "Authorization: Bearer ${PROMO_API_TOKEN}"`
        );
        if (stdout && stdout.trim().startsWith('{')) {
            const json = JSON.parse(stdout);
            const promoList = Array.isArray(json) ? json : (Array.isArray(json?.promos) ? json.promos : []);
            const meta = {
                date: json?.date || new Date().toISOString().split('T')[0],
                timezone: json?.timezone || 'Asia/Makassar',
                count: json?.count || promoList.length,
                generated_at: json?.generated_at || new Date().toISOString(),
            };
            promoCache = {
                timestamp: now,
                meta,
                data: promoList,
            };
            return { meta, promos: promoList };
        }
    } catch (curlErr) {
        console.error('[PromoAPI] Curl fallback also failed:', curlErr.message);
    }

    // If all fail, return stale cache if available
    if (promoCache.data) {
        console.warn('[PromoAPI] Returning stale cache due to network errors.');
        return {
            meta: promoCache.meta,
            promos: promoCache.data,
        };
    }

    throw new Error('Gagal memuat data promo hari ini dari server Beauty Kendari. Silakan coba sesaat lagi.');
}

function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return isoStr;
    }
}

/**
 * Query and filter active promos by brand, outlet, promo type, and search keyword
 */
export async function queryActivePromos({
    brand = null,
    outlet = null,
    jenisPromo = null,
    search = null,
    status = 'sedang_berjalan',
    flashSaleOnly = false,
    limit = 25,
} = {}) {
    const { meta, promos } = await fetchTodayPromos();

    const cleanBrand = brand ? String(brand).toLowerCase().trim() : null;
    const cleanOutlet = outlet ? String(outlet).toLowerCase().trim() : null;
    const cleanJenis = jenisPromo ? String(jenisPromo).toLowerCase().trim() : null;
    const cleanSearch = search ? String(search).toLowerCase().trim() : null;
    const cleanStatus = status && status !== 'all' ? String(status).toLowerCase().trim() : null;

    const filtered = promos.filter((item) => {
        // Filter by promo status ('sedang_berjalan' | 'akan_berjalan' | 'berakhir')
        if (cleanStatus) {
            const itemStatus = String(item.status_promo || '').toLowerCase().trim();
            if (itemStatus && itemStatus !== cleanStatus) {
                return false;
            }
        }

        // Filter by flash sale
        if (flashSaleOnly && !item.is_flash_sale && !item.is_flash_sale_active) {
            return false;
        }

        // Filter by brand
        if (cleanBrand) {
            const itemBrand = String(item.brand || '').toLowerCase();
            if (!itemBrand.includes(cleanBrand)) return false;
        }

        // Filter by jenis promo (diskon, gwp, voucher, bundling, etc.)
        if (cleanJenis) {
            const itemJenis = String(item.jenis_promo || '').toLowerCase();
            if (!itemJenis.includes(cleanJenis)) return false;
        }

        // Filter by outlet (matches outlet code, outlet name, or "SEMUA")
        if (cleanOutlet) {
            const outlets = Array.isArray(item.outlets) ? item.outlets : [];
            const appliesToAll = outlets.some((o) => {
                const kode = String(o.kode || '').toLowerCase();
                const nama = String(o.nama || '').toLowerCase();
                return kode === 'semua' || nama.includes('semua');
            });

            if (!appliesToAll) {
                const matchesSpecific = outlets.some((o) => {
                    const kode = String(o.kode || '').toLowerCase();
                    const nama = String(o.nama || '').toLowerCase();
                    return kode === cleanOutlet ||
                           nama.includes(cleanOutlet) ||
                           cleanOutlet.includes(kode) ||
                           cleanOutlet.includes(nama);
                });
                if (!matchesSpecific) return false;
            }
        }

        // Filter by search keyword across name, brand, mechanism
        if (cleanSearch) {
            const searchHaystack = [
                item.nama_promo,
                item.brand,
                item.mekanisme,
                item.jenis_promo,
            ].filter(Boolean).join(' ').toLowerCase();

            if (!searchHaystack.includes(cleanSearch)) return false;
        }

        return true;
    });

    // Unique summary for context
    const brandSet = new Set();
    const outletSet = new Set();
    promos.forEach((p) => {
        if (p.brand) brandSet.add(p.brand.trim());
        if (Array.isArray(p.outlets)) {
            p.outlets.forEach((o) => {
                if (o.nama) outletSet.add(o.nama);
            });
        }
    });

    const items = filtered.slice(0, limit).map((p) => ({
        id: p.id,
        nomor: p.nomor,
        brand: p.brand || 'Umum',
        nama_promo: p.nama_promo,
        status_promo: p.status_promo || 'sedang_berjalan',
        jenis_promo: p.jenis_promo,
        mekanisme: p.mekanisme,
        periode: `${formatDate(p.periode_mulai)} s/d ${formatDate(p.periode_selesai)}`,
        tampil_di_tv: Boolean(p.tampil_di_tv),
        is_flash_sale: Boolean(p.is_flash_sale || p.is_flash_sale_active),
        product_scope: p.product_scope === 'all_product' ? 'Semua Produk' : 'Produk Tertentu (Selected)',
        material_promosi: p.material_promosi || null,
        link_sku: p.link_sku || null,
        outlets: Array.isArray(p.outlets)
            ? p.outlets.map((o) => `${o.nama} (${o.kode})`).join(', ')
            : 'Semua Outlet',
    }));

    return {
        date: meta?.date,
        totalActiveToday: meta?.count || promos.length,
        totalMatched: filtered.length,
        countReturned: items.length,
        filterApplied: {
            status: cleanStatus || 'all',
            brand: cleanBrand,
            outlet: cleanOutlet,
            jenisPromo: cleanJenis,
            search: cleanSearch,
            flashSaleOnly,
        },
        availableBrandsSample: Array.from(brandSet).slice(0, 15),
        availableOutletsSample: Array.from(outletSet),
        items,
    };
}

