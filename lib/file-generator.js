/**
 * File generator untuk agent chat Busana: PPTX (pptxgenjs), XLSX (exceljs), CSV.
 * File ditulis ke /tmp/chat-files lalu di-serve via /api/chat/files/[id].
 * Konten berasal dari tool call LLM (JSON), bukan dari eksekusi kode bebas.
 */
import path from 'path';
import fs from 'fs/promises';

export const CHAT_FILES_DIR = '/tmp/chat-files';

async function ensureDir() {
    await fs.mkdir(CHAT_FILES_DIR, { recursive: true });
}

const PINK = 'FF0088';
const DARK = '1E293B';
const GRAY = '64748B';
const LIGHT = 'F8FAFC';

function slugify(text, fallback = 'file') {
    const s = String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return s || fallback;
}

function safeRows(rows, maxRows = 500) {
    const list = Array.isArray(rows) ? rows.slice(0, maxRows) : [];
    return list.map((row, i) => {
        if (Array.isArray(row)) return row.map((c) => (c === null || c === undefined ? '' : String(c)));
        if (row && typeof row === 'object') {
            return Object.keys(row).map((k) => {
                const v = row[k];
                if (v === null || v === undefined) return '';
                if (typeof v === 'object') return JSON.stringify(v);
                return String(v);
            });
        }
        return [String(row ?? '')].slice(0, i + 1);
    });
}

function matrixToCsv(matrix) {
    return matrix
        .map((row) => row.map((cell) => {
            const v = String(cell ?? '');
            return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        }).join(','))
        .join('\r\n');
}

/** PPTX standar ABS: tema Light/Pink, 16:9 */
async function generatePptx(payload) {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in (1980x1080 @150dpi)
    pptx.author = 'Busana Data Chat';
    pptx.company = 'ABS Group';
    pptx.title = payload.title || 'Laporan ABS Group';

    const slides = Array.isArray(payload.slides) ? payload.slides.slice(0, 20) : [];

    slides.forEach((slideDef) => {
        const slide = pptx.addSlide();
        slide.background = { color: 'FFFFFF' };

        // Header bar brand
        slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 0.9, fill: { color: PINK } });
        slide.addText(slideDef.title || payload.title || 'ABS Group', {
            x: 0.4, y: 0.12, w: '90%', h: 0.65,
            fontSize: slideDef.title ? 24 : 28, bold: true, color: 'FFFFFF',
            fontFace: 'Calibri', valign: 'middle',
        });

        let cursorY = 1.25;

        // Subtitle
        if (slideDef.subtitle) {
            slide.addText(slideDef.subtitle, {
                x: 0.5, y: cursorY, w: '90%', h: 0.4,
                fontSize: 14, color: GRAY, fontFace: 'Calibri',
            });
            cursorY += 0.55;
        }

        // Text block
        if (slideDef.text) {
            const textLines = String(slideDef.text).split('\n').slice(0, 12);
            slide.addText(textLines.map((line) => ({ text: line, options: { breakLine: true } })), {
                x: 0.5, y: cursorY, w: '90%', h: 1.2,
                fontSize: 14, color: DARK, fontFace: 'Calibri',
            });
            cursorY += Math.min(textLines.length * 0.3 + 0.3, 2);
        }

        // Bullet list
        if (Array.isArray(slideDef.bullets) && slideDef.bullets.length > 0) {
            slide.addText(
                slideDef.bullets.slice(0, 10).map((b) => ({
                    text: String(b), options: { bullet: { code: '2022' }, breakLine: true },
                })),
                {
                    x: 0.5, y: cursorY, w: '90%', h: 3,
                    fontSize: 14, color: DARK, fontFace: 'Calibri', lineSpacingMultiple: 1.2,
                }
            );
            cursorY += 3;
        }

        // Table (dengan header styling pink)
        if (Array.isArray(slideDef.table) && slideDef.table.length > 0) {
            const matrix = safeRows(slideDef.table, 25);
            const header = matrix[0] || [];
            const body = matrix.slice(1);
            const tableRows = [
                header.map((h) => ({
                    text: h,
                    options: { bold: true, color: 'FFFFFF', fill: { color: PINK }, fontSize: 11 },
                })),
                ...body.map((row, ri) => row.map((cell) => ({
                    text: cell,
                    options: { fontSize: 11, color: DARK, fill: { color: ri % 2 === 0 ? LIGHT : 'FFFFFF' } },
                }))),
            ];
            slide.addTable(tableRows, {
                x: 0.4, y: cursorY, w: '92%',
                border: { pt: 0.5, color: 'E2E8F0' },
                fontFace: 'Calibri',
                autoPage: false,
            });
        }

        // Footer
        slide.addText('Busana Leader Dashboard • ABS Group', {
            x: 0.4, y: '95%', w: '60%', h: 0.3,
            fontSize: 9, color: GRAY, fontFace: 'Calibri',
        });
    });

    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    return { buffer, mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
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
        const matrix = safeRows(sheetDef.rows, 1000);
        if (sheetDef.title) {
            ws.mergeCells(1, 1, 1, Math.max(matrix[0]?.length || 1, 1));
            const titleCell = ws.getCell(1, 1);
            titleCell.value = String(sheetDef.title);
            titleCell.font = { bold: true, size: 14, color: { argb: 'FF' + PINK } };
            ws.addRow([]);
        }
        matrix.forEach((row, ri) => {
            const added = ws.addRow(row);
            if (ri === 0) {
                added.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + PINK } };
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
    const matrix = safeRows(payload.rows, 5000);
    return { buffer: Buffer.from(matrixToCsv(matrix), 'utf-8'), mime: 'text/csv; charset=utf-8' };
}

/**
 * @param {{format: 'pptx'|'xlsx'|'csv', title?: string, ...}} payload
 * @returns {{fileName: string, relativePath: string, mime: string, size: number}}
 */
export async function generateAgentFile(payload) {
    await ensureDir();
    const format = (payload.format || '').toLowerCase();
    if (!['pptx', 'xlsx', 'csv'].includes(format)) {
        throw new Error('Format file harus pptx, xlsx, atau csv.');
    }

    const base = slugify(payload.fileName || payload.title || 'busana-laporan');
    const fileName = `${base}-${Date.now().toString(36)}.${format}`;
    const relativePath = path.join(CHAT_FILES_DIR, fileName);

    let result;
    if (format === 'pptx') result = await generatePptx(payload);
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
