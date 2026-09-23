-- ==============================================================================
-- Migration: Chat Provider Settings (Global AI Provider Configuration)
-- Schema: task_leader
-- Fitur: Menyimpan endpoint URL, model, dan API token global AI untuk seluruh user.
-- Hanya level Direksi (Level 5) dan Super User (Level 99) yang berhak mengedit.
-- ==============================================================================

-- 1. Catatan: Pengaturan ini tersimpan di task_leader.chat_skills dengan slug 'system-provider-config'
-- agar terisolasi dan kompatibel langsung dengan schema Supabase yang ada.

INSERT INTO task_leader.chat_skills (
    slug,
    name,
    description,
    content,
    version,
    is_active,
    always_loaded,
    auto_refine
) VALUES (
    'system-provider-config',
    'Pengaturan Provider Global',
    'Konfigurasi provider AI berlaku global untuk seluruh karyawan (Base URL, API Key, Model)',
    '{"baseURL":"https://9router.absgroup.biz.id/v1","apiKey":"","model":"busana"}',
    1,
    false,
    false,
    false
)
ON CONFLICT (slug) DO UPDATE
SET updated_at = now();
