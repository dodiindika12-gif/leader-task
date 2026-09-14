import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://db.absgroup.biz.id";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MjMxMjM2LCJleHAiOjE5NDU5MTEyMzZ9.nNHFrq9e9IJ6kLXEea5lfzOUa8a0506kFg3nyNZEyHU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: "task_leader" },
});