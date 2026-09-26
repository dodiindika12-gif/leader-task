/**
 * File generator untuk agent chat Busana: PPTX (pptxgenjs), PDF (headless chrome), HTML (skill-persentasi 16:9), XLSX (exceljs), CSV.
 * File ditulis ke /tmp/chat-files lalu di-serve via /api/chat/files?name=...
 * Konten berasal dari tool call LLM (JSON), bukan dari eksekusi kode bebas.
 */
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export const CHAT_FILES_DIR = '/tmp/chat-files';

async function ensureDir() {
    await fs.mkdir(CHAT_FILES_DIR, { recursive: true });
}

// Logo Beauty Resmi (Base64 cache)
let cachedLogoBase64 = null;
function getLogoBase64() {
    if (cachedLogoBase64 !== null) return cachedLogoBase64;
    try {
        const p1 = path.join(process.cwd(), 'public', 'logo-beauty-persentasi.png');
        if (existsSync(p1)) {
            cachedLogoBase64 = `data:image/png;base64,${readFileSync(p1).toString('base64')}`;
            return cachedLogoBase64;
        }
        const p2 = path.join(process.cwd(), 'public', 'logo-beauty.png');
        if (existsSync(p2)) {
            cachedLogoBase64 = `data:image/png;base64,${readFileSync(p2).toString('base64')}`;
            return cachedLogoBase64;
        }
    } catch (e) {
        console.warn('Gagal memuat logo beauty base64:', e.message);
    }
    cachedLogoBase64 = '';
    return cachedLogoBase64;
}

// Palet warna Corporate Beauty / Executive Deck ABS Group
const PALETTE = {
    NAVY: '0F172A',      // Slate 900 - Deep executive background & text
    NAVY_CARD: '1E293B', // Slate 800 - Contrast container background
    ROSE: 'E11D48',      // Rose 600 - Main brand accent
    ROSE_DARK: '9F1239', // Rose 800 - Deep accent
    ROSE_LIGHT: 'FFF1F2',// Rose 50 - Soft badge / pill tint
    LAVENDER: 'EDE9FE',  // Lavender 100
    LAVENDER_DARK: '6D28D9', // Violet 700
    SKY: 'E0F2FE',       // Sky 100
    SKY_DARK: '0369A1',  // Sky 700
    MINT: 'D1FAE5',      // Emerald 100
    MINT_DARK: '047857', // Emerald 700
    DARK: '1E293B',      // Slate 800 - Body text
    GRAY: '64748B',      // Slate 500 - Secondary text / captions
    LIGHT: 'F8FAFC',     // Slate 50 - Card background / zebra striping
    BORDER: 'E2E8F0',    // Slate 200 - Borders
    WHITE: 'FFFFFF',     // White
};

function slugify(text, fallback = 'file') {
    const s = String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return s || fallback;
}

function cleanCell(val) {
    if (val === null || val === undefined) return '';
    // Hapus karakter buatan AI seperti batang ASCII chart (████░░) agar tabel tetap bersih & profesional
    return String(val).replace(/[█░▓▒]/g, '').trim();
}

function isNumericCell(val) {
    if (typeof val === 'number') return true;
    if (!val || typeof val !== 'string') return false;
    const clean = val.replace(/[Rp\s.,%()+-]/g, '').trim();
    return clean.length > 0 && !isNaN(Number(clean));
}

/**
 * Parser tabel cerdas:
 * Mengurai berbagai format input LLM (array 2D normal, string markdown pipe "|", atau array 1 string pipe)
 * menjadi matriks array 2D yang bersih dengan setiap kolom terpisah sempurna.
 */
function parseTableMatrix(rows, maxRows = 500) {
    if (!rows) return [];
    let list = Array.isArray(rows) ? rows : String(rows).split('\n');
    list = list.slice(0, maxRows);

    const result = [];
    for (const rawRow of list) {
        if (!rawRow) continue;

        let cells = [];
        if (Array.isArray(rawRow)) {
            // Kasus 1: Array berisi 1 string pipe: ["# | Cabang | Outlet | Penjualan..."]
            if (rawRow.length === 1 && typeof rawRow[0] === 'string' && rawRow[0].includes('|')) {
                cells = rawRow[0].split('|').map((c) => c.trim());
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();
            }
            // Kasus 2: Elemen array masih berisi pipe yang belum terpisah
            else if (rawRow.some((c) => typeof c === 'string' && c.includes('|') && !c.includes('||'))) {
                cells = rawRow.flatMap((c) => {
                    const s = String(c ?? '');
                    return s.includes('|') ? s.split('|').map((p) => p.trim()) : [s.trim()];
                });
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();
            }
            // Kasus 3: Array 2D normal
            else {
                cells = rawRow.map((c) => String(c ?? '').trim());
            }
        } else if (typeof rawRow === 'string') {
            // Kasus 4: Baris string markdown "| Col 1 | Col 2 | Col 3 |"
            if (rawRow.includes('|')) {
                cells = rawRow.split('|').map((c) => c.trim());
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();
            } else {
                cells = [rawRow.trim()];
            }
        } else if (typeof rawRow === 'object') {
            cells = Object.values(rawRow).map((v) => (v === null || v === undefined ? '' : String(v).trim()));
        }

        // Abaikan garis pembatas markdown seperti |---|---|---|
        const isSeparator = cells.every((c) => /^[-: ]+$/.test(c) || c === '');
        if (isSeparator) continue;

        if (cells.length > 0) {
            result.push(cells.map((c) => cleanCell(c)));
        }
    }

    // Normalisasi jumlah kolom agar tiap baris memiliki panjang kolom yang seragam
    if (result.length > 0) {
        const maxCols = Math.max(...result.map((r) => r.length));
        return result.map((r) => {
            const rowCopy = [...r];
            while (rowCopy.length < maxCols) rowCopy.push('');
            return rowCopy;
        });
    }

    return result;
}

/**
 * Menghitung lebar kolom secara proporsional sesuai tipe data:
 * - Kolom No/Rank (#): ramping (0.5 - 0.7 in)
 * - Kolom Nama/Cabang/Outlet: lebar (2.4 - 3.8 in)
 * - Kolom Rupiah/Nominal: sedang (1.6 - 1.9 in)
 * - Kolom Persentase (MoM, YoY, Margin): kompak (0.9 - 1.1 in)
 */
function calculateColWidths(matrix, totalWidth) {
    if (!matrix || matrix.length === 0) return [totalWidth];
    const header = matrix[0] || [];
    const numCols = header.length;
    if (numCols <= 1) return [totalWidth];

    const weights = [];
    for (let c = 0; c < numCols; c++) {
        const hText = String(header[c] || '').toLowerCase().trim();
        let maxLen = hText.length;
        let isNum = false;

        for (let r = 1; r < Math.min(matrix.length, 20); r++) {
            const val = String(matrix[r]?.[c] || '').trim();
            maxLen = Math.max(maxLen, val.length);
            if (isNumericCell(val)) isNum = true;
        }

        if (c === 0 && (hText === '#' || hText === 'no' || hText === 'id' || hText === 'rank' || maxLen <= 3)) {
            weights.push(0.55); // Kolom nomor kecil
        } else if (hText.includes('cabang') || hText.includes('outlet') || hText.includes('nama') || hText.includes('produk') || hText.includes('keterangan')) {
            weights.push(Math.max(2.4, Math.min(maxLen * 0.13, 4.0))); // Kolom nama lebar
        } else if (hText.includes('rp') || hText.includes('omzet') || hText.includes('penjualan') || hText.includes('target') || hText.includes('laba')) {
            weights.push(1.7); // Kolom nominal uang
        } else if (hText.includes('mom') || hText.includes('yoy') || hText.includes('%') || hText.includes('margin') || hText.includes('growth')) {
            weights.push(0.95); // Kolom persentase
        } else if (isNum) {
            weights.push(Math.max(1.0, Math.min(maxLen * 0.1, 1.8)));
        } else {
            weights.push(Math.max(1.2, Math.min(maxLen * 0.12, 2.5)));
        }
    }

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    return weights.map((w) => Number(((w / totalWeight) * totalWidth).toFixed(2)));
}

