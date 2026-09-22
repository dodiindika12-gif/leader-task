/**
 * ==============================================================================
 * WhatsApp Gateway Adapter: Fonnte & WAHA (WhatsApp HTTP API)
 * ==============================================================================
 * Module ini mendukung peralihan mulus antara Fonnte (gateway cloud saat ini)
 * dan WAHA (gateway self-hosted masa depan) hanya melalui konfigurasi ENV.
 */

/**
 * Normalisasi format nomor WhatsApp ke standar internasional tanpa simbol
 * Contoh: 08123456789 -> 628123456789
 *         +62 812-3456-789 -> 628123456789
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  }
  return clean;
}

/**
 * Pengiriman pesan via Fonnte Gateway
 * API Docs: https://docs.fonnte.com/
 * Endpoint: POST https://api.fonnte.com/send
 */
export async function sendViaFonnte({ target, message, token }) {
  const fonnteToken = token || process.env.FONNTE_TOKEN || process.env.WA_GATEWAY_TOKEN;
  if (!fonnteToken) {
    throw new Error("FONNTE_TOKEN belum dikonfigurasi di file .env");
  }

  const cleanTarget = normalizePhoneNumber(target);

  const response = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      "Authorization": fonnteToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target: cleanTarget,
      message: message,
      countryCode: "62",
    }),
  });

  const resJson = await response.json().catch(() => ({}));
  if (!response.ok || resJson.status === false) {
    throw new Error(resJson.reason || resJson.message || `HTTP ${response.status} dari Fonnte`);
  }

  return { ok: true, provider: "fonnte", target: cleanTarget, raw: resJson };
}

/**
 * Pengiriman pesan via WAHA (WhatsApp HTTP API)
 * API Docs: https://waha.devlike.pro/
 * Endpoint: POST {WAHA_BASE_URL}/api/sendText
 */
export async function sendViaWaha({ target, message, baseUrl, apiKey, session = "default" }) {
  const wahaBaseUrl = baseUrl || process.env.WAHA_BASE_URL || "http://localhost:3000";
  const wahaApiKey = apiKey || process.env.WAHA_API_KEY;
  const wahaSession = session || process.env.WAHA_SESSION || "default";

  const cleanTarget = normalizePhoneNumber(target);
  // Format chatId untuk WAHA adalah: <nomor>@c.us
  const chatId = `${cleanTarget}@c.us`;

  const headers = {
    "Content-Type": "application/json",
  };
  if (wahaApiKey) {
    headers["x-api-key"] = wahaApiKey;
  }

  const endpoint = `${wahaBaseUrl.replace(/\/$/, "")}/api/sendText`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session: wahaSession,
      chatId: chatId,
      text: message,
    }),
  });

  const resJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resJson.message || `HTTP ${response.status} dari WAHA (${endpoint})`);
  }

  return { ok: true, provider: "waha", target: chatId, raw: resJson };
}

/**
 * Universal Sender: Otomatis memilih provider berdasarkan variabel WA_PROVIDER
 * Nilai WA_PROVIDER: 'fonnte' (default) | 'waha'
 */
export async function sendWhatsAppMessage({ target, message, provider }) {
  const activeProvider = (provider || process.env.WA_PROVIDER || "fonnte").toLowerCase().trim();
  const cleanTarget = normalizePhoneNumber(target);

  if (!cleanTarget || cleanTarget.length < 8) {
    return { ok: false, error: `Nomor WhatsApp tidak valid: ${target}` };
  }

  try {
    if (activeProvider === "waha") {
      return await sendViaWaha({ target: cleanTarget, message });
    } else {
      // Default: Fonnte
      return await sendViaFonnte({ target: cleanTarget, message });
    }
  } catch (error) {
    return { ok: false, provider: activeProvider, target: cleanTarget, error: error.message };
  }
}
