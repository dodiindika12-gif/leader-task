import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://db.absgroup.biz.id';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_key_here'; 

const supabase = createClient(supabaseUrl, supabaseKey, { db: { schema: 'task_leader' } });

async function check() {
  const tables = ['projects', 'members'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table: ${table} - Data:`, JSON.stringify(data, null, 2));
  }
}

check();
