-- ==============================================================================
-- Migration: Chat Memory & Self-Improving Skills
-- Schema: task_leader
-- Fitur: memori global + memori per user, skill agent dengan versi terkontrol
-- Jalankan di Supabase SQL Editor
-- ==============================================================================

-- 1. Tabel memori chat: scope 'global' (semua user) atau 'user' (per member)
CREATE TABLE IF NOT EXISTS task_leader.chat_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'user')),
    member_id UUID REFERENCES task_leader.members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'agent', 'auto')),
    confidence SMALLINT NOT NULL DEFAULT 5 CHECK (confidence BETWEEN 1 AND 10),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- memori user wajib punya member_id; memori global tidak boleh punya
    CONSTRAINT chat_memories_scope_member_check CHECK (
        (scope = 'user' AND member_id IS NOT NULL) OR
        (scope = 'global' AND member_id IS NULL)
    )
);

COMMENT ON TABLE task_leader.chat_memories IS 'Memori agent chat: global (semua user) dan user (per member). Sumber: manual, agent (dari percakapan), auto (refinement).';

-- 2. Tabel skill agent: instruksi bertingkat yang menyempurnakan diri
CREATE TABLE IF NOT EXISTS task_leader.chat_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    auto_refine BOOLEAN NOT NULL DEFAULT true,
    always_loaded BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE task_leader.chat_skills IS 'Skill agent chat: instruksi khusus yang bisa menyempurnakan diri lewat versi terkontrol.';

-- 3. Riwayat versi skill (audit + rollback)
CREATE TABLE IF NOT EXISTS task_leader.chat_skill_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES task_leader.chat_skills(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected')),
    created_by UUID REFERENCES task_leader.members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at TIMESTAMPTZ,
    CONSTRAINT chat_skill_versions_unique UNIQUE (skill_id, version)
);

COMMENT ON TABLE task_leader.chat_skill_versions IS 'Riwayat versi skill. Versi baru masuk sebagai pending, dijalankan otomatis atau manual dengan jejak audit.';

CREATE INDEX IF NOT EXISTS idx_chat_memories_scope ON task_leader.chat_memories (scope, member_id, is_active);
CREATE INDEX IF NOT EXISTS idx_chat_memories_member ON task_leader.chat_memories (member_id);
CREATE INDEX IF NOT EXISTS idx_chat_skills_active ON task_leader.chat_skills (is_active, always_loaded);
CREATE INDEX IF NOT EXISTS idx_chat_skill_versions_pending ON task_leader.chat_skill_versions (skill_id, status);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION task_leader.fn_chat_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_memories_updated ON task_leader.chat_memories;
CREATE TRIGGER trg_chat_memories_updated
    BEFORE UPDATE ON task_leader.chat_memories
    FOR EACH ROW EXECUTE FUNCTION task_leader.fn_chat_tables_updated_at();

DROP TRIGGER IF EXISTS trg_chat_skills_updated ON task_leader.chat_skills;
CREATE TRIGGER trg_chat_skills_updated
    BEFORE UPDATE ON task_leader.chat_skills
    FOR EACH ROW EXECUTE FUNCTION task_leader.fn_chat_tables_updated_at();

-- 5. Skill bawaan: gaya percakapan & pola data (seed, hanya insert jika kosong)
INSERT INTO task_leader.chat_skills (slug, name, description, content, auto_refine, always_loaded)
SELECT * FROM (VALUES
    ('chat-manner', 'Gaya Percakapan Busana',
     'Cara agent berbicara dan menyajikan jawaban untuk tim Busana.',
     E'- Bahasa Indonesia santai profesional, panggil user tanpa gelar.\n- Jawab langsung ke inti; detail teknis hanya bila diminta.\n- Angka Rupiah tulis penuh: Rp 1.952.426.393, jangan Rp 1,9 jt.\n- Waktu user pakai WITA (GMT+8).\n- Semua hasil data wajib disertai sumber tabel yang dipakai.',
     true, true),
    ('bigquery-playbook', 'Pola Query BigQuery',
     'Pola query yang sering dipakai tim data Busana. Menyempurnakan diri dari hasil query nyata.',
     E'- Tabel transaksi utama: `gen-lang-client-0006576805.Laporan_Penjualan_detail.tabel_transactions_v2`.\n- Default cabang kalau user tidak menyebut: ABS (Head Office).\n- Stok default hanya Status = ''Aktif''.\n- Laporan penjualan selalu sertakan MoM, YoY, pencapaian target bila relevan.\n- Pola query terbaru yang berhasil dicatat di memori global.',
     true, true)
) AS v(slug, name, description, content, auto_refine, always_loaded)
WHERE NOT EXISTS (SELECT 1 FROM task_leader.chat_skills WHERE slug IN ('chat-manner', 'bigquery-playbook'));

-- 6. Memori global awal (seed)
INSERT INTO task_leader.chat_memories (scope, content, source, confidence, created_by)
SELECT 'global', v.content, 'manual', 10, NULL
FROM (VALUES
    ('Proyek BigQuery utama: gen-lang-client-0006576805. Dataset: Laporan_Penjualan_detail, Master_Data, Target_Harian, Daftar_Outlet.'),
    ('ABS Group = Busana. Bahasa sehari-hari tim: cabang/outlet sama artinya dengan Branch/Cabang.'),
    ('File service account BigQuery di server: /home/dodi/Migrasi_Data/service-account.json.')
) AS v(content)
WHERE NOT EXISTS (SELECT 1 FROM task_leader.chat_memories WHERE scope = 'global' LIMIT 1);

-- 7. RLS: service role bypass, tapi RLS aktif untuk keamanan default
ALTER TABLE task_leader.chat_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_leader.chat_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_leader.chat_skill_versions ENABLE ROW LEVEL SECURITY;

-- Kebijakan: client anon/authed dashboard tidak diberi akses langsung;
-- semua operasi lewat API route memakai SUPABASE_SERVICE_ROLE_KEY di server.
-- (Tidak ada policy = tidak ada akses dari client key, aman secara default.)

NOTIFY pgrst, 'reload schema';
