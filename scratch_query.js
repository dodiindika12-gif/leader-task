import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'task_leader' } });

async function check() {
  const { data, error } = await supabase.rpc('get_tables'); // Or try to select from typical tables
  
  // Since we don't have get_tables RPC, let's just query some tables to see what exists.
  const tables = ['workspaces', 'projects', 'tasks', 'members', 'users', 'user_workspaces'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table: ${table} - Exists: ${!error} - Error: ${error?.message || 'none'}`);
  }
}

check();
