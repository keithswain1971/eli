import { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Admin Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="font-bold text-lg text-blue-600 tracking-tight">
                            Solveway Eli
                        </Link>
                        <span className="h-6 w-px bg-slate-200" />
                        <h1 className="font-medium text-slate-700">Admin Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">
                            BETA
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
