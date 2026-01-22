'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EliWidget from '@/components/eli/EliWidget';

function EmbedContent() {
    const searchParams = useSearchParams();
    const context = searchParams.get('context') || undefined;
    // Support both 'token' and 'access_token' params
    const token = searchParams.get('token') || searchParams.get('access_token') || undefined;
    const surfaceParam = searchParams.get('surface');
    // Validate surface
    const surface: 'website' | 'dashboard' = (surfaceParam === 'dashboard' || surfaceParam === 'website')
        ? surfaceParam
        : 'website';

    return (
        <div className="w-full h-screen bg-transparent">
            <style dangerouslySetInnerHTML={{
                __html: `
                html, body { background: transparent !important; }
            `}} />
            <EliWidget
                surface={surface}
                defaultOpen={false}
                context={context}
                accessToken={token}
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
