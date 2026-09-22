import { runMorningDispatch } from "@/lib/morning-dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Izinkan durasi hingga 60 detik untuk Vercel Serverless

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  const taskApiToken = process.env.TASK_API_TOKEN;

  // Jika tidak ada secret yang dikonfigurasi sama sekali di environment, izinkan eksekusi
  if (!cronSecret && !taskApiToken) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key") || url.searchParams.get("token") || "";

  const tokenToCheck = bearerToken || queryKey;

  if (cronSecret && tokenToCheck === cronSecret) return true;
  if (taskApiToken && tokenToCheck === taskApiToken) return true;

  return false;
}

export async function GET(request) {
  try {
    if (!isAuthorized(request)) {
      return Response.json(
        {
          ok: false,
          error: "Unauthorized. Sertakan header 'Authorization: Bearer <CRON_SECRET>' atau query param '?key=<CRON_SECRET>'.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dryRun") === "1" || url.searchParams.get("simulate") === "1";
    const memberId = url.searchParams.get("memberId") || null;
    const provider = url.searchParams.get("provider") || process.env.WA_PROVIDER || "fonnte";

    const result = await runMorningDispatch({
      provider,
      dryRun,
      memberIdFilter: memberId,
    });

    return Response.json({
      ok: true,
      message: dryRun
        ? "Simulasi morning dispatch berhasil."
        : "Morning dispatch tugas 07:00 WITA selesai dieksekusi.",
      ...result,
    });
  } catch (error) {
    console.error("[Cron Morning Dispatch Error]:", error);
    return Response.json(
      {
        ok: false,
        error: error.message || "Terjadi kesalahan pada cron morning dispatch.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