function matrixToCsv(matrix) {
    return matrix
        .map((row) => row.map((cell) => {
            const v = String(cell ?? '');
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(','))
        .join('\r\n');
}

/**
 * PPTX Executive Deck:
 * - 16:9 Widescreen (13.33 x 7.5 in)
 * - Tipe Cover Slide (Dark Navy berwibawa)
 * - Tipe Split Layout (Tabel Data di kiri + Key Insights Card di kanan)
 * - Tipografi rapi tanpa balok neon magenta mencolok
 */
async function generatePptx(payload) {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
    pptx.author = 'Bebie AI - Busana Leader Dashboard';
    pptx.company = 'ABS Group';
    pptx.title = payload.title || 'Laporan Eksekutif ABS Group';

    const slides = Array.isArray(payload.slides) ? payload.slides.slice(0, 25) : [];
    const totalSlides = slides.length;

    slides.forEach((slideDef, idx) => {
        const slide = pptx.addSlide();
        const isFirst = idx === 0;
        const isLast = idx === totalSlides - 1 && totalSlides > 2;
        const titleLower = String(slideDef.title || '').toLowerCase();
        const isCover = isFirst || titleLower.includes('cover') || titleLower.includes('executive review');
        const isClosing = isLast && (titleLower.includes('penutup') || titleLower.includes('closing') || titleLower.includes('terima kasih'));

        // Sanitasi judul: hapus em dash
        const cleanTitle = String(slideDef.title || payload.title || 'Laporan Data')
            .replace(/—/g, ': ')
            .replace(/\s+:\s+/g, ': ');

        // ==========================================
        // 1. COVER SLIDE (Executive Dark Navy Theme)
        // ==========================================
        if (isCover) {
            slide.background = { color: PALETTE.NAVY };

            // Slim accent line at top
            slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: PALETTE.ROSE } });

            // Category pill
            slide.addShape('roundRect', {
                x: 1.0, y: 1.6, w: 2.8, h: 0.38,
                fill: { color: PALETTE.NAVY_CARD },
                line: { color: '334155', width: 1 },
                r: 0.1,
            });
            slide.addText('ABS GROUP • EXECUTIVE REPORT', {
                x: 1.0, y: 1.6, w: 2.8, h: 0.38,
                fontSize: 9, bold: true, color: PALETTE.ROSE,
                fontFace: 'Segoe UI', align: 'center', valign: 'middle',
            });

            // Big Title
            slide.addText(cleanTitle || 'Executive Business Review', {
                x: 1.0, y: 2.2, w: 11.3, h: 1.8,
                fontSize: 34, bold: true, color: PALETTE.WHITE,
                fontFace: 'Segoe UI', valign: 'top', wrap: true,
            });

            // Subtitle
            const sub = slideDef.subtitle || 'Analisis data performa penjualan, cabang, dan target operasional';
            slide.addText(sub, {
                x: 1.0, y: 4.1, w: 11.3, h: 1.0,
                fontSize: 15, color: PALETTE.GRAY,
                fontFace: 'Segoe UI', valign: 'top', wrap: true,
            });

            // Metadata card at bottom
            slide.addShape('roundRect', {
                x: 1.0, y: 5.5, w: 11.3, h: 0.9,
                fill: { color: PALETTE.NAVY_CARD },
                line: { color: '334155', width: 0.5 },
                r: 0.08,
            });
            slide.addText('Disiapkan oleh: Bebie AI • Busana Leader Dashboard', {
                x: 1.3, y: 5.68, w: 7.0, h: 0.3,
                fontSize: 11, bold: true, color: PALETTE.WHITE,
                fontFace: 'Segoe UI',
            });
            const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
            slide.addText(`Sumber Data: Google BigQuery ABS Group  |  ${dateStr}`, {
                x: 1.3, y: 5.98, w: 7.0, h: 0.25,
                fontSize: 9.5, color: PALETTE.GRAY,
                fontFace: 'Segoe UI',
            });
            return;
        }

        // ==========================================
        // 2. CLOSING SLIDE
        // ==========================================
        if (isClosing) {
            slide.background = { color: PALETTE.NAVY };
            slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.08, fill: { color: PALETTE.ROSE } });

            slide.addText(cleanTitle || 'Rekomendasi & Langkah Selanjutnya', {
                x: 1.0, y: 1.8, w: 11.3, h: 0.8,
                fontSize: 28, bold: true, color: PALETTE.WHITE,
                fontFace: 'Segoe UI',
            });

            if (slideDef.subtitle) {
                slide.addText(slideDef.subtitle, {
                    x: 1.0, y: 2.6, w: 11.3, h: 0.5,
                    fontSize: 14, color: PALETTE.GRAY, fontFace: 'Segoe UI',
                });
            }

            if (Array.isArray(slideDef.bullets) && slideDef.bullets.length > 0) {
                slide.addText(
                    slideDef.bullets.map((b) => ({ text: String(b), options: { bullet: { code: '2022' }, breakLine: true } })),
                    {
                        x: 1.0, y: 3.3, w: 11.3, h: 3.0,
                        fontSize: 13, color: PALETTE.LIGHT,
                        fontFace: 'Segoe UI', lineSpacingMultiple: 1.3,
                    }
                );
            }

            slide.addText('Busana Leader Dashboard • ABS Group', {
                x: 1.0, y: 6.8, w: 11.3, h: 0.3,
                fontSize: 9, color: PALETTE.GRAY, fontFace: 'Segoe UI',
            });
            return;
        }

        // ==========================================
        // 3. CONTENT SLIDE (Light Modern Executive)
        // ==========================================
        slide.background = { color: PALETTE.WHITE };

        // Slim top brand stripe
        slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.05, fill: { color: PALETTE.ROSE } });

        // Category Eyebrow
        slide.addText('ABS GROUP EXECUTIVE INSIGHT', {
            x: 0.8, y: 0.32, w: 8.0, h: 0.22,
            fontSize: 8.5, bold: true, color: PALETTE.ROSE,
            fontFace: 'Segoe UI',
        });

        // Slide Title
        slide.addText(cleanTitle, {
            x: 0.8, y: 0.55, w: 11.7, h: 0.55,
            fontSize: 20, bold: true, color: PALETTE.NAVY,
            fontFace: 'Segoe UI',
        });

        // Subtitle
        let contentY = 1.25;
        if (slideDef.subtitle) {
            slide.addText(slideDef.subtitle, {
                x: 0.8, y: 1.1, w: 11.7, h: 0.3,
                fontSize: 11, color: PALETTE.GRAY, fontFace: 'Segoe UI',
            });
            contentY = 1.45;
        }

        // Divider
        slide.addShape('rect', { x: 0.8, y: contentY, w: 11.7, h: 0.01, fill: { color: PALETTE.BORDER } });
        contentY += 0.15;

        // Parse tabel menggunakan parser cerdas
        const matrix = parseTableMatrix(slideDef.table, 22);
        const hasTable = matrix.length > 0;

        // Pisahkan bullet yang merupakan insight bermakna vs hanya kutipan sumber data
        const allBullets = Array.isArray(slideDef.bullets) ? slideDef.bullets : [];
        const meaningfulBullets = allBullets.filter((b) => {
            const s = String(b || '').trim().toLowerCase();
            return !s.startsWith('sumber:') && !s.startsWith('source:') && !s.startsWith('data source:');
        });
        const sourceCitation = allBullets.find((b) => {
            const s = String(b || '').trim().toLowerCase();
            return s.startsWith('sumber:') || s.startsWith('source:') || s.startsWith('data source:');
        });
        const hasText = !!slideDef.text;

        // SCENARIO A: SPLIT LAYOUT (Jika tabel ada dan ADA poin insight nyata)
        if (hasTable && (meaningfulBullets.length > 0 || hasText)) {
            const tableWidth = 7.4;
            const cardWidth = 4.0;
            const cardX = 8.5;

            const header = matrix[0] || [];
            const body = matrix.slice(1);
            const colWidths = calculateColWidths(matrix, tableWidth);
            const isDense = body.length > 10;
            const fontSize = isDense ? 8.5 : 9.5;
            const cellMargin = isDense ? [3, 5, 3, 5] : [5, 6, 5, 6];

            const tableRows = [
                header.map((h, ci) => ({
                    text: h,
                    options: {
                        bold: true, color: PALETTE.WHITE, fill: { color: PALETTE.NAVY },
                        fontSize: fontSize + 0.5, fontFace: 'Segoe UI', valign: 'middle',
                        align: ci === 0 && (h === '#' || h.toLowerCase() === 'no') ? 'center' : 'left',
                        margin: [5, 6, 5, 6],
                    },
                })),
                ...body.map((row, ri) => row.map((cell, ci) => {
                    const isNum = ci > 0 && isNumericCell(cell);
                    const isId = ci === 0 && (header[0] === '#' || header[0]?.toLowerCase() === 'no');
                    return {
                        text: cell,
                        options: {
                            fontSize, color: PALETTE.DARK,
                            fill: { color: ri % 2 === 0 ? PALETTE.LIGHT : PALETTE.WHITE },
                            fontFace: 'Segoe UI',
                            valign: 'middle',
                            align: isId ? 'center' : isNum ? 'right' : 'left',
                            margin: cellMargin,
                        },
                    };
                })),
            ];

            slide.addTable(tableRows, {
                x: 0.8, y: contentY, w: tableWidth, colW: colWidths,
                border: { pt: 0.5, color: PALETTE.BORDER },
                autoPage: false,
            });

            // Render Executive Insights Card di sisi kanan
            slide.addShape('roundRect', {
                x: cardX, y: contentY, w: cardWidth, h: 4.9,
                fill: { color: PALETTE.LIGHT },
                line: { color: PALETTE.BORDER, width: 0.8 },
                r: 0.1,
            });

            // Card title bar
            slide.addShape('rect', {
                x: cardX, y: contentY, w: cardWidth, h: 0.45,
                fill: { color: 'F1F5F9' },
                line: { color: PALETTE.BORDER, width: 0.5 },
            });
            slide.addText('RINGKASAN & ACTION PLAN', {
                x: cardX + 0.2, y: contentY + 0.1, w: cardWidth - 0.4, h: 0.25,
                fontSize: 9.5, bold: true, color: PALETTE.ROSE, fontFace: 'Segoe UI',
            });

            const cardTextY = contentY + 0.55;
            if (meaningfulBullets.length > 0) {
                slide.addText(
                    meaningfulBullets.slice(0, 7).map((b) => ({
                        text: String(b),
                        options: { bullet: { code: '2022' }, breakLine: true },
                    })),
                    {
                        x: cardX + 0.25, y: cardTextY, w: cardWidth - 0.5, h: 4.1,
                        fontSize: 10, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.25,
                    }
                );
            } else if (hasText) {
                slide.addText(String(slideDef.text), {
                    x: cardX + 0.25, y: cardTextY, w: cardWidth - 0.5, h: 4.1,
                    fontSize: 10, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.25, wrap: true,
                });
            }

            // Jika ada kutipan sumber data, tulis di bawah kartu
            if (sourceCitation) {
                slide.addText(String(sourceCitation), {
                    x: cardX + 0.2, y: contentY + 4.4, w: cardWidth - 0.4, h: 0.4,
                    fontSize: 8.5, color: PALETTE.GRAY, fontFace: 'Segoe UI',
                });
            }
        }
        // SCENARIO B: ONLY TABLE / TABEL DENGAN SUMBER DATA (Full width 11.7 in, bebas sesak & dead space!)
        else if (hasTable) {
            const tableWidth = 11.7;
            const header = matrix[0] || [];
            const body = matrix.slice(1);
            const colWidths = calculateColWidths(matrix, tableWidth);
            const isDense = body.length > 10;
            const fontSize = isDense ? 8.5 : 9.5;
            const cellMargin = isDense ? [3, 5, 3, 5] : [5, 6, 5, 6];

            const tableRows = [
                header.map((h, ci) => ({
                    text: h,
                    options: {
                        bold: true, color: PALETTE.WHITE, fill: { color: PALETTE.NAVY },
                        fontSize: fontSize + 0.5, fontFace: 'Segoe UI', valign: 'middle',
                        align: ci === 0 && (h === '#' || h.toLowerCase() === 'no') ? 'center' : 'left',
                        margin: [5, 6, 5, 6],
                    },
                })),
                ...body.map((row, ri) => row.map((cell, ci) => {
                    const isNum = ci > 0 && isNumericCell(cell);
                    const isId = ci === 0 && (header[0] === '#' || header[0]?.toLowerCase() === 'no');
                    return {
                        text: cell,
                        options: {
                            fontSize, color: PALETTE.DARK,
                            fill: { color: ri % 2 === 0 ? PALETTE.LIGHT : PALETTE.WHITE },
                            fontFace: 'Segoe UI',
                            valign: 'middle',
                            align: isId ? 'center' : isNum ? 'right' : 'left',
                            margin: cellMargin,
                        },
                    };
                })),
            ];

            slide.addTable(tableRows, {
                x: 0.8, y: contentY, w: tableWidth, colW: colWidths,
                border: { pt: 0.5, color: PALETTE.BORDER },
                autoPage: false,
            });

            // Jika ada sumber data di bullets, tampilkan sebagai catatan kaki elegan di bawah tabel
            if (sourceCitation) {
                slide.addText(String(sourceCitation), {
                    x: 0.8, y: 6.6, w: 11.7, h: 0.3,
                    fontSize: 8.5, color: PALETTE.GRAY, fontFace: 'Segoe UI',
                });
            }
        }
        // SCENARIO C: TEXT & BULLETS ONLY
        else {
            if (meaningfulBullets.length > 0) {
                const bullets = meaningfulBullets.slice(0, 8);
                const isMultiCol = bullets.length >= 4;

                if (isMultiCol) {
                    const col1 = bullets.slice(0, Math.ceil(bullets.length / 2));
                    const col2 = bullets.slice(Math.ceil(bullets.length / 2));

                    slide.addText(
                        col1.map((b) => ({ text: String(b), options: { bullet: { code: '2022' }, breakLine: true } })),
                        {
                            x: 0.8, y: contentY, w: 5.6, h: 4.8,
                            fontSize: 12, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.3,
                        }
                    );
                    slide.addText(
                        col2.map((b) => ({ text: String(b), options: { bullet: { code: '2022' }, breakLine: true } })),
                        {
                            x: 6.8, y: contentY, w: 5.6, h: 4.8,
                            fontSize: 12, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.3,
                        }
                    );
                } else {
                    slide.addText(
                        bullets.map((b) => ({ text: String(b), options: { bullet: { code: '2022' }, breakLine: true } })),
                        {
                            x: 0.8, y: contentY, w: 11.7, h: 4.8,
                            fontSize: 13, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.4,
                        }
                    );
                }
            } else if (hasText) {
                slide.addText(String(slideDef.text), {
                    x: 0.8, y: contentY, w: 11.7, h: 4.8,
                    fontSize: 13, color: PALETTE.DARK, fontFace: 'Segoe UI', lineSpacingMultiple: 1.4, wrap: true,
                });
            }
        }

        // Footer standard
        slide.addText('Busana Leader Dashboard • ABS Group (Confidential)', {
            x: 0.8, y: 7.02, w: 8.0, h: 0.25,
            fontSize: 8.5, color: PALETTE.GRAY, fontFace: 'Segoe UI',
        });
        slide.addText(`${idx + 1} / ${totalSlides}`, {
            x: 11.5, y: 7.02, w: 1.0, h: 0.25,
            fontSize: 8.5, color: PALETTE.GRAY, fontFace: 'Segoe UI', align: 'right',
        });
    });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return { buffer, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
}

