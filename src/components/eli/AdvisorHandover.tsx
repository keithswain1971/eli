'use client';

import { Phone, Mail, Clock, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdvisorHandoverProps {
    onRequestCallback: () => void;
}

interface ContactDetails {
    phone: string;
    email: string;
}

export function AdvisorHandover({ onRequestCallback }: AdvisorHandoverProps) {
    const [contact, setContact] = useState<ContactDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContact = async () => {
            try {
                const res = await fetch('/api/eli/contact');
                if (res.ok) {
                    const data = await res.json();
                    setContact(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchContact();
    }, []);

    const phone = contact?.phone || '0800 123 4567';
    const email = contact?.email || 'advisor@solveway.co.uk';

    return (
        <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-sm mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Speak to a Human</h3>
            <p className="text-xs text-slate-600 mb-3">
                I seem to be struggling to help. Would you like to speak to a member of our team?
            </p>

            {loading ? (
                <div className="flex justify-center p-4">
                    <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
            ) : (
                <div className="space-y-2">
                    <a
                        href={`tel:${phone.replace(/\s/g, '')}`}
                        className="flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-200 transition-colors">
                            <Phone size={14} />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">Call Us Now</div>
                            <div className="text-[10px] text-slate-500">{phone}</div>
                        </div>
                    </a>

                    <a
                        href={`mailto:${email}`}
                        className="flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group"
                    >
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-200 transition-colors">
                            <Mail size={14} />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">Email a Question</div>
                            <div className="text-[10px] text-slate-500">{email}</div>
                        </div>
                    </a>

                    <button
                        onClick={onRequestCallback}
                        className="w-full flex items-center gap-3 p-2 rounded bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer group text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-200 transition-colors">
                            <Clock size={14} />
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-medium text-slate-800">Request Callback</div>
                            <div className="text-[10px] text-slate-500">We'll call you today</div>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
