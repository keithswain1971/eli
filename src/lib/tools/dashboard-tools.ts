import { SupabaseClient } from '@supabase/supabase-js';

// Explicit Return Type Interfaces
export interface LearnerDetailsResult {
    data?: Array<{
        id?: string;
        uln: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        employer?: string;
        program?: string;
        start_date?: string;
        status?: string;
    }>;
    error?: string;
}

export interface AbsentLearnersResult {
    date?: string;
    total_sessions?: number;
    total_assigned?: number;
    total_absent?: number;
    details?: Array<{
        name: string;
        employer: string;
        session?: string;
        status: string;
    }>;
    message?: string;
    error?: string;
}

// Tool Definitions for AI
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

// Tool Implementation Functions
export async function getLearnerDetails(
    supabase: SupabaseClient<any>,
    searchTerm: string
): Promise<LearnerDetailsResult> {
    try {
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
    } catch (e) {
        return { error: String(e) };
    }
}

export async function getAbsentLearners(
    supabase: SupabaseClient<any>,
    dateString?: string
): Promise<AbsentLearnersResult> {
    try {
        const targetDate = dateString ? new Date(dateString) : new Date();
        const dayStart = targetDate.toISOString().split('T')[0] + 'T00:00:00.000Z';
        const dayEnd = targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z';

        // 1. Find sessions on this day
        const { data: sessions, error: sessionError } = await supabase
            .from('training_sessions')
            .select('id, session_name, session_datetime')
            .gte('session_datetime', dayStart)
            .lte('session_datetime', dayEnd);

        if (sessionError) return { error: `Failed to find sessions: ${sessionError.message}` };
        if (!sessions || sessions.length === 0) {
            return { message: 'No training sessions found for this date.' };
        }

        const sessionIds = sessions.map(s => s.id);

        // 2. Find ALL assignments (who SHOULD be there)
        const { data: assignments, error: assignError } = await supabase
            .from('session_assignments')
            .select(`
                session_id,
                learner_uln,
                learners ( first_name, last_name, employer )
            `)
            .in('session_id', sessionIds);

        if (assignError) return { error: `Failed to fetch assignments: ${assignError.message}` };
        if (!assignments || assignments.length === 0) {
            return { message: 'Sessions found, but no learners were assigned to them.' };
        }

        // 3. Find ALL attendance records (who WAS there)
        const { data: attendance, error: attError } = await supabase
            .from('attendance_records')
            .select('session_id, learner_uln, attendance_status')
            .in('session_id', sessionIds);

        if (attError) return { error: `Failed to fetch attendance: ${attError.message}` };

        // 4. Calculate Absentees
        const absentees = assignments.filter((assign: any) => {
            const record = attendance?.find(a =>
                a.session_id === assign.session_id &&
                a.learner_uln === assign.learner_uln
            );

            if (!record) return true;
            return record.attendance_status === 'Absent' || record.attendance_status === 'Late_Absent';
        });

        // 5. Format output
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
    } catch (e) {
        return { error: String(e) };
    }
}
