/**
 * File generator untuk agent chat Busana: PPTX (pptxgenjs), HTML, XLSX (exceljs), CSV.
 * File ditulis ke /tmp/chat-files lalu di-serve via /api/chat/files?name=...
 * Konten berasal dari tool call LLM (JSON), bukan dari eksekusi kode bebas.
 */
import path from 'path';
import fs from 'fs/promises';

export const CHAT_FILES_DIR = '/tmp/chat-files';

async function ensureDir() {
    await fs.mkdir(CHAT_FILES_DIR, { recursive: true });
}

// Palet warna Corporate Beauty / Executive Deck ABS Group
const PALETTE = {
    NAVY: '0F172A',      // Slate 900 - Deep executive background & text
    NAVY_CARD: '1E293B', // Slate 800 - Contrast container background
    ROSE: 'E11D48',      // Rose 600 - Main brand accent
    ROSE_DARK: '9F1239', // Rose 800 - Deep accent
    ROSE_LIGHT: 'FFF1F2',// Rose 50 - Soft badge / pill tint
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
 * Generator HTML: Membuat file presentasi / laporan web mandiri (Standalone HTML).
 * - Bebas dependensi eksternal (bisa dibuka offline langsung di browser).
 * - Dilengkapi controller slide (Navigasi keyboard ← / →, tombol Sebelumnya/Berikutnya).
 * - Desain Corporate Beauty modern, responsif, dan siap cetak (Print-to-PDF).
 */
function generateHtml(payload) {
    const title = payload.title || payload.fileName || 'Laporan Eksekutif ABS Group';
    const slides = Array.isArray(payload.slides) && payload.slides.length > 0 ? payload.slides : [];

    // Jika user hanya mengirim rows (bukan slides)
    let renderedSlidesHtml = '';
    if (slides.length === 0 && Array.isArray(payload.rows) && payload.rows.length > 0) {
        const matrix = parseTableMatrix(payload.rows, 500);
        const header = matrix[0] || [];
        const body = matrix.slice(1);
        slides.push({
            title: title,
            subtitle: 'Rekap Data Tabel BigQuery',
            table: [header, ...body],
        });
    }

    // Bangun HTML tiap slide
    renderedSlidesHtml = slides.map((s, idx) => {
        const isCover = idx === 0;
        const matrix = parseTableMatrix(s.table, 30);
        const hasTable = matrix.length > 0;
        const allBullets = Array.isArray(s.bullets) ? s.bullets : [];
        const meaningfulBullets = allBullets.filter((b) => {
            const str = String(b || '').trim().toLowerCase();
            return !str.startsWith('sumber:') && !str.startsWith('source:');
        });
        const hasBullets = meaningfulBullets.length > 0;

        let tableHtml = '';
        if (hasTable) {
            const hRow = matrix[0] || [];
            const bRows = matrix.slice(1);
            tableHtml = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                ${hRow.map((c, ci) => `<th class="${ci === 0 && (c === '#' || c.toLowerCase() === 'no') ? 'center' : ''}">${c}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${bRows.map((r) => `
                                <tr>
                                    ${r.map((c, ci) => {
                                        const isNum = ci > 0 && isNumericCell(c);
                                        const isId = ci === 0 && (hRow[0] === '#' || hRow[0]?.toLowerCase() === 'no');
                                        return `<td class="${isId ? 'center' : isNum ? 'num' : ''}">${c}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        let bulletsHtml = '';
        if (hasBullets) {
            bulletsHtml = `
                <div class="card-takeaway">
                    <div class="card-takeaway-header">
                        <span class="badge">RINGKASAN & ACTION PLAN</span>
                    </div>
                    <ul class="bullet-list">
                        ${meaningfulBullets.map((b) => `<li>${String(b)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        let textHtml = '';
        if (s.text) {
            textHtml = `<p class="slide-text">${String(s.text).replace(/\n/g, '<br/>')}</p>`;
        }

        if (isCover) {
            return `
                <section class="slide slide-cover" id="slide-${idx}">
                    <div class="cover-badge">ABS GROUP • EXECUTIVE REPORT</div>
                    <h1 class="cover-title">${s.title || title}</h1>
                    <p class="cover-sub">${s.subtitle || 'Analisis Data Performa & Penjualan Google BigQuery'}</p>
                    <div class="cover-footer">
                        <div>
                            <strong>Bebie AI</strong> • Busana Leader Dashboard
                        </div>
                        <div class="text-muted">${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </section>
            `;
        }

        return `
            <section class="slide" id="slide-${idx}">
                <div class="slide-header">
                    <div class="eyebrow">ABS GROUP EXECUTIVE DECK</div>
                    <h2 class="slide-title">${s.title || ''}</h2>
                    ${s.subtitle ? `<p class="slide-sub">${s.subtitle}</p>` : ''}
                </div>
                <div class="slide-body ${hasTable && hasBullets ? 'layout-split' : 'layout-full'}">
                    ${hasTable ? `<div class="col-table">${tableHtml}</div>` : ''}
                    ${hasBullets ? `<div class="col-side">${bulletsHtml}</div>` : ''}
                    ${!hasTable && !hasBullets && textHtml ? textHtml : ''}
                </div>
                <div class="slide-footer">
                    <span>Busana Leader Dashboard • ABS Group</span>
                    <span>Halaman ${idx + 1} / ${slides.length}</span>
                </div>
            </section>
        `;
    }).join('\n');

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ABS Group</title>
    <style>
        :root {
            --navy: #0F172A;
            --navy-card: #1E293B;
            --rose: #E11D48;
            --rose-light: #FFF1F2;
            --slate-800: #1E293B;
            --slate-500: #64748B;
            --slate-100: #F1F5F9;
            --slate-50: #F8FAFC;
            --border: #E2E8F0;
            --white: #FFFFFF;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #0B0F19;
            color: var(--slate-800);
            line-height: 1.5;
            padding-bottom: 80px;
        }

        /* Top Bar */
        .topbar {
            position: sticky;
            top: 0;
            z-index: 100;
            background: rgba(15, 23, 42, 0.92);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            color: #fff;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .topbar-brand { font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; }
        .topbar-badge { font-size: 10px; background: var(--rose); padding: 2px 8px; border-radius: 999px; font-weight: 600; }
        .topbar-actions { display: flex; gap: 8px; }
        .btn {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn:hover { background: var(--rose); border-color: var(--rose); }

        /* Slide Stage */
        .stage {
            max-width: 1200px;
            margin: 32px auto;
            padding: 0 16px;
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        /* Slide Frame (16:9 widescreen style) */
        .slide {
            background: var(--white);
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
            padding: 40px 48px;
            min-height: 600px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .slide::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 5px;
            background: var(--rose);
        }

        /* Cover Slide */
        .slide-cover {
            background: var(--navy);
            color: var(--white);
            justify-content: center;
            gap: 20px;
            padding: 64px;
        }
        .cover-badge {
            display: inline-block;
            align-self: flex-start;
            background: var(--navy-card);
            color: var(--rose);
            border: 1px solid rgba(225, 29, 72, 0.3);
            font-size: 11px;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 999px;
            letter-spacing: 0.5px;
        }
        .cover-title {
            font-size: 38px;
            font-weight: 800;
            line-height: 1.2;
            color: #fff;
        }
        .cover-sub {
            font-size: 18px;
            color: var(--slate-500);
            max-width: 700px;
        }
        .cover-footer {
            margin-top: 32px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            justify-content: space-between;
            font-size: 13px;
        }

        /* Content Slide Elements */
        .eyebrow {
            font-size: 10px;
            font-weight: 700;
            color: var(--rose);
            letter-spacing: 0.8px;
            margin-bottom: 4px;
        }
        .slide-title {
            font-size: 24px;
            font-weight: 800;
            color: var(--navy);
        }
        .slide-sub {
            font-size: 13px;
            color: var(--slate-500);
            margin-top: 4px;
        }
        .slide-header {
            padding-bottom: 16px;
            border-bottom: 1px solid var(--border);
        }
        .slide-body {
            flex: 1;
            padding: 24px 0;
        }
        .slide-footer {
            padding-top: 16px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: var(--slate-500);
        }

        /* Layouts */
        .layout-split {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 24px;
            align-items: start;
        }
        .layout-full { width: 100%; }

        /* Tables */
        .table-container {
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            text-align: left;
        }
        thead th {
            background: var(--navy);
            color: #fff;
            padding: 10px 14px;
            font-weight: 700;
            white-space: nowrap;
        }
        thead th.center { text-align: center; }
        tbody td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            color: var(--slate-800);
        }
        tbody td.center { text-align: center; font-weight: 600; }
        tbody tr:nth-child(even) { background: var(--slate-50); }
        tbody tr:hover { background: #FFF1F2; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: monospace; }

        /* Key Takeaway Card */
        .card-takeaway {
            background: var(--slate-50);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
        }
        .card-takeaway-header { margin-bottom: 12px; }
        .badge {
            background: var(--rose-light);
            color: var(--rose);
            font-size: 10px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid rgba(225, 29, 72, 0.2);
        }
        .bullet-list {
            padding-left: 18px;
            font-size: 12.5px;
            color: var(--slate-800);
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .slide-text { font-size: 14px; color: var(--slate-800); line-height: 1.6; }

        /* Presentation Controller Bottom Bar */
        .controller-bar {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 8px 16px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            z-index: 100;
            color: #fff;
            font-size: 13px;
        }

        @media print {
            body { background: #fff; padding: 0; }
            .topbar, .controller-bar { display: none !important; }
            .stage { max-width: 100%; margin: 0; padding: 0; gap: 0; }
            .slide {
                border-radius: 0;
                box-shadow: none;
                border: none;
                page-break-after: always;
                min-height: 100vh;
            }
        }
    </style>
</head>
<body>
    <header class="topbar">
        <div class="topbar-brand">
            <span>ABS Group</span>
            <span class="topbar-badge">Executive Deck</span>
            <span style="opacity: 0.6; font-weight: 400; font-size: 13px;">| ${title}</span>
        </div>
        <div class="topbar-actions">
            <button class="btn" onclick="window.print()">Cetak / Simpan PDF</button>
            <button class="btn" onclick="toggleFullscreen()">Fullscreen</button>
        </div>
    </header>

    <main class="stage">
        ${renderedSlidesHtml}
    </main>

    <div class="controller-bar">
        <button class="btn" onclick="navigateSlide(-1)">◀ Sebelumnya</button>
        <span id="slideIndicator">Slide 1 / ${slides.length}</span>
        <button class="btn" onclick="navigateSlide(1)">Berikutnya ▶</button>
    </div>

    <script>
        let currentIdx = 0;
        const total = ${slides.length};
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

    return {
        buffer: Buffer.from(htmlContent, 'utf-8'),
        mime: 'text/html; charset=utf-8',
    };
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
 * @param {{format: 'pptx'|'html'|'xlsx'|'csv', title?: string, ...}} payload
 * @returns {{fileName: string, relativePath: string, mime: string, size: number}}
 */
export async function generateAgentFile(payload) {
    await ensureDir();
    const format = (payload.format || '').toLowerCase();
    if (!['pptx', 'html', 'xlsx', 'csv'].includes(format)) {
        throw new Error('Format file harus pptx, html, xlsx, atau csv.');
    }

    const base = slugify(payload.fileName || payload.title || 'busana-laporan');
    const fileName = `${base}-${Date.now().toString(36)}.${format}`;
    const relativePath = path.join(CHAT_FILES_DIR, fileName);

    let result;
    if (format === 'pptx') result = await generatePptx(payload);
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
