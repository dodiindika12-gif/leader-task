/**
 * Service to fetch, search, and analyze Beauty Advisor (BA) data and attendance
 * from the Beauty Advisor External API.
 * Base URL: https://ba.absgroup.biz.id/api/external
 * Auth Header: x-api-key / API-KEY: ba-beauty-kdi
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BA_API_BASE_URL = (process.env.BA_API_BASE_URL || 'https://ba.absgroup.biz.id/api/external').replace(/\/+$/, '');
const BA_API_KEY = process.env.BA_API_KEY || 'ba-beauty-kdi';

// In-memory cache to keep agent latency low
let baListCache = {
    timestamp: 0,
    meta: null,
    data: null,
};

let outletsCache = {
    timestamp: 0,
    data: null,
};

let brandsCache = {
    timestamp: 0,
    data: null,
};

const BA_CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes
const MASTER_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Standard fetch helper with timeout and fallback
 */
async function callBaApi(pathWithQuery, { timeoutMs = 12000 } = {}) {
    const url = `${BA_API_BASE_URL}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;
    const headers = {
        'x-api-key': BA_API_KEY,
        'API-KEY': BA_API_KEY,
        'Accept': 'application/json',
        'User-Agent': 'Bebie-AI-Assistant/1.0',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal,
            cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`BA API HTTP ${res.status}: ${errText.slice(0, 120)}`);
        }

        const json = await res.json();
        return json;
    } catch (err) {
        clearTimeout(timeoutId);
        // Fallback using curl if fetch fails
        try {
            const { stdout } = await execAsync(
                `curl -s --max-time 15 "${url}" -H "x-api-key: ${BA_API_KEY}" -H "API-KEY: ${BA_API_KEY}" -H "Accept: application/json"`
            );
            if (stdout && stdout.trim().startsWith('{')) {
                return JSON.parse(stdout);
            }
        } catch (curlErr) {
            console.error('[BA API] Curl fallback failed:', curlErr.message);
        }
        throw err;
    }
}

/**
 * Fetch all Beauty Advisors with in-memory caching and smart multi-criteria filtering
 */
export async function queryBeautyAdvisors({
    query = null,
    brand = null,
    outlet = null,
    status = 'aktif',
    limit = 50,
    offset = 0,
    forceRefresh = false,
} = {}) {
    const now = Date.now();
    let allBa = baListCache.data;

    if (forceRefresh || !allBa || (now - baListCache.timestamp > BA_CACHE_TTL_MS)) {
        const resp = await callBaApi('/ba?limit=500');
        allBa = Array.isArray(resp?.data) ? resp.data : [];
        baListCache = {
            timestamp: now,
            meta: resp?.meta || { total: allBa.length },
            data: allBa,
        };
    }

    const cleanQuery = query ? String(query).toLowerCase().trim() : null;
    const cleanBrand = brand ? String(brand).toLowerCase().trim() : null;
    const cleanOutlet = outlet ? String(outlet).toLowerCase().trim() : null;
    const cleanStatus = status && status !== 'all' ? String(status).toLowerCase().trim() : null;

    let filtered = allBa.filter((ba) => {
        // Status filter
        if (cleanStatus && String(ba.status || '').toLowerCase() !== cleanStatus) {
            return false;
        }

        // Brand filter
        if (cleanBrand) {
            const baBrand = String(ba.brand || '').toLowerCase();
            if (!baBrand.includes(cleanBrand)) return false;
        }

        // Outlet filter (supports single outlet like "B2" or multi like "B2, B3")
        if (cleanOutlet) {
            const baOutlet = String(ba.outlet || '').toLowerCase();
            const outletTokens = baOutlet.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
            const matchesOutlet = outletTokens.includes(cleanOutlet) || baOutlet.includes(cleanOutlet);
            if (!matchesOutlet) return false;
        }

        // Free text search (name, ba_code, brand, outlet)
        if (cleanQuery) {
            const haystack = [
                ba.name,
                ba.ba_code,
                ba.brand,
                ba.outlet,
            ].filter(Boolean).join(' ').toLowerCase();

            if (!haystack.includes(cleanQuery)) return false;
        }

        return true;
    });

    // Compute distribution summaries for the current filtered slice
    const brandCounts = {};
    const outletCounts = {};
    filtered.forEach((b) => {
        if (b.brand) brandCounts[b.brand] = (brandCounts[b.brand] || 0) + 1;
        if (b.outlet) {
            const parts = b.outlet.split(',').map((s) => s.trim());
            parts.forEach((p) => {
                if (p) outletCounts[p] = (outletCounts[p] || 0) + 1;
            });
        }
    });

    const paginated = filtered.slice(offset, offset + limit);

    return {
        totalInDatabase: allBa.length,
        totalMatched: filtered.length,
        limit,
        offset,
        countReturned: paginated.length,
        brandDistribution: Object.entries(brandCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([brandName, count]) => ({ brand: brandName, count })),
        outletDistribution: Object.entries(outletCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([outletName, count]) => ({ outlet: outletName, count })),
        beautyAdvisors: paginated.map((b) => ({
            id: b.id,
            baCode: b.ba_code,
            name: b.name,
            brand: b.brand,
            outlet: b.outlet,
            status: b.status,
            attendanceEnabled: Boolean(b.attendance_enabled),
            joinedAt: b.created_at,
        })),
    };
}

/**
 * Get individual BA details by ID or ba_code
 */
export async function getBeautyAdvisorDetail(idOrBaCode) {
    if (!idOrBaCode) return null;
    const cleanKey = encodeURIComponent(String(idOrBaCode).trim());
    try {
        const resp = await callBaApi(`/ba/${cleanKey}`);
        if (resp?.success && resp?.data) {
            const b = resp.data;
            return {
                id: b.id,
                baCode: b.ba_code,
                name: b.name,
                brand: b.brand,
                outlet: b.outlet,
                status: b.status,
                attendanceEnabled: Boolean(b.attendance_enabled),
                avatarUrl: b.avatar_url || null,
                joinedAt: b.created_at,
            };
        }
    } catch {
        // Fallback to cache search
        const { beautyAdvisors } = await queryBeautyAdvisors({ query: idOrBaCode, limit: 1 });
        return beautyAdvisors?.[0] || null;
    }
    return null;
}

/**
 * Query Beauty Advisor Attendance records (real-time today or historical date range)
 */
export async function queryBaAttendance({
    date = null,
    startDate = null,
    endDate = null,
    baCode = null,
    outlet = null,
    brand = null,
    status = 'all', // 'all', 'incomplete' (masih shift), 'complete' (sudah pulang)
    limit = 80,
    offset = 0,
} = {}) {
    // If no date or date range specified, default to current date in WITA (GMT+8)
    let targetDate = date;
    if (!targetDate && !startDate && !endDate) {
        const nowWita = new Date(Date.now() + 8 * 60 * 60 * 1000);
        targetDate = nowWita.toISOString().split('T')[0];
    }

    const queryParams = new URLSearchParams();
    if (targetDate) {
        queryParams.set('date', targetDate);
    } else {
        if (startDate) queryParams.set('start_date', startDate);
        if (endDate) queryParams.set('end_date', endDate);
    }

    if (baCode) queryParams.set('ba_code', baCode);
    queryParams.set('limit', '500'); // Fetch batch to allow rich client-side analytics
    queryParams.set('offset', '0');

    const resp = await callBaApi(`/attendance?${queryParams.toString()}`);
    const rawList = Array.isArray(resp?.data) ? resp.data : [];

    const cleanOutlet = outlet ? String(outlet).toLowerCase().trim() : null;
    const cleanBrand = brand ? String(brand).toLowerCase().trim() : null;
    const cleanStatus = status && status !== 'all' ? String(status).toLowerCase().trim() : null;

    let filtered = rawList.filter((item) => {
        // Status filter
        if (cleanStatus && String(item.status || '').toLowerCase() !== cleanStatus) {
            return false;
        }

        // Outlet filter
        if (cleanOutlet) {
            const itemOutlet = String(item.outlet_name || '').toLowerCase();
            if (!itemOutlet.includes(cleanOutlet)) return false;
        }

        // Brand filter
        if (cleanBrand) {
            const itemBrand = String(item.ba_brand || '').toLowerCase();
            if (!itemBrand.includes(cleanBrand)) return false;
        }

        return true;
    });

    // Compute key operational metrics
    const totalRecords = filtered.length;
    let completeCount = 0;
    let incompleteCount = 0;
    const outletStats = {};
    const brandStats = {};

    filtered.forEach((r) => {
        if (r.status === 'complete') completeCount++;
        else if (r.status === 'incomplete') incompleteCount++;

        const outName = r.outlet_name || 'Tanpa Toko';
        outletStats[outName] = (outletStats[outName] || 0) + 1;

        const brName = r.ba_brand || 'Lainnya';
        brandStats[brName] = (brandStats[brName] || 0) + 1;
    });

    const paginated = filtered.slice(offset, offset + limit);

    return {
        queryDate: targetDate || `${startDate || ''} s/d ${endDate || ''}`,
        totalAttendance: totalRecords,
        activeOnDuty: incompleteCount, // Masih aktif berjaga di toko (sudah clock in, belum clock out)
        finishedShift: completeCount,  // Sudah clock out / selesai shift
        limit,
        offset,
        countReturned: paginated.length,
        outletBreakdown: Object.entries(outletStats)
            .sort((a, b) => b[1] - a[1])
            .map(([out, count]) => ({ outlet: out, count })),
        brandBreakdown: Object.entries(brandStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([br, count]) => ({ brand: br, count })),
        attendanceLogs: paginated.map((r) => ({
            id: r.id,
            baCode: r.ba_code,
            baName: r.ba_name,
            brand: r.ba_brand,
            outlet: r.outlet_name,
            date: r.attendance_date,
            status: r.status === 'incomplete' ? 'Sedang Bertugas (Belum Clock Out)' : 'Selesai Shift (Sudah Clock Out)',
            clockIn: r.clock_in_at ? formatTimeWita(r.clock_in_at) : '-',
            clockOut: r.clock_out_at ? formatTimeWita(r.clock_out_at) : null,
            notes: r.notes || null,
        })),
    };
}

/**
 * Fetch master outlets and brands
 */
export async function getBaMasterData({ forceRefresh = false } = {}) {
    const now = Date.now();
    let outlets = outletsCache.data;
    let brands = brandsCache.data;

    if (forceRefresh || !outlets || (now - outletsCache.timestamp > MASTER_CACHE_TTL_MS)) {
        try {
            const outResp = await callBaApi('/outlets?limit=100');
            outlets = Array.isArray(outResp?.data) ? outResp.data : [];
            outletsCache = { timestamp: now, data: outlets };
        } catch (e) {
            console.warn('[BA API] Failed to fetch outlets:', e.message);
            outlets = outlets || [];
        }
    }

    if (forceRefresh || !brands || (now - brandsCache.timestamp > MASTER_CACHE_TTL_MS)) {
        try {
            const brResp = await callBaApi('/brands?limit=200');
            brands = Array.isArray(brResp?.data) ? brResp.data : [];
            brandsCache = { timestamp: now, data: brands };
        } catch (e) {
            console.warn('[BA API] Failed to fetch brands:', e.message);
            brands = brands || [];
        }
    }

    return {
        totalOutlets: outlets.length,
        totalBrands: brands.length,
        outlets: outlets.map((o) => ({ id: o.id, name: o.name, radiusMeters: o.radius_meters })),
        brands: brands.map((b) => ({ id: b.id, name: b.name })),
    };
}

function formatTimeWita(dateTimeStr) {
    if (!dateTimeStr) return '-';
    try {
        const parts = dateTimeStr.split(' ');
        if (parts.length >= 2) {
            return `${parts[1].slice(0, 5)} WITA`;
        }
        return dateTimeStr;
    } catch {
        return dateTimeStr;
    }
}
