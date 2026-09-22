import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage, normalizePhoneNumber } from "./whatsapp.js";

/**
 * Level Hierarki Peran untuk Eskalasi & Radar Deadline
 * 99: Super User / Superadmin
 *  5: Direksi
 *  4: Manager
 *  3: SPV / Supervisor
 *  2: Koordinator
 *  1: Staff
 */
export const getRoleLevel = (roleName) => {
  if (!roleName) return 1;
  const clean = String(roleName).toLowerCase().trim();
  if (clean === "super user" || clean === "superadmin") return 99;
  if (clean === "direksi") return 5;
  if (clean.includes("manager")) return 4;
  if (clean.includes("spv") || clean.includes("supervisor")) return 3;
  if (clean.includes("koordinator") || clean.includes("kordinator") || clean.includes("coordinator")) return 2;
  return 1;
};

/**
 * Menentukan daftar bawahan langsung / struktural dari seorang leader
 */
export function getSubordinates(leader, allMembers) {
  const leaderLevel = getRoleLevel(leader.role);
  if (leaderLevel <= 1) return [];

  return allMembers.filter((m) => {
    if (m.id === leader.id) return false;
    const subLevel = getRoleLevel(m.role);
    if (subLevel >= leaderLevel) return false;

    // Direksi / Super User membawahi seluruh karyawan di semua divisi
    if (leaderLevel >= 5) return true;

    // Manager membawahi SPV, Koordinator, dan Staff di divisinya
    if (leaderLevel === 4) {
      return (m.division || "").trim().toLowerCase() === (leader.division || "").trim().toLowerCase();
    }

    // SPV membawahi Koordinator dan Staff di divisinya
    if (leaderLevel === 3) {
      return (m.division || "").trim().toLowerCase() === (leader.division || "").trim().toLowerCase();
    }

    // Koordinator membawahi Staff di departemen atau divisinya
    if (leaderLevel === 2) {
      const sameDiv = (m.division || "").trim().toLowerCase() === (leader.division || "").trim().toLowerCase();
      const sameDept =
        leader.department &&
        m.department &&
        (m.department || "").trim().toLowerCase() === (leader.department || "").trim().toLowerCase();
      return sameDept || sameDiv;
    }

    return false;
  });
}

/**
 * Menyusun format pesan 3 Seksi:
 * 1. Task Overdue Saya
 * 2. Task Hari Ini Saya
 * 3. Radar Deadline Bawahan (jika akun Leader)
 */
export function buildTaskNotificationMessage({ member, members, projects, tasks, todayYMD, todayHuman }) {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const subordinates = getSubordinates(member, members);
  const subIds = new Set(subordinates.map((s) => s.id));

  // 1. Task milik member sendiri (Direct PIC)
  const myTasks = tasks.filter((t) => t.pic_id === member.id);
  const myOverdue = myTasks
    .filter((t) => t.deadline && t.deadline < todayYMD)
    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  const myToday = myTasks
    .filter((t) => t.deadline === todayYMD)
    .sort((a, b) => (b.priority === "High" ? 1 : -1));

  // 2. Task milik bawahan (Radar Deadline)
  const subTasks = tasks.filter((t) => subIds.has(t.pic_id));
  const subOverdue = subTasks
    .filter((t) => t.deadline && t.deadline < todayYMD)
    .sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  const subToday = subTasks
    .filter((t) => t.deadline === todayYMD)
    .sort((a, b) => (b.priority === "High" ? 1 : -1));

  const DIVIDER = "--------------\n";

  let msg = `Selamat pagi *${member.name}*! Task ${todayHuman} yang perlu diperhatikan:\n\n`;

  // SEKSI 1: TASK OVERDUE SAYA
  msg += DIVIDER;
  msg += `🔴 *1. Task Overdue Saya*\n`;
  msg += DIVIDER;
  if (myOverdue.length === 0) {
    msg += `✅ Aman\n\n`;
  } else {
    myOverdue.forEach((t, i) => {
      const p = projectMap.get(t.project_id);
      msg += `${i + 1}. *${t.title}* (${p?.name || "General"})\n`;
      msg += `   Deadline: ${t.deadline} | Status: ${t.status}\n`;
    });
    msg += `\n`;
  }

  // SEKSI 2: TASK HARI INI SAYA
  msg += DIVIDER;
  msg += `🟡 *2. Task Hari Ini Saya*\n`;
  msg += DIVIDER;
  if (myToday.length === 0) {
    msg += `✅ Aman\n\n`;
  } else {
    myToday.forEach((t, i) => {
      const p = projectMap.get(t.project_id);
      msg += `${i + 1}. *${t.title}* (${p?.name || "General"})\n`;
      msg += `   Prioritas: ${t.priority || "Medium"} | Status: ${t.status}\n`;
    });
    msg += `\n`;
  }

  // SEKSI 3: RADAR DEADLINE TIM / BAWAHAN (Khusus Leader / Pimpinan)
  if (subordinates.length > 0) {
    msg += DIVIDER;
    msg += `📡 *3. Radar Tim / Bawahan*\n`;
    msg += DIVIDER;

    // Overdue Bawahan
    if (subOverdue.length === 0) {
      msg += `• Overdue: ✅ Aman\n`;
    } else {
      msg += `🔴 *Overdue (${subOverdue.length}):*\n`;
      subOverdue.forEach((t) => {
        const pic = memberMap.get(t.pic_id);
        msg += `• [${pic?.name || "Staf"}] *${t.title}* (${t.deadline})\n`;
      });
    }

    // Hari Ini Bawahan
    if (subToday.length === 0) {
      msg += `• Hari Ini: ✅ Aman\n\n`;
    } else {
      msg += `🟡 *Hari Ini (${subToday.length}):*\n`;
      subToday.forEach((t) => {
        const pic = memberMap.get(t.pic_id);
        msg += `• [${pic?.name || "Staf"}] *${t.title}* (${t.status})\n`;
      });
      msg += `\n`;
    }
  }

  msg += DIVIDER;
  msg += `_Bersinergi Meraih Kemenangan_ 🚀\n`;
  msg += `_Busana Leader Task_`;

  return msg;
}

