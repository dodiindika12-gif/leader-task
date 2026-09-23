import { BigQuery } from '@google-cloud/bigquery';

let bigqueryClient = null;

/**
 * Mendapatkan konfigurasi kredensial BigQuery.
 * Prioritas sumber kredensial:
 * 1. Environment variable BIGQUERY_SERVICE_ACCOUNT_KEY / BIGQUERY_CREDENTIALS / GCP_SERVICE_ACCOUNT_KEY
 *    (mendukung format teks JSON langsung ataupun string Base64).
 * 2. File path dari BIGQUERY_SERVICE_ACCOUNT_PATH atau default '/home/dodi/Migrasi_Data/service-account.json'.
 */
export function getBigQueryCredentials() {
    // 1. Cek dari environment variable
    const rawKey =
        process.env.BIGQUERY_SERVICE_ACCOUNT_KEY ||
        process.env.BIGQUERY_CREDENTIALS ||
        process.env.GCP_SERVICE_ACCOUNT_KEY;

    if (rawKey && rawKey.trim()) {
        let str = rawKey.trim();

        // Bersihkan tanda petik pembungkus jika ada (sering terjadi di file .env)
        if (
            (str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))
        ) {
            str = str.slice(1, -1).trim();
        }

        // Jika bukan diawali kurung kurawal '{', coba decode Base64
        if (!str.startsWith('{')) {
            try {
                const decoded = Buffer.from(str, 'base64').toString('utf-8').trim();
                if (decoded.startsWith('{')) {
                    str = decoded;
                }
            } catch {
                // Bukan base64 valid, lanjutkan parse langsung
            }
        }

        try {
            const parsed = JSON.parse(str);
            if (!parsed.client_email || !parsed.private_key) {
                throw new Error('JSON service account harus memiliki client_email dan private_key.');
            }

            // Normalisasi private_key jika newline berbentuk literal "\n"
            const privateKey =
                typeof parsed.private_key === 'string'
                    ? parsed.private_key.replace(/\\n/g, '\n')
                    : parsed.private_key;

            return {
                credentials: {
                    client_email: parsed.client_email,
                    private_key: privateKey,
                },
                projectId: parsed.project_id || process.env.BIGQUERY_PROJECT_ID,
                source: 'env (BIGQUERY_SERVICE_ACCOUNT_KEY)',
            };
        } catch (err) {
            throw new Error(
                `Format kredensial BigQuery di environment variable tidak valid: ${err.message}`
            );
        }
    }

    // 2. Cek dari file path
    const credentialPath =
        process.env.BIGQUERY_SERVICE_ACCOUNT_PATH ||
        '/home/dodi/Migrasi_Data/service-account.json';

    let fs = null;
    try {
        fs = require('fs');
    } catch {}

    if (fs && fs.existsSync(credentialPath)) {
        try {
            const fileContent = fs.readFileSync(credentialPath, 'utf-8');
            const parsed = JSON.parse(fileContent);

            const privateKey =
                typeof parsed.private_key === 'string'
                    ? parsed.private_key.replace(/\\n/g, '\n')
                    : parsed.private_key;

            return {
                credentials: {
                    client_email: parsed.client_email,
                    private_key: privateKey,
                },
                projectId: parsed.project_id || process.env.BIGQUERY_PROJECT_ID,
                source: `file (${credentialPath})`,
            };
        } catch (err) {
            throw new Error(
                `Gagal membaca file service account di ${credentialPath}: ${err.message}`
            );
        }
    }

    throw new Error(
        'Kredensial BigQuery tidak ditemukan. Masukkan JSON service account ke environment variable BIGQUERY_SERVICE_ACCOUNT_KEY (teks JSON atau Base64) di Vercel/server, atau tentukan file di BIGQUERY_SERVICE_ACCOUNT_PATH.'
    );
}

/**
 * Mengambil atau menginisialisasi singleton BigQuery client.
 */
export function getBigQueryClient(forceNew = false) {
    if (bigqueryClient && !forceNew) return bigqueryClient;

    const config = getBigQueryCredentials();
    bigqueryClient = new BigQuery({
        credentials: config.credentials,
        projectId: config.projectId,
    });

    return bigqueryClient;
}

/**
 * Menjalankan query SQL ke BigQuery.
 */
export async function runBigQueryQuery(sql) {
    const client = getBigQueryClient();
    const [job] = await client.createQueryJob({ query: sql, useLegacySql: false });
    const [rows] = await job.getQueryResults();
    return rows;
}

/**
 * Sanitasi data baris BigQuery agar serializable ke JSON.
 */
export function sanitizeBigQueryRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => {
        const clean = {};
        for (const [key, val] of Object.entries(row)) {
            if (val === null || val === undefined) {
                clean[key] = null;
            } else if (typeof val === 'object') {
                if ('value' in val) {
                    clean[key] = String(val.value);
                } else if (val instanceof Date) {
                    clean[key] = val.toISOString();
                } else {
                    try {
                        clean[key] = JSON.parse(JSON.stringify(val));
                    } catch {
                        clean[key] = String(val);
                    }
                }
            } else if (typeof val === 'bigint') {
                clean[key] = Number(val);
            } else {
                clean[key] = val;
            }
        }
        return clean;
    });
}

/**
 * Menguji koneksi ke BigQuery dan mengambil metadata dasar.
 */
export async function testBigQueryConnection() {
    const started = Date.now();
    try {
        const config = getBigQueryCredentials();
        const client = new BigQuery({
            credentials: config.credentials,
            projectId: config.projectId,
        });

        const [datasets] = await client.getDatasets({ maxResults: 5 });

        return {
            ok: true,
            latencyMs: Date.now() - started,
            project: config.projectId,
            source: config.source,
            datasetCount: datasets.length,
            datasets: datasets.slice(0, 5).map((d) => d.id),
        };
    } catch (err) {
        return {
            ok: false,
            latencyMs: Date.now() - started,
            error: String(err?.message || err).slice(0, 400),
        };
    }
}
