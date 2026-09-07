import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const DEFAULT_TIMEZONE = "Asia/Makassar";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request) {
  try {
    const authResult = verifyApiToken(request);
    if (!authResult.ok) {
      return sendJson({ ok: false, error: authResult.message }, authResult.status);
    }

    const url = new URL(request.url);
    const range = (url.searchParams.get("range") || "today").toLowerCase();
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const timezone = url.searchParams.get("timezone") || DEFAULT_TIMEZONE;
    const includeDone = url.searchParams.get("includeDone") === "1";
    const projectId = url.searchParams.get("projectId") || "";
    const picId = url.searchParams.get("picId") || "";
    const priority = url.searchParams.get("priority") || "";
    const status = url.searchParams.get("status") || "";
    const folder = url.searchParams.get("folder") || "";
    const division = (url.searchParams.get("division") || "").toLowerCase();
    const limit = Math.min(Number(url.searchParams.get("limit") || 500), 1000);

    const today = getTodayYMD(timezone);
    const dateRange = resolveDateRange({ range, today, date: url.searchParams.get("date") });

    if (!dateRange.ok) {
      return sendJson({ ok: false, error: dateRange.error }, 400);
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from("tasks")
      .select("*")
      .limit(limit);

    if (!includeDone) query = query.neq("status", "Done");
    if (projectId && projectId !== "all") query = query.eq("project_id", projectId);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (status && status !== "all") query = query.eq("status", status);
    if (folder && folder !== "all") query = query.eq("folder", folder);

    if (picId && picId !== "all") {
      if (["none", "unassigned", "all-team"].includes(picId)) {
        query = query.or("pic_id.is.null,pic_id.eq.");
      } else {
        query = query.eq("pic_id", picId);
      }
    }

    if (dateRange.type === "eq") {
      query = query.eq("deadline", dateRange.from);
    }

    if (dateRange.type === "between") {
      query = query.gte("deadline", dateRange.from).lte("deadline", dateRange.to);
    }

    if (dateRange.type === "lt") {
      query = query.lt("deadline", dateRange.before);
    }

    const { data: rawTasks, error: taskError } = await query;
    if (taskError) throw taskError;

    const tasksRaw = rawTasks || [];
    const projectIds = unique(tasksRaw.map((task) => task.project_id).filter(Boolean));
    const memberIds = unique([
      ...tasksRaw.map((task) => task.pic_id).filter(Boolean),
      ...tasksRaw.flatMap((task) => normalizeTodos(task.todos).map((todo) => todo.picId).filter(Boolean)),
    ]);

    const [projects, members] = await Promise.all([
      fetchProjects(supabase, projectIds),
      fetchMembers(supabase, memberIds),
    ]);

    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const memberMap = new Map(members.map((member) => [member.id, member]));

    let tasks = tasksRaw
      .map((task) => normalizeTask(task, projectMap, memberMap))
      .sort(sortTasks);

    if (division && division !== "all") {
      tasks = tasks.filter((task) => (task.picDivision || "").toLowerCase() === division);
    }

    const meta = {
      range,
      timezone,
      today,
      from: dateRange.from || null,
      to: dateRange.to || null,
      includeDone,
      generatedAt: new Date().toISOString(),
      filters: {
        projectId: projectId || null,
        picId: picId || null,
        priority: priority || null,
        status: status || null,
        folder: folder || null,
      },
    };

    const counts = buildCounts(tasks);
    const text = buildWhatsappText({ tasks, meta, counts });

    if (format === "text" || format === "whatsapp") {
      return new Response(text, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return sendJson({ ok: true, meta, counts, tasks, text });
  } catch (error) {
    console.error("Task API error:", error);
    return sendJson(
      {
        ok: false,
        error: error?.message || "Terjadi error saat membaca task.",
      },
      500
    );
  }
}

function verifyApiToken(request) {
  const expectedToken = process.env.TASK_API_TOKEN;

  if (!expectedToken) {
    return {
      ok: false,
      status: 500,
      message: "TASK_API_TOKEN belum diset di environment variable.",
    };
  }

  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const queryToken = url.searchParams.get("token") || "";

  if (bearerToken !== expectedToken && queryToken !== expectedToken) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized. Gunakan header Authorization: Bearer <TASK_API_TOKEN>.",
    };
  }

  return { ok: true };
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error("SUPABASE_URL belum diset.");
  if (!supabaseKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY belum diset.");

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "task_leader" },
  });
}

function sendJson(payload, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function resolveDateRange({ range, today, date }) {
  if (range === "today") return { ok: true, type: "eq", from: today, to: today };

  if (range === "tomorrow") {
    const tomorrow = addDaysYMD(today, 1);
    return { ok: true, type: "eq", from: tomorrow, to: tomorrow };
  }

  if (range === "week" || range === "minggu-ini") {
    return { ok: true, type: "between", from: today, to: getEndOfWeekYMD(today) };
  }

  if (range === "overdue") {
    return { ok: true, type: "lt", before: today };
  }

  if (range === "date") {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "Parameter date wajib format YYYY-MM-DD untuk range=date." };
    }
    return { ok: true, type: "eq", from: date, to: date };
  }

  if (range === "all") return { ok: true, type: "all" };

  return {
    ok: false,
    error: "range tidak valid. Gunakan today, tomorrow, week, overdue, date, atau all.",
  };
}

