import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL belum diset.");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset.");

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "task_leader" },
  });
}

function sanitizeFileName(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 100);
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "xlsx", "xls", "csv",
  "docx", "doc", "rtf", "txt",
  "pptx", "ppt",
  "jpg", "jpeg", "png", "webp", "gif",
  "zip", "rar", "7z"
]);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const taskId = formData.get("taskId") || "unassigned";
    const uploadedBy = formData.get("uploadedBy") || "Staff";
    const uploadedById = formData.get("uploadedById") || null;
    const note = formData.get("note") || "";

    if (!file || typeof file === "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "File tidak ditemukan dalam request form-data." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ukuran berkas melebihi batas maksimum 25 MB." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const rawName = file.name || "dokumen";
    const lastDotIndex = rawName.lastIndexOf(".");
    const ext = lastDotIndex !== -1 ? rawName.slice(lastDotIndex + 1).toLowerCase() : "";
    const baseName = lastDotIndex !== -1 ? rawName.slice(0, lastDotIndex) : rawName;

    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Format berkas .${ext} tidak diizinkan. Harap unggah PDF, Excel (XLSX/CSV), Word (DOCX), PPTX, gambar, atau ZIP.`,
        }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const sanitizedBase = sanitizeFileName(baseName);
    const timeStamp = Date.now();
    const finalFileName = `${sanitizedBase}_${timeStamp}.${ext || "bin"}`;
    const storagePath = `tasks/${taskId}/${finalFileName}`;

    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("task_proofs")
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ ok: false, error: "Gagal mengunggah berkas ke storage: " + uploadError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = supabase.storage
      .from("task_proofs")
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl || "";

    const fileMeta = {
      id: `proof_${timeStamp}_${Math.random().toString(36).slice(2, 7)}`,
      name: rawName,
      size: file.size,
      ext: ext || "file",
      mimeType: file.type || "application/octet-stream",
      url: publicUrl,
      path: storagePath,
      uploadedBy,
      uploadedById,
      uploadedAt: new Date().toISOString(),
      note: note.trim(),
    };

    return new Response(
      JSON.stringify({ ok: true, file: fileMeta }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in upload-proof route:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message || "Terjadi kesalahan internal pada server." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return new Response(
        JSON.stringify({ ok: false, error: "Parameter path berkas diperlukan." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error: removeError } = await supabase.storage.from("task_proofs").remove([path]);

    if (removeError) {
      console.warn("Storage delete warning:", removeError);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in delete proof route:", err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
