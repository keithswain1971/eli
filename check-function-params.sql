-- Run this in Supabase SQL Editor to see function details
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as all_arguments,
    pg_get_function_result(p.oid) as returns
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'match_chunks' 
  AND n.nspname = 'public';

-- Also check if function accepts our parameter name
SELECT routine_name, parameter_name, data_type, parameter_mode
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'match_chunks'
ORDER BY ordinal_position;
