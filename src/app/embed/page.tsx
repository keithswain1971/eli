'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EliWidget from '@/components/eli/EliWidget';

function EmbedContent() {
    const searchParams = useSearchParams();
    const context = searchParams.get('context') || undefined;

    return (
        <div className="w-full h-screen bg-transparent">
            <style dangerouslySetInnerHTML={{
                __html: `
                html, body { background: transparent !important; }
            `}} />
            <EliWidget
                surface="website"
                defaultOpen={false}
                context={context}
            />
        </div>
    );
}

export default function EmbedPage() {
    return (
        <Suspense fallback={<div className="bg-transparent" />}>
            <EmbedContent />
        </Suspense>
    );
}
