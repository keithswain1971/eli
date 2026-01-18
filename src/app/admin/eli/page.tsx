import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    // Fetch logs (limit 50, latest first)
    const { data: logs, error } = await supabaseAdmin
        .from('eli_chat_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
                <h3 className="font-bold">Error Loading Data</h3>
                <p>{error.message}</p>
                <p className="text-sm mt-2 opacity-75">Make sure the 'eli_chat_logs' table exists.</p>
            </div>
        );
    }

    // Basic Stats
    const totalChats = logs?.length || 0;
    const courseQueries = logs?.filter((l: any) => l.metadata?.is_course_query).length || 0;

    return (
        <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Recent Interactions</p>
                    <p className="text-3xl font-bold text-slate-800 mt-2">{totalChats}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Course Queries</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{courseQueries}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-50">
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Avg. Quality Score</p>
                    <p className="text-3xl font-bold text-slate-400 mt-2">-</p>
                </div>
            </div>

            {/* Recent Logs Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="font-semibold text-slate-700">Live Chat Logs</h2>
                    <span className="text-xs text-slate-400">Auto-refreshing on load</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 w-[20%]">Time / ID</th>
                                <th className="px-6 py-3 w-[30%]">User Query</th>
                                <th className="px-6 py-3 w-[40%]">Assistant Response</th>
                                <th className="px-6 py-3 w-[10%]">Meta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs?.map((log: any) => (
                                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-mono text-xs text-slate-400 mb-1">
                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-300 truncate w-16" title={log.id}>
                                            {log.id.substring(0, 8)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-medium text-slate-800 line-clamp-3">
                                            {log.user_message}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="text-slate-600 line-clamp-3 prose prose-xs">
                                            {log.assistant_response}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <div className="space-y-1">
                                            {log.metadata?.is_course_query && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                                    Course
                                                </span>
                                            )}
                                            {log.metadata?.has_carousel_generated && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                                                    Carousel
                                                </span>
                                            )}
                                            <div className="text-[10px] text-slate-400">
                                                src: {log.metadata?.sources_found || 0}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {logs?.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        No logs found yet. Start chatting with Eli!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
