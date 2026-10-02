/**
 * Service to connect to Affari Retail Member & Loyalty API
 * Base URL: https://api.affariretail.id/beauty
 * Auth: affari-token: beauty
 */

const BASE_URL = (process.env.AFFARI_API_BASE_URL || 'https://api.affariretail.id/beauty').replace(/\/+$/, '');
const API_TOKEN = process.env.AFFARI_API_TOKEN || 'beauty';

const HEADERS = {
    'affari-token': API_TOKEN,
    'Accept': 'application/json',
    'User-Agent': 'Bebie-AI-Assistant/1.0',
};

/**
 * Format and sanitize raw member object from Affari API
 */
function normalizeMember(m) {
    if (!m) return null;

    // Calculate age if TglLahir is available
    let usia = null;
    if (m.TglLahir && !m.TglLahir.startsWith('0000')) {
        const birth = new Date(m.TglLahir);
        if (!isNaN(birth.getTime())) {
            const ageDiff = Date.now() - birth.getTime();
            usia = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
        }
    }

    // Check expiry
    let isExpired = false;
    if (m.TglBerakhir && !m.TglBerakhir.startsWith('0000')) {
        const exp = new Date(m.TglBerakhir);
        if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
            isExpired = true;
        }
    }

    const cleanPhone = (m.Ponsel || m.Telepon || '').trim();
    let waLink = null;
    if (cleanPhone) {
        let waNum = cleanPhone.replace(/[^0-9]/g, '');
        if (waNum.startsWith('08')) waNum = '62' + waNum.slice(1);
        if (waNum.startsWith('62')) waLink = `https://wa.me/${waNum}`;
    }

    return {
        kode: m.Kode || '',
        nama: (m.Nama || '').trim(),
        alias: (m.Alias || '').trim(),
        no_kartu: (m.NoKartu || '').trim(),
        ponsel: cleanPhone,
        wa_link: waLink,
        email: (m.Email || '').trim(),
        poin_akhir: Number(m.PointAkhir) || 0,
        poin_awal: Number(m.PointAwal) || 0,
        nilai_belanja_total: Number(m.NilaiPlus) || 0,
        status: (m.Status || 'AKTIF').toUpperCase(),
        is_expired: isExpired,
        tgl_berakhir: m.TglBerakhir ? m.TglBerakhir.split(' ')[0] : '',
        tgl_regis: m.TglRegis ? m.TglRegis.split(' ')[0] : '',
        tgl_aktif: m.TglAktif ? m.TglAktif.split(' ')[0] : '',
        outlet: (m.Outlet || '').trim(),
        kelompok: (m.Kelompok || m.JMember || 'REGULAR').trim(),
        level_harga: (m.LvHarga || 'REGULAR').trim(),
        kota: (m.Kota || '').trim(),
        wilayah: (m.Wilayah || '').trim(),
        alamat: (m.Alamat || '').trim(),
        gender: (m.Gender || '').trim(),
        pekerjaan: (m.Pekerjaan || '').trim(),
        usia: usia,
        tgl_lahir: m.TglLahir ? m.TglLahir.split(' ')[0] : '',
    };
}

/**
 * Deteksi parameter kolom pencarian secara cerdas dari query pengguna
 */
function detectSearchField(query) {
    const q = String(query || '').trim();
    if (!q) return { field: 'Nama', value: '' };

    // Format Outlet: BT01, BT02, dst
    if (/^BT\d{1,3}$/i.test(q)) {
        return { field: 'Outlet', value: q.toUpperCase() };
    }

    // Nomor HP (08... atau 62...)
    const numericOnly = q.replace(/[^0-9]/g, '');
    if ((q.startsWith('08') || q.startsWith('62') || q.startsWith('+62')) && numericOnly.length >= 9) {
        let phone = numericOnly;
        if (phone.startsWith('62')) phone = '0' + phone.slice(2);
        return { field: 'Ponsel', value: phone };
    }

    // Nomor Kartu (numerik panjang > 14 digit)
    if (/^\d{14,25}$/.test(q)) {
        return { field: 'NoKartu', value: q };
    }

    // Kode Member (misal 0200142399 atau M/BT...)
    if (/^(020\d{6,8}|M\/[A-Z0-9]+)$/i.test(q)) {
        return { field: 'Kode', value: q };
    }

    // Default ke nama pelanggan
    return { field: 'Nama', value: q };
}

/**
 * Cari data member loyalty Affari Retail
 */
export async function searchAffariMembers({ query = '', field, value, limit = 25 } = {}) {
    try {
        let targetField = field;
        let targetValue = value;

        if (!targetField && query) {
            const detected = detectSearchField(query);
            targetField = detected.field;
            targetValue = detected.value;
        }

        let url = `${BASE_URL}/api/member`;
        if (targetField && targetValue) {
            url += `?field=${encodeURIComponent(targetField)}&value=${encodeURIComponent(targetValue)}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(url, {
            headers: HEADERS,
            signal: controller.signal,
            cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Affari Member API error ${res.status}: ${errText.slice(0, 150)}`);
        }

        const rawData = await res.json();
        const rawList = Array.isArray(rawData) ? rawData : (rawData && typeof rawData === 'object' && rawData.Kode ? [rawData] : []);

        const normalized = rawList.map(normalizeMember).filter(Boolean);
        const capped = normalized.slice(0, limit);

        return {
            ok: true,
            total_found: normalized.length,
            search_field: targetField || 'ALL',
            search_value: targetValue || '',
            members: capped,
            has_more: normalized.length > limit,
        };
    } catch (err) {
        console.error('[AffariMemberAPI] Error searchAffariMembers:', err.message);
        return {
            ok: false,
            error: err.message,
            members: [],
        };
    }
}

/**
 * Ambil detail lengkap satu member spesifik
 */
export async function getAffariMemberDetail(identifier) {
    if (!identifier) return { ok: false, error: 'Identifier wajib diisi (Kode, No Kartu, atau No HP)' };

    const detected = detectSearchField(identifier);
    const result = await searchAffariMembers({ field: detected.field, value: detected.value, limit: 5 });

    if (!result.ok) return result;

    if (!result.members || result.members.length === 0) {
        // Coba cari via field Nama jika belum ketemu
        if (detected.field !== 'Nama') {
            const retry = await searchAffariMembers({ field: 'Nama', value: identifier, limit: 5 });
            if (retry.ok && retry.members.length > 0) {
                return { ok: true, member: retry.members[0], matches: retry.members };
            }
        }
        return { ok: false, error: `Member dengan identitas "${identifier}" tidak ditemukan.` };
    }

    // Jika ada yang persis cocok
    const exact = result.members.find(
        (m) =>
            m.kode.toLowerCase() === String(identifier).toLowerCase() ||
            m.no_kartu === String(identifier) ||
            m.ponsel.replace(/[^0-9]/g, '') === String(identifier).replace(/[^0-9]/g, '')
    ) || result.members[0];

    return {
        ok: true,
        member: exact,
        total_matches: result.members.length,
    };
}

/**
 * Ambil daftar outlet / cabang toko resmi Affari
 */
export async function getAffariOutlets() {
    try {
        const url = `${BASE_URL}/api/outlet`;
        const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        return {
            ok: true,
            outlets: list.map((o) => ({
                kode: o.Kode || '',
                nama: o.Nama || '',
                wilayah: o.Wilayah || '',
                alamat: o.Alamat || '',
                kota: o.Kota || '',
                propinsi: o.Propinsi || '',
            })),
        };
    } catch (err) {
        return {
            ok: false,
            error: err.message,
            outlets: [],
        };
    }
}