function getTodayYMD(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDaysYMD(ymd, days) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getEndOfWeekYMD(today) {
  const date = new Date(`${today}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return addDaysYMD(today, daysUntilSunday);
}

async function fetchProjects(supabase, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("projects").select("id,name,color").in("id", ids);
  if (error) throw error;
  return data || [];
}

async function fetchMembers(supabase, ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("members").select("id,name,position,division,role,color").in("id", ids);
  if (error) throw error;
  return data || [];
}

function normalizeTask(task, projectMap, memberMap) {
  const todos = normalizeTodos(task.todos).map((todo) => {
    const member = todo.picId ? memberMap.get(todo.picId) : null;
    return {
      id: todo.id,
      text: todo.text,
      done: todo.done,
      picId: todo.picId || null,
      picName: member?.name || "All Semua Divisi",
      deadline: todo.deadline || null,
    };
  });

  const doneTodos = todos.filter((todo) => todo.done).length;
  const project = projectMap.get(task.project_id);
  const member = task.pic_id ? memberMap.get(task.pic_id) : null;

  return {
    id: task.id,
    title: task.title || "Tanpa Judul",
    status: task.status || "To Do",
    priority: task.priority || "Medium",
    folder: task.folder || "General",
    startDate: task.start_date || null,
    deadline: task.deadline || null,
    projectId: task.project_id || null,
    projectName: project?.name || "Tanpa Project",
    projectColor: project?.color || "#64748b",
    picId: task.pic_id || null,
    picName: member?.name || "Tanpa PIC",
    picDivision: member?.division || null,
    todos,
    todoSummary: {
      total: todos.length,
      done: doneTodos,
      open: todos.length - doneTodos,
    },
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function normalizeTodos(value) {
  if (!Array.isArray(value)) return [];

  return value.map((todo, index) => ({
    id: todo.id || `todo-${index + 1}`,
    text: todo.text || todo.title || todo.name || "Sub-kegiatan tanpa judul",
    done: Boolean(todo.done || todo.completed || todo.isDone),
    picId: todo.picId || todo.pic_id || "",
    deadline: todo.deadline || todo.due_date || "",
  }));
}

function buildCounts(tasks) {
  return {
    total: tasks.length,
    high: tasks.filter((task) => task.priority === "High").length,
    medium: tasks.filter((task) => task.priority === "Medium").length,
    low: tasks.filter((task) => task.priority === "Low").length,
    byStatus: tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {}),
  };
}

function sortTasks(a, b) {
  const dateA = a.deadline || "9999-12-31";
  const dateB = b.deadline || "9999-12-31";
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return priorityRank(a.priority) - priorityRank(b.priority);
}

function priorityRank(priority) {
  if (priority === "High") return 1;
  if (priority === "Medium") return 2;
  if (priority === "Low") return 3;
  return 4;
}

function buildWhatsappText({ tasks, meta, counts }) {
  const label = getRangeLabel(meta.range);
  const headerDate = formatDateID(meta.from || meta.today);
  const title = `📌 *TASK ${label}*`;
  const period = meta.range === "week" || meta.range === "minggu-ini"
    ? `${formatDateID(meta.from)} - ${formatDateID(meta.to)}`
    : headerDate;

  const lines = [
    title,
    `Periode: ${period}`,
    `Total: ${counts.total} task`,
  ];

  if (!tasks.length) {
    lines.push("", "✅ Tidak ada task pada periode ini.");
    return lines.join("\n");
  }

  const grouped = groupBy(tasks, (task) => task.deadline || "Tanpa Deadline");

  for (const [deadline, groupTasks] of Object.entries(grouped)) {
    lines.push("", `*${deadline === "Tanpa Deadline" ? deadline : formatDateID(deadline)}*`);

    groupTasks.forEach((task, index) => {
      const priorityIcon = task.priority === "High" ? "🔴" : task.priority === "Medium" ? "🟡" : "🔵";
      lines.push(`${index + 1}. ${priorityIcon} *${task.title}*`);
      lines.push(`   Project: ${task.projectName}`);
      lines.push(`   PIC: ${task.picName}`);
      lines.push(`   Status: ${task.status}`);

      if (task.todoSummary.total > 0) {
        lines.push(`   To-do: ${task.todoSummary.done}/${task.todoSummary.total} selesai`);
        const openTodos = task.todos.filter((todo) => !todo.done).slice(0, 5);
        openTodos.forEach((todo) => {
          lines.push(`   ☐ ${todo.text} — ${todo.picName}`);
        });
        if (task.todoSummary.open > 5) {
          lines.push(`   +${task.todoSummary.open - 5} to-do lainnya`);
        }
      }
    });
  }

  return lines.join("\n");
}

function getRangeLabel(range) {
  if (range === "today") return "HARI INI";
  if (range === "tomorrow") return "BESOK";
  if (range === "week" || range === "minggu-ini") return "MINGGU INI";
  if (range === "overdue") return "OVERDUE";
  if (range === "date") return "TANGGAL TERTENTU";
  return "SEMUA";
}

function formatDateID(ymd) {
  if (!ymd) return "-";
  const date = new Date(`${ymd}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function groupBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function unique(values) {
  return [...new Set(values)];
}