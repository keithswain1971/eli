import { SupabaseClient } from '@supabase/supabase-js';

// Define the Tool Interfaces for the AI to understand
export const dashboardToolDefinitions = {
    get_learner_details: {
        description: 'Get details for a specific learner by name or ULN.',
        parameters: {
            type: 'object',
            properties: {
                search_term: {
                    type: 'string',
                    description: 'The name or ULN of the learner to find.'
                }
            },
            required: ['search_term']
        }
    },
    get_absent_learners: {
        description: 'List learners who were absent for a specific date or "today".',
        parameters: {
            type: 'object',
            properties: {
                date_string: {
                    type: 'string',
                    description: 'The date to check (YYYY-MM-DD). Defaults to today if not specified.'
                }
            },
            required: []
        }
    }
};

// Tool Implementations
export async function getLearnerDetails(supabase: SupabaseClient<any>, searchTerm: string) {
    // Try to find by ULN first
    let query = supabase.from('learners').select('*').eq('uln', searchTerm);
    let { data, error } = await query;

    if (!data || data.length === 0) {
        // Try fuzzy search by name
        const { data: nameData, error: nameError } = await supabase
            .from('learners')
            .select('*')
            .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`)
            .limit(5);

        if (nameError) return { error: nameError.message };
        return { data: nameData };
    }

    if (error) return { error: error.message };
    return { data };
}

export async function getAbsentLearners(supabase: SupabaseClient<any>, dateString?: string) {
    const targetDate = dateString ? new Date(dateString) : new Date();
    // Format as YYYY-MM-DD
    const dayStart = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const dayEnd = targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z';

    // 1. Find sessions on this day
    const { data: sessions, error: sessionError } = await supabase
        .from('training_sessions')
        .select('id, session_name, session_datetime')
        .gte('session_datetime', dayStart)
        .lte('session_datetime', dayEnd);

    if (sessionError) return { error: `Failed to find sessions: ${sessionError.message}` };
    if (!sessions || sessions.length === 0) return { message: 'No training sessions found for this date.' };

    const sessionIds = sessions.map(s => s.id);

    // 2. Find ALL assignments (who SHOULD be there)
    // We join learners to get names
    // NOTE: We need to use !inner join or similar if we want to filter, but here we just get all.
    // We suppress 'any' errors because Supabase Join types are complex to infer without full generation.
    const { data: assignments, error: assignError } = await supabase
        .from('session_assignments')
        .select(`
            session_id,
            learner_uln,
            learners ( first_name, last_name, employer )
        `)
        .in('session_id', sessionIds);

    if (assignError) return { error: `Failed to fetch assignments: ${assignError.message}` };
    if (!assignments || assignments.length === 0) return { message: 'Sessions found, but no learners were assigned to them.' };

    // 3. Find ALL attendance records (who WAS there)
    const { data: attendance, error: attError } = await supabase
        .from('attendance_records')
        .select('session_id, learner_uln, attendance_status')
        .in('session_id', sessionIds);

    if (attError) return { error: `Failed to fetch attendance: ${attError.message}` };

    // 4. Calculate Absentees
    // Absent = Assigned AND (No Record OR status != 'Attended')
    const absentees = assignments.filter((assign: any) => {
        const record = attendance?.find(a =>
            a.session_id === assign.session_id &&
            a.learner_uln === assign.learner_uln
        );

        // If no record exists, they are absent (haven't signed in)
        if (!record) return true;

        // If record exists, check if status is 'Absent'
        return record.attendance_status === 'Absent' || record.attendance_status === 'Late_Absent';
    });

    // Format the output specifically for the AI to read easily
    const summary = absentees.map((r: any) => {
        const session = sessions.find(s => s.id === r.session_id);
        const learner = r.learners;
        return {
            name: learner ? `${learner.first_name} ${learner.last_name}` : 'Unknown',
            employer: learner?.employer || 'Unknown',
            session: session?.session_name,
            status: 'Absent'
        };
    });

    return {
        date: targetDate.toISOString().split('T')[0],
        total_sessions: sessions.length,
        total_assigned: assignments.length,
        total_absent: summary.length,
        details: summary
    };
}
