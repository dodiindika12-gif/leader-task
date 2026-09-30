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
const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let contentStatsCache = {
    timestamp: 0,
    data: null,
};

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

export function detectPlatform(url) {
    if (!url) return 'Lainnya';
    const u = url.toLowerCase();
    if (u.includes('tiktok') || u.includes('vt.tiktok') || u.includes('vm.tiktok')) return 'TikTok';
    if (u.includes('instagram') || u.includes('ig.me')) return 'Instagram';
    if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
    if (u.includes('facebook') || u.includes('fb.watch')) return 'Facebook';
    return 'Lainnya';
}

/**
 * Query Beauty Advisor content submissions (TikTok / Instagram / Social Media promo posts)
 * Endpoint: /contents
 */
export async function queryBaContents({
    date = null,
    startDate = null,
    endDate = null,
    baCode = null,
    brand = null,
    outlet = null,
    status = 'all', // 'all', 'verified', 'pending'
    search = null,
    limit = 30,
    offset = 0,
} = {}) {
    const queryParams = new URLSearchParams();

    if (date) {
        queryParams.set('start_date', date);
        queryParams.set('end_date', date);
    } else {
        if (startDate) queryParams.set('start_date', startDate);
        if (endDate) queryParams.set('end_date', endDate);
    }

    if (baCode) queryParams.set('ba_code', baCode);
    queryParams.set('limit', '500');
    queryParams.set('offset', '0');

    const resp = await callBaApi(`/contents?${queryParams.toString()}`);
    const rawList = Array.isArray(resp?.data) ? resp.data : [];

    const cleanBrand = brand ? String(brand).toLowerCase().trim() : null;
    const cleanOutlet = outlet ? String(outlet).toLowerCase().trim() : null;
    const cleanStatus = status && status !== 'all' ? String(status).toLowerCase().trim() : null;
    const cleanSearch = search ? String(search).toLowerCase().trim() : null;

    let filtered = rawList.filter((item) => {
        // Status filter: verified vs pending
        if (cleanStatus === 'verified' && item.status !== true) return false;
        if (cleanStatus === 'pending' && item.status === true) return false;

        // Brand filter
        if (cleanBrand) {
            const itemBrand = String(item.brand || '').toLowerCase();
            if (!itemBrand.includes(cleanBrand)) return false;
        }

        // Outlet filter
        if (cleanOutlet) {
            const itemOutlet = String(item.outlet || '').toLowerCase();
            if (!itemOutlet.includes(cleanOutlet)) return false;
        }

        // Search in ba_name, ba_code, brand, outlet, content_link
        if (cleanSearch) {
            const haystack = [
                item.ba_name,
                item.ba_code,
                item.brand,
                item.outlet,
                item.content_link,
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(cleanSearch)) return false;
        }

        return true;
    });

    const totalRecords = filtered.length;
    let verifiedCount = 0;
    let pendingCount = 0;
    const brandStats = {};
    const outletStats = {};
    const platformStats = {};

    filtered.forEach((r) => {
        if (r.status === true) verifiedCount++;
        else pendingCount++;

        const br = r.brand || 'Lainnya';
        brandStats[br] = (brandStats[br] || 0) + 1;

        const out = r.outlet || 'Lainnya';
        outletStats[out] = (outletStats[out] || 0) + 1;

        const plat = detectPlatform(r.content_link);
        platformStats[plat] = (platformStats[plat] || 0) + 1;
    });

    const paginated = filtered.slice(offset, offset + limit);

    return {
        queryFilter: {
            date: date || (startDate && endDate ? `${startDate} s/d ${endDate}` : 'Semua Tanggal'),
            brand: brand || 'Semua Brand',
            outlet: outlet || 'Semua Outlet',
            status: status || 'all',
        },
        totalContents: totalRecords,
        verifiedCount,
        pendingCount,
        limit,
        offset,
        countReturned: paginated.length,
        brandBreakdown: Object.entries(brandStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([b, count]) => ({ brand: b, count })),
        outletBreakdown: Object.entries(outletStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([o, count]) => ({ outlet: o, count })),
        platformBreakdown: Object.entries(platformStats)
            .sort((a, b) => b[1] - a[1])
            .map(([p, count]) => ({ platform: p, count })),
        contents: paginated.map((r) => ({
            id: r.id,
            baCode: r.ba_code,
            baName: r.ba_name,
            brand: r.brand,
            outlet: r.outlet,
            contentLink: r.content_link,
            platform: detectPlatform(r.content_link),
            contentDate: r.content_date,
            status: r.status === true ? 'Terverifikasi' : 'Menunggu Verifikasi',
            createdAt: r.created_at,
        })),
    };
}