/**
 * Eksekusi broadcast tugas pagi
 */
export async function runMorningDispatch({
  supabaseClient,
  provider,
  dryRun = false,
  memberIdFilter = null,
  delayMs = 400,
} = {}) {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://db.absgroup.biz.id";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const client =
    supabaseClient ||
    createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: "task_leader" },
    });

  const activeProvider = (
    provider ||
    process.env.WA_PROVIDER ||
    "fonnte"
  ).toLowerCase().trim();

  const now = new Date();
  const todayYMD = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
  }).format(now);
  const todayHuman = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Makassar",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(now);

  // 1. Ambil data dari Supabase (schema task_leader)
  const [
    { data: members, error: membersError },
    { data: projects, error: projectsError },
    { data: tasks, error: tasksError },
  ] = await Promise.all([
    client
      .from("members")
      .select("id, name, email, role, division, department, whatsapp_number, is_active")
      .eq("is_active", true),
    client.from("projects").select("id, name, division"),
    client
      .from("tasks")
      .select("id, title, status, priority, deadline, pic_id, project_id, folder")
      .neq("status", "Done"),
  ]);

  if (membersError) throw new Error(`Gagal membaca tabel members: ${membersError.message}`);
  if (projectsError) throw new Error(`Gagal membaca tabel projects: ${projectsError.message}`);
  if (tasksError) throw new Error(`Gagal membaca tabel tasks: ${tasksError.message}`);

  let eligibleMembers = (members || []).filter(
    (m) => m.whatsapp_number && m.whatsapp_number.trim().length >= 8
  );

  if (memberIdFilter) {
    eligibleMembers = eligibleMembers.filter((m) => m.id === memberIdFilter);
  }

  const results = [];

  for (const member of eligibleMembers) {
    const cleanPhone = normalizePhoneNumber(member.whatsapp_number);
    const message = buildTaskNotificationMessage({
      member,
      members: members || [],
      projects: projects || [],
      tasks: tasks || [],
      todayYMD,
      todayHuman,
    });

    if (dryRun) {
      results.push({
        memberId: member.id,
        memberName: member.name,
        phone: cleanPhone,
        status: "simulated",
        messagePreview: message.slice(0, 150) + "...",
      });
      continue;
    }

    try {
      const sendRes = await sendWhatsAppMessage({
        target: cleanPhone,
        message,
        provider: activeProvider,
      });

      results.push({
        memberId: member.id,
        memberName: member.name,
        phone: cleanPhone,
        status: sendRes.ok ? "sent" : "failed",
        error: sendRes.error || null,
        provider: activeProvider,
        raw: sendRes.raw || null,
      });
    } catch (sendErr) {
      results.push({
        memberId: member.id,
        memberName: member.name,
        phone: cleanPhone,
        status: "failed",
        error: sendErr.message,
        provider: activeProvider,
      });
    }

    // Jeda agar tidak terkena rate limit provider
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  const sentCount = results.filter((r) => r.status === "sent" || r.status === "simulated").length;
  const failedCount = results.filter((r) => r.status === "failed").length;

  return {
    ok: true,
    timezone: "Asia/Makassar (WITA, UTC+8)",
    todayYMD,
    todayHuman,
    provider: activeProvider,
    dryRun,
    totalEligible: eligibleMembers.length,
    sentCount,
    failedCount,
    dispatches: results,
  };
}
