'use client';

import { ExternalLink, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface RichCardProps {
    title: string;
    description: string;
    image?: string;
    url?: string;
    urlText?: string;
    className?: string;
}

export function RichCard({ title, description, image, url, urlText = "View Details", className }: RichCardProps) {
    return (
        <div className={cn(
            "flex flex-col w-[250px] shrink-0 bg-white rounded-xl overflow-hidden border border-slate-100 shadow-md hover:shadow-lg transition-all duration-300 group snap-center",
            className
        )}>
            {/* Image Header (Always show) */}
            <div className="h-32 w-full bg-slate-100 relative overflow-hidden">
                <div className={cn("absolute inset-0 bg-gradient-to-br",
                    title.includes('Accountant') ? "from-blue-600 to-indigo-600" :
                        title.includes('Analyst') ? "from-emerald-500 to-teal-600" :
                            "from-slate-700 to-slate-900"
                )} />

                {image && image !== "optional_url" && (
                    <img
                        src={image}
                        alt={title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                )}

                {/* Overlay Text/Icon if no image */}
                {(!image || image === "optional_url") && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 font-bold text-4xl">
                        Solveway
                    </div>
                )}
            </div>

            <div className="p-4 flex flex-col h-full bg-white">
                <h4 className="font-semibold text-slate-800 text-sm mb-1 line-clamp-1" title={title}>
                    {title}
                </h4>
                <p className="text-xs text-slate-500 mb-4 line-clamp-2 min-h-[2.5em]">
                    {description}
                </p>

                {url && (
                    <Link
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto flex items-center justify-between text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                    >
                        <span>{urlText}</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </div>
        </div>
    );
}
