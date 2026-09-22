-- ==============================================================================
-- Migration: Add whatsapp_number column to members table
-- Schema: task_leader
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. Tambahkan kolom whatsapp_number pada tabel task_leader.members (jika belum ada)
ALTER TABLE task_leader.members 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT NULL;

-- 2. Tambahkan komentar penjelasan pada kolom
COMMENT ON COLUMN task_leader.members.whatsapp_number IS 'Nomor WhatsApp karyawan/pengguna (opsional) untuk notifikasi tugas & jadwal pagi 07:00 WIB';

-- 3. Buat index opsional untuk pencarian / query nomor WhatsApp aktif
CREATE INDEX IF NOT EXISTS idx_members_whatsapp_number 
ON task_leader.members (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;

-- 4. Reload schema cache untuk PostgREST agar API Supabase segera mengenali perubahan kolom
NOTIFY pgrst, 'reload schema';
