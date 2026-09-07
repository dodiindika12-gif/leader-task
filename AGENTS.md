<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database Schema
The database uses a custom schema named `task_leader` instead of the default `public` schema. All SQL operations and Supabase clients must explicitly target the `task_leader` schema.
