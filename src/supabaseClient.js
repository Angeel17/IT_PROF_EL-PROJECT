import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vuwbklfptfxmymsspivt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1d2JrbGZwdGZ4bXltc3NwaXZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjIxNDgsImV4cCI6MjA3ODE5ODE0OH0.x9cxo9o2yDBL229pdB5v6jrBg8Fzkp6vXhhgRbHe5Ug';

export const supabase = createClient(supabaseUrl, supabaseKey);