/**
 * Query Beauty Advisor content KPI statistics & warning stages (SP1, SP2, SP3, Surat Teguran)
 * Endpoint: /content-stats
 */
export async function queryBaContentStats({
    brand = null,
    outlet = null,
    baCode = null,
    warningStage = null,
    recommendedStage = 'all', // 'all', 'SP3', 'SP2', 'SP1', 'SURAT_PERINGATAN', 'SURAT_TEGURAN'
    hasMissed = null, // boolean
    search = null,
    sortBy = 'missed_desc', // 'missed_desc', 'submitted_desc', 'compliance_desc', 'compliance_asc'
    limit = 40,
    offset = 0,
    forceRefresh = false,
} = {}) {
    const now = Date.now();
    let allStats = contentStatsCache.data;

    if (forceRefresh || !allStats || (now - contentStatsCache.timestamp > STATS_CACHE_TTL_MS)) {
        const resp = await callBaApi('/content-stats?limit=500');
        allStats = Array.isArray(resp?.data) ? resp.data : [];
        contentStatsCache = {
            timestamp: now,
            data: allStats,
        };
    }

    const cleanBrand = brand ? String(brand).toLowerCase().trim() : null;
    const cleanOutlet = outlet ? String(outlet).toLowerCase().trim() : null;
    const cleanBaCode = baCode ? String(baCode).trim() : null;
    const cleanWarning = warningStage && warningStage !== 'all' ? String(warningStage).toUpperCase().trim() : null;
    const cleanRecommended = recommendedStage && recommendedStage !== 'all' ? String(recommendedStage).toUpperCase().trim() : null;
    const cleanSearch = search ? String(search).toLowerCase().trim() : null;

    let filtered = allStats.filter((item) => {
        // BA Code exact match if provided
        if (cleanBaCode && String(item.ba_code || '').trim() !== cleanBaCode) {
            return false;
        }

        // Brand filter
        if (cleanBrand) {
            const itemBrand = String(item.brand || '').toLowerCase();
            if (!itemBrand.includes(cleanBrand)) return false;
        }

        // Outlet filter
        if (cleanOutlet) {
            const itemOutlet = String(item.outlet || '').toLowerCase();
            if (!itemOutlet.includes(cleanOutlet)) return false;
        }

        // Warning stage filter
        if (cleanWarning) {
            const lastStage = String(item.last_warning_stage || 'none').toUpperCase();
            if (cleanWarning === 'NONE' || cleanWarning === 'BELUM_ADA') {
                if (item.last_warning_stage) return false;
            } else if (!lastStage.includes(cleanWarning)) {
                return false;
            }
        }

        // Recommended next stage filter
        if (cleanRecommended) {
            const recStage = String(item.recommended_next_stage || '').toUpperCase();
            if (!recStage.includes(cleanRecommended)) return false;
        }

        // Missed filter
        if (hasMissed === true && (item.missed_count || 0) <= 0) return false;
        if (hasMissed === false && (item.missed_count || 0) > 0) return false;

        // Search text
        if (cleanSearch) {
            const haystack = [
                item.ba_name,
                item.ba_code,
                item.brand,
                item.outlet,
                item.recommended_next_stage,
                item.last_warning_stage,
            ].filter(Boolean).join(' ').toLowerCase();
            if (!haystack.includes(cleanSearch)) return false;
        }

        return true;
    });

    // Compute key metrics
    let totalSubmissions = 0;
    let totalMissed = 0;
    const stageCounts = {};
    const brandSubmissionMap = {};
    const outletSubmissionMap = {};

    filtered.forEach((item) => {
        const sub = item.submitted_count || 0;
        const mis = item.missed_count || 0;
        totalSubmissions += sub;
        totalMissed += mis;

        const stage = item.recommended_next_stage || 'Aman (Tanpa Rekomendasi)';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;

        if (item.brand) {
            if (!brandSubmissionMap[item.brand]) brandSubmissionMap[item.brand] = { submitted: 0, missed: 0, count: 0 };
            brandSubmissionMap[item.brand].submitted += sub;
            brandSubmissionMap[item.brand].missed += mis;
            brandSubmissionMap[item.brand].count += 1;
        }

        if (item.outlet) {
            const parts = item.outlet.split(',').map((s) => s.trim()).filter(Boolean);
            parts.forEach((out) => {
                if (!outletSubmissionMap[out]) outletSubmissionMap[out] = { submitted: 0, missed: 0, count: 0 };
                outletSubmissionMap[out].submitted += sub;
                outletSubmissionMap[out].missed += mis;
                outletSubmissionMap[out].count += 1;
            });
        }
    });

    // Sorting
    filtered.sort((a, b) => {
        const subA = a.submitted_count || 0;
        const subB = b.submitted_count || 0;
        const misA = a.missed_count || 0;
        const misB = b.missed_count || 0;
        const weeksA = a.total_weeks || 1;
        const weeksB = b.total_weeks || 1;
        const rateA = subA / weeksA;
        const rateB = subB / weeksB;

        if (sortBy === 'submitted_desc') return subB - subA;
        if (sortBy === 'compliance_desc') return rateB - rateA;
        if (sortBy === 'compliance_asc') return rateA - rateB;
        // Default: missed_desc (paling banyak bolos / perlu atensi manajemen)
        return misB - misA;
    });

    const paginated = filtered.slice(offset, offset + limit);

    const firstItem = allStats[0] || {};
    const totalSlots = totalSubmissions + totalMissed;
    const overallComplianceRate = totalSlots > 0 ? `${Math.round((totalSubmissions / totalSlots) * 100)}%` : '0%';

    return {
        evaluationPeriod: {
            countedFrom: firstItem.counted_from || null,
            countedTo: firstItem.counted_to || null,
            totalWeeksEvaluated: firstItem.total_weeks || null,
        },
        totalBaMonitored: filtered.length,
        totalSubmissions,
        totalMissed,
        overallComplianceRate,
        stageBreakdown: Object.entries(stageCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([stage, count]) => ({ stage, count })),
        brandSummary: Object.entries(brandSubmissionMap)
            .map(([br, d]) => {
                const total = d.submitted + d.missed;
                return {
                    brand: br,
                    baCount: d.count,
                    submitted: d.submitted,
                    missed: d.missed,
                    complianceRate: total > 0 ? `${Math.round((d.submitted / total) * 100)}%` : '0%',
                };
            })
            .sort((a, b) => b.baCount - a.baCount)
            .slice(0, 10),
        limit,
        offset,
        countReturned: paginated.length,
        baStats: paginated.map((s) => {
            const weeks = s.total_weeks || 1;
            const sub = s.submitted_count || 0;
            const rate = Math.round((sub / weeks) * 100);
            return {
                baId: s.ba_id,
                baCode: s.ba_code,
                baName: s.ba_name,
                brand: s.brand,
                outlet: s.outlet,
                joinDate: s.join_date,
                submittedCount: sub,
                missedCount: s.missed_count || 0,
                totalWeeks: weeks,
                complianceRate: `${rate}%`,
                lastWarningStage: s.last_warning_stage || 'Belum Pernah SP',
                lastLetterIssuedAt: s.last_letter_issued_at || '-',
                recommendedNextStage: s.recommended_next_stage || 'Aman',
                totalLettersReceived: s.total_letters_received || 0,
            };
        }),
    };
}

