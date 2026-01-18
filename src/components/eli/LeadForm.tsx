'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LeadFormProps {
    onSubmit: (data: { name: string; email: string; phone: string }) => Promise<void>;
    onCancel: () => void;
}

export function LeadForm({ onSubmit, onCancel }: LeadFormProps) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit({ name, email, phone });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm mt-2">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Get Your Course Guide</h3>
            <p className="text-xs text-slate-600 mb-3">
                Enter your details to receive full information about this course.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
                <input
                    required
                    placeholder="Your Name"
                    className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded font-sans"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <input
                    required
                    type="email"
                    placeholder="Email Address"
                    className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded font-sans"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input
                    type="tel"
                    placeholder="Phone Number (Optional)"
                    className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded font-sans"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded font-sans"
                    >
                        Skip
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center font-sans"
                    >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Send Guide'}
                    </button>
                </div>
            </form>
        </div>
    );
}