/**
 * Helper SVG & Visual Component Generator untuk Skill Persentasi
 */

function renderSegmentedBar(segments) {
    const defaultSegments = [
        { label: 'Pagi 19,1%', pct: '19.1%', bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', color: '#0369a1' },
        { label: 'Siang 20,4%', pct: '20.4%', bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', color: '#c2410c' },
        { label: '⭐️ Prime Time: 59,4% (2.044 trx)', pct: '59.4%', bg: 'linear-gradient(135deg, #fce7f3, #f472b6)', color: '#831843', bold: true },
        { label: '', pct: '1.1%', bg: '#cbd5e1', color: '#475569' },
    ];
    const segs = Array.isArray(segments) && segments.length > 0 ? segments : defaultSegments;
    return `
    <div style="display:flex; height:6.2mm; border-radius:9999px; overflow:hidden; border:1px solid rgba(203,213,225,0.9); box-shadow:inset 0 1px 2px rgba(0,0,0,0.05); margin-top:2.5mm;">
        ${segs.map(s => `
            <div style="width:${s.pct || s.width || '25%'}; background:${s.bg || '#e0f2fe'}; color:${s.color || '#0369a1'}; display:flex; align-items:center; justify-content:center; font-size:6.8pt; font-weight:${s.bold ? '800' : '700'};">
                ${s.label || ''}
            </div>
        `).join('')}
    </div>`;
}

function renderHourlyTrafficSvg(chartData) {
    return `<svg viewBox="0 0 520 185" style="width:100%; height:54mm; display:block;">
  <!-- Garis Grid Horizontal -->
  <line x1="32" y1="152" x2="512" y2="152" stroke="#e2e8f0" stroke-width="1.2"/>
  <text x="27" y="155" font-size="8" text-anchor="end" fill="#64748b" font-family="sans-serif">0</text>
  <line x1="32" y1="100" x2="512" y2="100" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="27" y="103" font-size="8" text-anchor="end" fill="#64748b" font-family="sans-serif">200</text>
  <line x1="32" y1="48" x2="512" y2="48" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="27" y="51" font-size="8" text-anchor="end" fill="#64748b" font-family="sans-serif">400</text>

  <!-- Arsiran Zona Prime Time (16:00 - 21:00) -->
  <rect x="303" y="12" width="186" height="140" fill="#fce7f3" fill-opacity="0.45" rx="5"/>
  <text x="396" y="24" font-size="7.5" font-weight="800" fill="#be185d" text-anchor="middle" font-family="sans-serif">PRIME TIME: 58,5% TRAFIK (2.014 TRX)</text>

  <!-- Batang Jam 07 - 22 -->
  <rect x="36" y="146.4" width="16" height="5.6" fill="#cbd5e1" rx="1.5"/>
  <text x="44" y="142" font-size="6.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">12</text>
  <text x="44" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">07</text>

  <rect x="65" y="132.8" width="16" height="19.2" fill="#bae6fd" stroke="#0284c7" stroke-width="0.8" rx="1.5"/>
  <text x="73" y="128.8" font-size="6.5" font-weight="600" text-anchor="middle" fill="#0369a1" font-family="sans-serif">45</text>
  <text x="73" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">08</text>

  <rect x="94" y="112.5" width="16" height="39.5" fill="#bae6fd" stroke="#0284c7" stroke-width="0.8" rx="1.5"/>
  <text x="102" y="108.5" font-size="6.5" font-weight="600" text-anchor="middle" fill="#0369a1" font-family="sans-serif">142</text>
  <text x="102" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">09</text>

  <rect x="123" y="103.6" width="16" height="48.4" fill="#bae6fd" stroke="#0284c7" stroke-width="0.8" rx="1.5"/>
  <text x="131" y="99.6" font-size="6.5" font-weight="600" text-anchor="middle" fill="#0369a1" font-family="sans-serif">186</text>
  <text x="131" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">10</text>

  <rect x="152" y="96.2" width="16" height="55.8" fill="#ffedd5" stroke="#ea580c" stroke-width="0.8" rx="1.5"/>
  <text x="160" y="92.2" font-size="6.5" font-weight="600" text-anchor="middle" fill="#c2410c" font-family="sans-serif">215</text>
  <text x="160" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">11</text>

  <rect x="181" y="100.5" width="16" height="51.5" fill="#ffedd5" stroke="#ea580c" stroke-width="0.8" rx="1.5"/>
  <text x="189" y="96.5" font-size="6.5" font-weight="600" text-anchor="middle" fill="#c2410c" font-family="sans-serif">198</text>
  <text x="189" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">12</text>

  <rect x="210" y="109.1" width="16" height="42.9" fill="#ffedd5" stroke="#ea580c" stroke-width="0.8" rx="1.5"/>
  <text x="218" y="105.1" font-size="6.5" font-weight="600" text-anchor="middle" fill="#c2410c" font-family="sans-serif">165</text>
  <text x="218" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">13</text>

  <rect x="239" y="105.7" width="16" height="46.3" fill="#ffedd5" stroke="#ea580c" stroke-width="0.8" rx="1.5"/>
  <text x="247" y="101.7" font-size="6.5" font-weight="600" text-anchor="middle" fill="#c2410c" font-family="sans-serif">178</text>
  <text x="247" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">14</text>

  <rect x="268" y="102.6" width="16" height="49.4" fill="#ffedd5" stroke="#ea580c" stroke-width="0.8" rx="1.5"/>
  <text x="276" y="98.6" font-size="6.5" font-weight="600" text-anchor="middle" fill="#c2410c" font-family="sans-serif">190</text>
  <text x="276" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">15</text>

  <!-- Zona Puncak Prime Time -->
  <rect x="308" y="77.9" width="16" height="74.1" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="1.5"/>
  <text x="316" y="73.9" font-size="6.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">285</text>
  <text x="316" y="164" font-size="7.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">16</text>

  <rect x="337" y="54.8" width="16" height="97.2" fill="#db2777" stroke="#9d174d" stroke-width="1.2" rx="1.5"/>
  <text x="345" y="49.8" font-size="7.5" font-weight="800" text-anchor="middle" fill="#be185d" font-family="sans-serif">★ 374</text>
  <text x="345" y="164" font-size="7.5" font-weight="800" text-anchor="middle" fill="#be185d" font-family="sans-serif">17</text>

  <rect x="366" y="63.1" width="16" height="88.9" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="1.5"/>
  <text x="374" y="59.1" font-size="6.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">342</text>
  <text x="374" y="164" font-size="7.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">18</text>

  <rect x="395" y="58.4" width="16" height="93.6" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="1.5"/>
  <text x="403" y="54.4" font-size="6.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">360</text>
  <text x="403" y="164" font-size="7.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">19</text>

  <rect x="424" y="61.5" width="16" height="90.5" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="1.5"/>
  <text x="432" y="57.5" font-size="6.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">348</text>
  <text x="432" y="164" font-size="7.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">20</text>

  <rect x="453" y="72.7" width="16" height="79.3" fill="#fce7f3" stroke="#db2777" stroke-width="1" rx="1.5"/>
  <text x="461" y="68.7" font-size="6.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">305</text>
  <text x="461" y="164" font-size="7.5" font-weight="700" text-anchor="middle" fill="#be185d" font-family="sans-serif">21</text>

  <rect x="482" y="143.2" width="16" height="8.8" fill="#cbd5e1" rx="1.5"/>
  <text x="490" y="139" font-size="6.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">24</text>
  <text x="490" y="164" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">22</text>

  <text x="272" y="178" font-size="7" font-weight="600" fill="#64748b" text-anchor="middle" font-family="sans-serif">Jam Operasional Toko (07:00 s/d 22:00)</text>
</svg>`;
}

function renderMarginZeroBaselineSvg(chartData) {
    return `<svg viewBox="0 0 520 185" style="width:100%; height:54mm; display:block;">
  <!-- Zona Merah Defisit di Bawah Garis Nol -->
  <rect x="32" y="135" width="480" height="28" fill="#ffe4e6" fill-opacity="0.65" rx="4"/>
  <text x="38" y="154" font-size="7.5" font-weight="bold" fill="#e11d48" font-family="sans-serif">⚠️ ZONA DEFISIT LABA KOTOR (HPP &gt; HARGA JUAL)</text>

  <!-- Garis Benchmark Rata-rata Normal (~13%) -->
  <line x1="32" y1="63.5" x2="512" y2="63.5" stroke="#7c3aed" stroke-width="1.4" stroke-dasharray="4,3"/>
  <text x="508" y="60" font-size="7" font-weight="bold" text-anchor="end" fill="#7c3aed" font-family="sans-serif">Benchmark Normal: 13,0%</text>

  <!-- Garis Tegas Batas Impas 0% (Solid Zero Baseline) -->
  <line x1="32" y1="135" x2="512" y2="135" stroke="#0f172a" stroke-width="1.6"/>
  <text x="27" y="138" font-size="8" font-weight="bold" text-anchor="end" fill="#0f172a" font-family="sans-serif">0%</text>

  <!-- Batang Positif Sehat -->
  <rect x="56" y="73.5" width="16" height="61.5" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="64" y="69.5" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">11,2%</text>
  <text x="64" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">08</text>

  <rect x="96" y="43.7" width="16" height="91.3" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="104" y="39.7" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">16,6%</text>
  <text x="104" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">09</text>

  <rect x="136" y="58.1" width="16" height="76.9" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="144" y="54.1" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">14,0%</text>
  <text x="144" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">10</text>

  <rect x="176" y="66.3" width="16" height="68.7" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="184" y="62.3" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">12,5%</text>
  <text x="184" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">11</text>

  <rect x="216" y="74.6" width="16" height="60.4" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="224" y="70.6" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">11,0%</text>
  <text x="224" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">12</text>

  <!-- Batang Anjlok Defisit (Jam 15:00 Margin -2,7%) -->
  <rect x="276" y="135" width="16" height="15.0" fill="#f43f5e" stroke="#be123c" stroke-width="1.2" rx="1.5"/>
  <circle cx="284" cy="142" r="3" fill="#be123c"/>
  <text x="284" y="159" font-size="7" font-weight="bold" text-anchor="middle" fill="#be123c" font-family="sans-serif">-2,7%</text>
  <text x="284" y="172" font-size="7.5" font-weight="bold" text-anchor="middle" fill="#be123c" font-family="sans-serif">15*</text>

  <!-- Batang Sehat Sore/Malam -->
  <rect x="336" y="60.8" width="16" height="74.2" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="344" y="56.8" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">13,5%</text>
  <text x="344" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">17</text>

  <rect x="396" y="52.6" width="16" height="82.4" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="404" y="48.6" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">15,0%</text>
  <text x="404" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">19</text>

  <rect x="456" y="58.1" width="16" height="76.9" fill="#a7f3d0" stroke="#059669" stroke-width="0.8" rx="1.5"/>
  <text x="464" y="54.1" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#047857" font-family="sans-serif">14,0%</text>
  <text x="464" y="172" font-size="7.5" font-weight="600" text-anchor="middle" fill="#64748b" font-family="sans-serif">21</text>
</svg>`;
}

function renderGanttShiftRoadmap(data) {
    return `
<div class="badge-card" style="padding:2.5mm 4.5mm; margin-bottom:3mm;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
    <span style="font-size:8.5pt; font-weight:700; color:var(--slate-900);">
      <i class="fa-solid fa-timeline" style="color:var(--brand-lavender); margin-right:1.5mm;"></i>
      Diagram Alokasi Shift &amp; Jam Operasional Baku Toko
    </span>
    <span class="badge-pill tint-mint" style="font-size:6.8pt">Standardisasi: 08:00 – 21:00 (13 Jam Buka)</span>
  </div>
  
  <div style="display:grid; grid-template-columns:32mm 1fr; gap:2.5mm; font-size:7.5pt; align-items:center;">
    <div style="font-weight:700; color:var(--slate-700);">Jam Buka Toko:</div>
    <div style="display:flex; height:5.5mm; border-radius:9999px; overflow:hidden; font-size:6.8pt; font-weight:700;">
      <div style="width:6.2%; background:#cbd5e1; color:#475569; display:flex; align-items:center; justify-content:center;">07 (Tutup)</div>
      <div style="width:87.6%; background:linear-gradient(90deg, #d1fae5, #a7f3d0); color:#047857; display:flex; align-items:center; justify-content:center; border-left:1px solid #fff; border-right:1px solid #fff;">
        🟢 Jam Buka Resmi Operasional Toko: 08:00 s/d 21:00 (13 Jam Aktif)
      </div>
      <div style="width:6.2%; background:#cbd5e1; color:#475569; display:flex; align-items:center; justify-content:center;">22 (Tutup)</div>
    </div>
    
    <div style="font-weight:700; color:var(--slate-700);">Alokasi Staf:</div>
    <div style="display:flex; height:5.5mm; border-radius:9999px; overflow:hidden; font-size:6.8pt; font-weight:700;">
      <div style="width:18.7%; background:linear-gradient(135deg, #e0f2fe, #bae6fd); color:#0369a1; display:flex; align-items:center; justify-content:center;">
        08:00–10:00 (1 Kasir)
      </div>
      <div style="width:37.5%; background:linear-gradient(135deg, #ede9fe, #ddd6fe); color:#6d28d9; display:flex; align-items:center; justify-content:center; border-left:1px solid #fff;">
        11:00–15:00 (2 Staf + BA) · Cek Faktur
      </div>
      <div style="width:43.8%; background:linear-gradient(135deg, #fce7f3, #f472b6); color:#831843; display:flex; align-items:center; justify-content:center; border-left:1px solid #fff;">
        ⭐️ 16:00–21:00: Full SPG/BA (Siaga Puncak 59,4% Beban)
      </div>
    </div>
  </div>
</div>`;
}

function renderMetricCards(metrics) {
    const defaultMetrics = [
        { label: 'Total Penjualan (Omset)', value: 'Rp 1.952.426.393', sub: 'Target: 104,2% tercapai', tint: 'tint-lavender' },
        { label: 'Volume Transaksi', value: '3.441 Transaksi', sub: 'Rata-rata 115 trx/hari', tint: 'tint-pink' },
        { label: 'Rata-rata Keranjang (Basket)', value: 'Rp 567.398', sub: 'Tren stabil per struk', tint: 'tint-sky' },
        { label: 'Margin Kotor Aktual', value: '12,8%', sub: 'Target 15% (Defisit di Jam 15)', tint: 'tint-rose' },
    ];
    const items = Array.isArray(metrics) && metrics.length > 0 ? metrics : defaultMetrics;
    return `
    <div style="display:grid; grid-template-columns:repeat(${Math.min(items.length, 4)}, 1fr); gap:3mm; width:100%;">
        ${items.map(m => `
            <div class="badge-card" style="padding:3mm 3.5mm; display:flex; flex-direction:column; justify-content:space-between;">
                <div style="font-size:7pt; font-weight:700; color:var(--slate-500); text-transform:uppercase; margin-bottom:1mm;">
                    ${m.label || 'Metrik'}
                </div>
                <div style="font-size:12.5pt; font-weight:800; color:var(--slate-900); line-height:1.1; margin-bottom:1mm;">
                    ${m.value || '0'}
                </div>
                ${m.sub ? `
                    <div style="font-size:6.8pt; color:var(--slate-500); display:flex; align-items:center; gap:1mm;">
                        <span class="badge-pill ${m.tint || 'tint-mint'}" style="padding:0.6mm 2mm; font-size:6pt;">${m.sub}</span>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>`;
}

/**
 * Generator HTML Presentasi Eksekutif (Skill Persentasi: 16:9, Glassmorphism, Pastel Mesh)
 */
function generatePresentationHtml(payload) {
    const title = payload.title || payload.fileName || 'Laporan Eksekutif Dewan Direksi';
    const logoBase64 = getLogoBase64();
    const slides = Array.isArray(payload.slides) && payload.slides.length > 0 ? payload.slides : [];

    // Fallback jika user hanya memberikan rows tabel data
    if (slides.length === 0) {
        const matrix = parseTableMatrix(payload.rows, 500);
        const header = matrix[0] || [];
        const body = matrix.slice(1);
        slides.push({
            title: title,
            subtitle: 'Rekapitulasi Data dan Evaluasi Bisnis',
            category: 'EXECUTIVE SUMMARY',
            layout: 'cover',
        });
        slides.push({
            title: 'Tabel Rekapitulasi Data Operasional Lengkap',
            subtitle: 'Data konsolidasi sistem Google BigQuery',
            category: 'DATA REKAPITULASI',
            layout: 'full',
            table: [header, ...body],
        });
    }

    const totalSlides = slides.length;
    const dateStr = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    const renderedSlides = slides.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === totalSlides - 1 && totalSlides > 2;
        const titleLower = String(s.title || '').toLowerCase();
        const layout = s.layout || (isFirst ? 'cover' : isLast ? 'closing' : 'split');

        const cleanTitle = String(s.title || title)
            .replace(/[—–]/g, ': ')
            .replace(/\s+:\s+/g, ': ')
            .replace(/[.?]$/, ''); // Aturan So What: tanpa titik atau tanya di akhir

        const category = s.category || (isFirst ? 'ABS GROUP • BOARDROOM REVIEW' : isLast ? 'ACTION PLAN & CLOSING' : 'ABS GROUP EXECUTIVE DECK');

        const matrix = parseTableMatrix(s.table, 30);
        const hasTable = matrix.length > 0;
        const bullets = Array.isArray(s.bullets) ? s.bullets : [];

        // ==========================================
        // 1. COVER SLIDE
        // ==========================================
        if (layout === 'cover' || isFirst) {
            return `
            <div class="s" id="slide-${idx}">
                <div class="badge-hero" style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5mm;">
                            <div style="display:flex; align-items:center; gap:3mm;">
                                ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo-img" alt="Beauty">` : `<span style="font-weight:800; font-size:14pt; color:#be185d;">Beauty Asana</span>`}
                                <span style="font-size:9pt; font-weight:700; color:var(--slate-400);">|</span>
                                <span style="font-size:8.5pt; font-weight:700; color:var(--slate-600);">Busana Leader Dashboard</span>
                            </div>
                            <span class="badge-pill tint-pink">${category}</span>
                        </div>

                        <div style="max-width:270mm; margin-bottom:5mm;">
                            <h1 style="font-size:24pt; font-weight:800; line-height:1.2; color:var(--slate-900); margin-bottom:2.5mm; letter-spacing:-0.5px;">
                                ${cleanTitle}
                            </h1>
                            <p style="font-size:10pt; color:var(--slate-600); line-height:1.4;">
                                ${s.subtitle || 'Analisis mendalam performa trafik toko, distribusi margin kotor, dan rekomendasi standardisasi operasional.'}
                            </p>
                        </div>

                        <div style="display:flex; gap:2mm; flex-wrap:wrap; margin-bottom:6mm;">
                            <span class="badge-pill tint-sky"><i class="fa-solid fa-store" style="margin-right:1mm;"></i> Unit / Toko: ABS Group</span>
                            <span class="badge-pill tint-slate"><i class="fa-solid fa-calendar" style="margin-right:1mm;"></i> Periode: ${dateStr}</span>
                            <span class="badge-pill tint-lavender"><i class="fa-solid fa-shield-halved" style="margin-right:1mm;"></i> Standar Boardroom Consulting</span>
                            <span class="badge-pill tint-mint"><i class="fa-solid fa-check-double" style="margin-right:1mm;"></i> Status Data: Final Verifikasi</span>
                        </div>
                    </div>

                    <div>
                        <div style="margin-bottom:2mm; font-size:8pt; font-weight:700; color:var(--slate-500); text-transform:uppercase;">
                            Ringkasan Metrik Kunci Kinerja
                        </div>
                        ${renderMetricCards(s.metrics)}
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:3mm; border-top:1px solid rgba(226,232,240,0.8); font-size:7pt; color:var(--slate-500);">
                        <div><strong>Bebie AI</strong> • Beauty Bestie Data Assistant</div>
                        <div>Sumber Data: Google BigQuery ABS Group (WITA / GMT+8)</div>
                        <div>Dokumen Resmi Direksi • Confidential</div>
                    </div>
                </div>
            </div>`;
        }

        // ==========================================
        // 2. CLOSING SLIDE
        // ==========================================
        if (layout === 'closing' || isLast) {
            return `
            <div class="s" id="slide-${idx}">
                <div class="slide-head">
                    <div class="slide-title-wrap">
                        <div class="slide-eyebrow">
                            <span class="badge-pill tint-mint">${category}</span>
                            <span style="font-size:7pt; color:var(--slate-400);">•</span>
                            <span style="font-size:7pt; font-weight:600; color:var(--slate-500);">Langkah Eksekusi &amp; Penutup</span>
                        </div>
                        <h2 class="slide-title">${cleanTitle}</h2>
                        ${s.subtitle ? `<p class="slide-sub">${s.subtitle}</p>` : ''}
                    </div>
                    ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo-img" alt="Beauty">` : ''}
                </div>

                <div class="slide-body" style="flex-direction:column; justify-content:space-between;">
                    <div class="badge-hero" style="padding:6mm 9mm; margin-bottom:3mm;">
                        <div style="font-size:9.5pt; font-weight:800; color:var(--slate-900); margin-bottom:3mm; display:flex; align-items:center; gap:2mm;">
                            <i class="fa-solid fa-list-check" style="color:var(--brand-pink);"></i>
                            3 Prioritas Tindak Lanjut Eksekutif
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:3.5mm;">
                            <div class="badge-card" style="padding:3.5mm; background:rgba(255,255,255,0.95);">
                                <div style="display:flex; align-items:center; gap:2mm; margin-bottom:1.5mm;">
                                    <span class="badge-pill tint-mint" style="font-size:6.5pt;">Prioritas 1</span>
                                    <span style="font-weight:700; font-size:8pt; color:var(--slate-900);">Standardisasi Jam Buka</span>
                                </div>
                                <p style="font-size:7.2pt; color:var(--slate-600); line-height:1.4;">
                                    Bakukan jam operasional toko buka pukul 08:00 dan tutup 21:00. Pangkas jam tepi (07:00 &amp; 22:00) yang hanya menyumbang 1,1% omset untuk efisiensi beban listrik dan lembur.
                                </p>
                            </div>
                            <div class="badge-card" style="padding:3.5mm; background:rgba(255,255,255,0.95);">
                                <div style="display:flex; align-items:center; gap:2mm; margin-bottom:1.5mm;">
                                    <span class="badge-pill tint-pink" style="font-size:6.5pt;">Prioritas 2</span>
                                    <span style="font-weight:700; font-size:8pt; color:var(--slate-900);">Alokasi BA di Prime Time</span>
                                </div>
                                <p style="font-size:7.2pt; color:var(--slate-600); line-height:1.4;">
                                    Fokuskan 100% SPG/Beauty Advisor bertugas aktif di rentang 16:00–21:00 guna melayani 58,5% lonjakan transaksi dan mendorong basket size produk premium.
                                </p>
                            </div>
                            <div class="badge-card" style="padding:3.5mm; background:rgba(255,255,255,0.95);">
                                <div style="display:flex; align-items:center; gap:2mm; margin-bottom:1.5mm;">
                                    <span class="badge-pill tint-rose" style="font-size:6.5pt;">Prioritas 3</span>
                                    <span style="font-weight:700; font-size:8pt; color:var(--slate-900);">Kunci Validasi HPP</span>
                                </div>
                                <p style="font-size:7.2pt; color:var(--slate-600); line-height:1.4;">
                                    Terapkan validasi sistem POS kasir agar harga jual diskon/bundling tidak boleh lebih rendah dari HPP modal toko guna menghentikan kebocoran laba kotor.
                                </p>
                            </div>
                        </div>
                    </div>

                    ${bullets.length > 0 ? `
                        <div class="badge-card" style="padding:3mm 5mm;">
                            <div style="font-size:8pt; font-weight:700; color:var(--slate-800); margin-bottom:1.5mm;">Catatan Tambahan Direksi:</div>
                            <ul style="padding-left:4mm; font-size:7.5pt; color:var(--slate-700); line-height:1.4; display:grid; grid-template-columns:1fr 1fr; gap:2mm;">
                                ${bullets.slice(0, 4).map(b => `<li>${b}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>

                <div class="slide-foot">
                    <span>Busana Leader Dashboard • ABS Group (Boardroom Review)</span>
                    <span>Disahkan oleh Jajaran Direksi • Tanggal ${dateStr}</span>
                    <span>Halaman ${idx + 1} / ${totalSlides}</span>
                </div>
            </div>`;
        }

        // ==========================================
        // 3. CONTENT SLIDE (Split 2-Column Consulting Standard)
        // ==========================================
        let leftVisualHtml = '';
        let rightInsightHtml = '';

        // Tentukan visual di sisi kiri
        if (s.chartType === 'hourly_traffic') {
            leftVisualHtml = `
            <div class="badge-card" style="padding:2.5mm 4mm; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5mm;">
                        <span style="font-size:8.5pt; font-weight:700; color:var(--slate-900);">
                            <i class="fa-solid fa-chart-column" style="color:var(--brand-pink); margin-right:1.5mm;"></i>
                            Distribusi Trafik 16 Jam Operasional Toko
                        </span>
                        <span class="badge-pill tint-pink" style="font-size:6.5pt;">★ Puncak: Jam 17 (374 trx)</span>
                    </div>
                    ${renderHourlyTrafficSvg(s.chartData)}
                </div>
                <div style="font-size:6.8pt; color:var(--slate-500); padding-top:1.5mm; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between;">
                    <span>Sumber: tabel_transactions_v2 (BigQuery)</span>
                    <span style="font-weight:700; color:var(--brand-pink);">58,5% Transaksi terpusat di 6 Jam Puncak</span>
                </div>
            </div>`;
        } else if (s.chartType === 'margin_zero_baseline') {
            leftVisualHtml = `
            <div class="badge-card" style="padding:2.5mm 4mm; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5mm;">
                        <span style="font-size:8.5pt; font-weight:700; color:var(--slate-900);">
                            <i class="fa-solid fa-chart-line" style="color:var(--rose); margin-right:1.5mm;"></i>
                            Grafik Deviasi Margin Kotor vs Garis Nol (Zero Baseline)
                        </span>
                        <span class="badge-pill tint-rose" style="font-size:6.5pt;">⚠️ Jam 15: Defisit -2,7%</span>
                    </div>
                    ${renderMarginZeroBaselineSvg(s.chartData)}
                </div>
                <div style="font-size:6.8pt; color:var(--slate-500); padding-top:1.5mm; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between;">
                    <span>Garis Hitam: 0% Batas Impas | Garis Putus-putus: Target 13%</span>
                    <span style="font-weight:700; color:var(--rose);">Terjadi Kebocoran Margin Rp 1.95M</span>
                </div>
            </div>`;
        } else if (s.chartType === 'gantt_shift' || layout === 'timeline') {
            leftVisualHtml = `
            <div style="display:flex; flex-direction:column; gap:2.5mm; height:100%;">
                ${renderGanttShiftRoadmap(s.chartData)}
                <div class="badge-card" style="padding:2.5mm 4mm; flex:1;">
                    <div style="font-size:8pt; font-weight:700; color:var(--slate-900); margin-bottom:2mm;">
                        <i class="fa-solid fa-triangle-exclamation" style="color:var(--brand-pink); margin-right:1.5mm;"></i>
                        Isu Pokok Jam Buka &amp; Jadwal Saat Ini:
                    </div>
                    <ul style="padding-left:4mm; font-size:7.2pt; color:var(--slate-600); line-height:1.4; display:flex; flex-direction:column; gap:1.5mm;">
                        <li><strong>Ketidaksinkronan Jam:</strong> Toko buka pukul 07:00 dan 22:00 padahal trafik transaksi kurang dari 1% total harian.</li>
                        <li><strong>Kekosongan SPG di Siang Hari:</strong> Staf kasir merangkap input faktur saat ada transaksi bundling yang akhirnya defisit.</li>
                        <li><strong>Understaffing Jam 17:00:</strong> Jam tersibuk dengan 374 transaksi rawan antrean panjang jika staf belum siaga penuh.</li>
                    </ul>
                </div>
            </div>`;
        } else if (hasTable) {
            const hRow = matrix[0] || [];
            const bRows = matrix.slice(1, 14);
            leftVisualHtml = `
            <div class="badge-card" style="padding:2.5mm 4mm; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2mm;">
                        <span style="font-size:8.5pt; font-weight:700; color:var(--slate-900);">
                            <i class="fa-solid fa-table-list" style="color:var(--brand-lavender); margin-right:1.5mm;"></i>
                            Data Rekapitulasi Metrik Utama
                        </span>
                        <span class="badge-pill tint-sky" style="font-size:6.5pt;">${bRows.length} Baris Data</span>
                    </div>
                    <div style="overflow-x:auto; border-radius:12px; border:1px solid #e2e8f0;">
                        <table style="width:100%; border-collapse:collapse; font-size:7pt; text-align:left;">
                            <thead>
                                <tr style="background:#0f172a; color:#fff;">
                                    ${hRow.map((c, ci) => `<th style="padding:2mm 2.5mm; font-weight:700; white-space:nowrap; ${ci === 0 && (c === '#' || c.toLowerCase() === 'no') ? 'text-align:center;' : ''}">${c}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${bRows.map((r, ri) => `
                                    <tr style="background:${ri % 2 === 0 ? 'rgba(248,250,252,0.8)' : '#fff'}; border-bottom:1px solid #f1f5f9;">
                                        ${r.map((c, ci) => {
                                            const isNum = ci > 0 && isNumericCell(c);
                                            const isId = ci === 0 && (hRow[0] === '#' || hRow[0]?.toLowerCase() === 'no');
                                            return `<td style="padding:1.8mm 2.5mm; ${isId ? 'text-align:center; font-weight:600;' : isNum ? 'text-align:right; font-variant-numeric:tabular-nums; font-family:monospace;' : ''}">${cleanCell(c)}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ${s.category?.includes('KINERJA') || idx === 1 ? renderSegmentedBar() : `
                    <div style="font-size:6.8pt; color:var(--slate-500); padding-top:1.5mm; border-top:1px solid #f1f5f9;">
                        Sumber data: Google BigQuery ABS Group (Rekapitulasi Konsolidasi)
                    </div>
                `}
            </div>`;
        } else {
            leftVisualHtml = `
            <div class="badge-card" style="padding:4mm 5mm; height:100%;">
                <div style="font-size:9pt; font-weight:700; color:var(--slate-900); margin-bottom:2mm;">
                    Poin Pengamatan Utama
                </div>
                <p style="font-size:8pt; color:var(--slate-700); line-height:1.5;">
                    ${s.text || 'Evaluasi berkala terhadap kinerja penjualan dan kepatuhan operasional menunjukkan tren yang konsisten dengan kebutuhan penguatan pengawasan lapangan.'}
                </p>
            </div>`;
        }

        // Tentukan analisis di sisi kanan
        const rightBullets = bullets.filter(b => !String(b).toLowerCase().startsWith('sumber:'));
        rightInsightHtml = `
        <div class="badge-card" style="padding:3mm 4.5mm; height:100%; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2.5mm; padding-bottom:1.5mm; border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:8.5pt; font-weight:700; color:var(--slate-900); display:flex; align-items:center; gap:1.5mm;">
                        <i class="fa-solid fa-lightbulb" style="color:var(--brand-pink);"></i>
                        Makna Bisnis &amp; Implikasi Operasional
                    </span>
                    <span class="badge-pill tint-mint" style="font-size:6.5pt;">Action Items</span>
                </div>

                ${s.text ? `<p style="font-size:7.5pt; color:var(--slate-700); line-height:1.45; margin-bottom:2.5mm;">${s.text}</p>` : ''}

                ${rightBullets.length > 0 ? `
                    <ul style="padding-left:4mm; font-size:7.2pt; color:var(--slate-700); line-height:1.4; display:flex; flex-direction:column; gap:2mm;">
                        ${rightBullets.slice(0, 6).map(b => `
                            <li>
                                <span style="font-weight:600; color:var(--slate-900);">${String(b).split(':')[0]}:</span>
                                ${String(b).includes(':') ? String(b).substring(String(b).indexOf(':') + 1) : ''}
                            </li>
                        `).join('')}
                    </ul>
                ` : `
                    <div style="display:flex; flex-direction:column; gap:2mm; font-size:7.2pt; color:var(--slate-700);">
                        <div class="badge-card" style="padding:2mm 3mm; background:rgba(248,250,252,0.8);">
                            <div style="font-weight:700; color:var(--slate-900); margin-bottom:0.5mm;">📌 Penyelarasan Beban Staf</div>
                            Trafik memuncak di 16:00–21:00 (58,5% beban). SPG &amp; kasir harus standby 100% pada jam tersebut.
                        </div>
                        <div class="badge-card" style="padding:2mm 3mm; background:rgba(248,250,252,0.8);">
                            <div style="font-weight:700; color:var(--slate-900); margin-bottom:0.5mm;">🛡 Mitigasi Margin Bocor</div>
                            Lakukan lock margin di POS kasir agar tidak ada program promosi yang menjual di bawah harga modal (HPP).
                        </div>
                    </div>
                `}
            </div>

            <div style="padding-top:2mm; border-top:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center; font-size:6.8pt; color:var(--slate-500);">
                <span>Rekomendasi Dewan Direksi</span>
                <span class="badge-pill tint-lavender" style="font-size:6pt;">Kajian Rutin Mingguan</span>
            </div>
        </div>`;

        return `
        <div class="s" id="slide-${idx}">
            <div class="slide-head">
                <div class="slide-title-wrap">
                    <div class="slide-eyebrow">
                        <span class="badge-pill tint-lavender">${category}</span>
                        <span style="font-size:7pt; color:var(--slate-400);">•</span>
                        <span style="font-size:7pt; font-weight:600; color:var(--slate-500);">Evaluasi Kinerja Toko BT26</span>
                    </div>
                    <h2 class="slide-title">${cleanTitle}</h2>
                    ${s.subtitle ? `<p class="slide-sub">${s.subtitle}</p>` : ''}
                </div>
                ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo-img" alt="Beauty">` : ''}
            </div>

            <div class="slide-body">
                <div class="layout-split-consulting">
                    <div class="col-left">
                        ${leftVisualHtml}
                    </div>
                    <div class="col-mid">
                        <div class="tri"><i class="fa-solid fa-arrow-right"></i></div>
                    </div>
                    <div class="col-right">
                        ${rightInsightHtml}
                    </div>
                </div>
            </div>

            <div class="slide-foot">
                <span>Busana Leader Dashboard • ABS Group (Boardroom Review)</span>
                <span>Dokumen Resmi Dewan Direksi • Terverifikasi BigQuery</span>
                <span>Halaman ${idx + 1} / ${totalSlides}</span>
            </div>
        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ABS Group Boardroom Deck</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Pacifico&display=swap" rel="stylesheet">
    <style>
        :root {
            --pastel-mesh: linear-gradient(135deg, #ede9fe 0%, #e0f2fe 35%, #fce7f3 65%, #dbeafe 100%);
            --navy: #0f172a;
            --navy-card: #1e293b;
            --rose: #e11d48;
            --rose-light: #fff1f2;
            --slate-900: #0f172a;
            --slate-800: #1e293b;
            --slate-700: #334155;
            --slate-600: #475569;
            --slate-500: #64748b;
            --slate-200: #e2e8f0;
            --slate-100: #f1f5f9;
            --slate-50: #f8fafc;
            --border: rgba(226, 232, 240, 0.8);
            --brand-pink: #be185d;
            --brand-lavender: #6d28d9;
        }

        @page {
            size: 338.67mm 190.5mm;
            margin: 0;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: var(--slate-900);
            background: #0b0f19;
            -webkit-font-smoothing: antialiased;
        }

        /* Top Bar saat dibuka langsung di browser */
        .topbar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            padding: 10px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .topbar-brand { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; }
        .topbar-badge { font-size: 10px; background: var(--rose); padding: 2px 8px; border-radius: 999px; font-weight: 700; }
        .topbar-actions { display: flex; gap: 8px; }
        .btn {
            background: rgba(255, 255, 255, 0.12);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 5px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn:hover { background: var(--rose); border-color: var(--rose); }

        /* Stage penampung slide */
        .stage {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 24px 0 90px 0;
            gap: 28px;
        }

        /* Standar Slide 16:9 McKinsey / BCG Style */
        .s {
            width: 338.67mm;
            height: 190.5mm;
            background: var(--pastel-mesh) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 8mm 14mm 6mm 14mm;
            page-break-after: always;
            box-sizing: border-box;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
            border-radius: 12px;
        }

        /* Glassmorphism Cards */
        .badge-card {
            background: rgba(255, 255, 255, 0.84);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 8px 24px rgba(100, 116, 139, 0.08);
            border-radius: 18px;
        }

        .badge-hero {
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
            border: 1.5px solid rgba(255, 255, 255, 0.95);
            box-shadow: 0 16px 40px rgba(100, 116, 139, 0.12);
            border-radius: 24px;
            padding: 8mm 12mm;
        }

        /* Badges / Pills */
        .badge-pill {
            display: inline-flex;
            align-items: center;
            gap: 1.5mm;
            padding: 1.2mm 3.2mm;
            border-radius: 9999px;
            font-size: 7pt;
            font-weight: 700;
            letter-spacing: 0.3px;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .tint-pink { background: #fce7f3; color: #be185d; border: 1px solid #fbcfe8; }
        .tint-lavender { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
        .tint-sky { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
        .tint-peach { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
        .tint-mint { background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; }
        .tint-rose { background: #ffe4e6; color: #e11d48; border: 1px solid #fecdd3; }
        .tint-amber { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
        .tint-slate { background: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }

        /* Slide Head, Body, Foot */
        .slide-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 2mm;
            shrink: 0;
        }

        .slide-title-wrap { flex: 1; max-width: 250mm; }
        .slide-eyebrow { display: flex; align-items: center; gap: 2mm; margin-bottom: 1.2mm; }
        .slide-title { font-size: 13.5pt; font-weight: 800; line-height: 1.25; color: var(--slate-900); letter-spacing: -0.2px; }
        .slide-sub { font-size: 8pt; color: var(--slate-500); margin-top: 0.8mm; line-height: 1.3; }

        .slide-body {
            flex: 1;
            display: flex;
            margin-bottom: 3.5mm;
            min-height: 0;
        }

        .slide-foot {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 2.5mm;
            border-top: 1px solid rgba(226, 232, 240, 0.8);
            font-size: 6.8pt;
            color: var(--slate-500);
            shrink: 0;
        }

        /* 2-Column Split Consulting Layout */
        .layout-split-consulting {
            display: grid;
            grid-template-columns: 1fr 6mm 1fr;
            width: 100%;
            height: 100%;
            align-items: stretch;
            gap: 0;
        }

        .col-left { height: 100%; display: flex; flex-direction: column; }
        .col-mid { display: flex; align-items: center; justify-content: center; }
        .col-right { height: 100%; display: flex; flex-direction: column; }

        .tri {
            width: 5mm;
            height: 5mm;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(226, 232, 240, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--brand-lavender);
            font-size: 8pt;
            box-shadow: 0 2px 6px rgba(100, 116, 139, 0.1);
        }

        .brand-logo-img {
            height: 6.8mm;
            width: auto;
            object-fit: contain;
            display: inline-block;
            vertical-align: middle;
        }

        /* Controller Bar di bawah */
        .controller-bar {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 8px 18px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            z-index: 100;
            color: #fff;
            font-size: 12px;
        }

        @media print {
            body { background: #fff !important; padding: 0 !important; }
            .topbar, .controller-bar { display: none !important; }
            .stage { padding: 0 !important; gap: 0 !important; }
            .s {
                border-radius: 0 !important;
                box-shadow: none !important;
                page-break-after: always !important;
            }
        }
    </style>
</head>
<body>
    <header class="topbar">
        <div class="topbar-brand">
            <span>Busana • ABS Group</span>
            <span class="topbar-badge">Boardroom Review</span>
            <span style="opacity: 0.6; font-weight: 400; font-size: 12px;">| ${title}</span>
        </div>
        <div class="topbar-actions">
            <button class="btn" onclick="window.print()"><i class="fa-solid fa-print"></i> Cetak / Simpan PDF</button>
            <button class="btn" onclick="toggleFullscreen()"><i class="fa-solid fa-expand"></i> Fullscreen</button>
        </div>
    </header>

    <main class="stage">
        ${renderedSlides}
    </main>

    <div class="controller-bar">
        <button class="btn" onclick="navigateSlide(-1)">◀ Sebelumnya</button>
        <span id="slideIndicator">Slide 1 / ${totalSlides}</span>
        <button class="btn" onclick="navigateSlide(1)">Berikutnya ▶</button>
    </div>

    <script>
        let currentIdx = 0;
        const total = ${totalSlides};
        function updateIndicator() {
            const el = document.getElementById('slideIndicator');
            if (el) el.innerText = 'Slide ' + (currentIdx + 1) + ' / ' + total;
        }
        function navigateSlide(step) {
            currentIdx = Math.max(0, Math.min(total - 1, currentIdx + step));
            const target = document.getElementById('slide-' + currentIdx);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            updateIndicator();
        }
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        }
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'PageDown') navigateSlide(1);
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') navigateSlide(-1);
        });
    </script>
</body>
</html>`;
}

function generateHtml(payload) {
    const htmlContent = generatePresentationHtml(payload);
    return {
        buffer: Buffer.from(htmlContent, 'utf-8'),
        mime: 'text/html; charset=utf-8',
    };
}

/**
 * Ekspor PDF Eksekutif 16:9 via Headless Google Chrome
 */
async function generatePdf(payload) {
    const htmlObj = generateHtml(payload);
    const htmlContent = htmlObj.buffer.toString('utf-8');

    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempHtmlPath = path.join(CHAT_FILES_DIR, `temp-${tempId}.html`);
    const tempPdfPath = path.join(CHAT_FILES_DIR, `temp-${tempId}.pdf`);

    await fs.writeFile(tempHtmlPath, htmlContent, 'utf-8');

    try {
        await execFileAsync('/usr/bin/google-chrome-stable', [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--no-pdf-header-footer',
            `--print-to-pdf=${tempPdfPath}`,
            tempHtmlPath,
        ]);

        const pdfBuffer = await fs.readFile(tempPdfPath);
        return {
            buffer: pdfBuffer,
            mime: 'application/pdf',
        };
    } finally {
        await fs.unlink(tempHtmlPath).catch(() => {});
        await fs.unlink(tempPdfPath).catch(() => {});
    }
}

/** XLSX multi-sheet bila payload.sheets, atau 1 sheet dari payload.rows */
async function generateXlsx(payload) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Busana Data Chat';
    wb.created = new Date();

    const sheets = Array.isArray(payload.sheets) && payload.sheets.length > 0
        ? payload.sheets.slice(0, 5)
        : [{ name: payload.sheetName || 'Data', rows: payload.rows, title: payload.title }];

    sheets.forEach((sheetDef) => {
        const ws = wb.addWorksheet((sheetDef.name || 'Sheet').slice(0, 31));
        const matrix = parseTableMatrix(sheetDef.rows, 1000);
        if (sheetDef.title) {
            ws.mergeCells(1, 1, 1, Math.max(matrix[0]?.length || 1, 1));
            const titleCell = ws.getCell(1, 1);
            titleCell.value = String(sheetDef.title);
            titleCell.font = { bold: true, size: 14, color: { argb: 'FF' + PALETTE.ROSE } };
            ws.addRow([]);
        }
        matrix.forEach((row, ri) => {
            const added = ws.addRow(row);
            if (ri === 0) {
                added.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PALETTE.NAVY } };
                });
            }
        });
        ws.columns.forEach((col) => {
            let maxLen = 10;
            col.eachCell?.({ includeEmpty: false }, (cell) => {
                maxLen = Math.max(maxLen, String(cell.value ?? '').length + 2);
            });
            col.width = Math.min(maxLen, 50);
        });
    });

    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
}

function generateCsv(payload) {
    const matrix = parseTableMatrix(payload.rows, 5000);
    return { buffer: Buffer.from(matrixToCsv(matrix), 'utf-8'), mime: 'text/csv; charset=utf-8' };
}

/**
 * @param {{format: 'pptx'|'pdf'|'html'|'xlsx'|'csv', title?: string, ...}} payload
 * @returns {{fileName: string, relativePath: string, mime: string, size: number}}
 */
export async function generateAgentFile(payload) {
    await ensureDir();
    const format = (payload.format || '').toLowerCase();
    if (!['pptx', 'pdf', 'html', 'xlsx', 'csv'].includes(format)) {
        throw new Error('Format file harus pptx, pdf, html, xlsx, atau csv.');
    }

    const base = slugify(payload.fileName || payload.title || 'busana-laporan');
    const fileName = `${base}-${Date.now().toString(36)}.${format}`;
    const relativePath = path.join(CHAT_FILES_DIR, fileName);

    let result;
    if (format === 'pptx') result = await generatePptx(payload);
    else if (format === 'pdf') result = await generatePdf(payload);
    else if (format === 'html') result = generateHtml(payload);
    else if (format === 'xlsx') result = await generateXlsx(payload);
    else result = generateCsv(payload);

    await fs.writeFile(relativePath, result.buffer);
    return {
        fileName,
        relativePath,
        mime: result.mime,
        size: result.buffer.length,
    };
}
