'use client';

import EliWidget from '@/components/eli/EliWidget';

export default function EmbedPage() {
    return (
        <div className="w-full h-screen bg-transparent">
            <style dangerouslySetInnerHTML={{
                __html: `
                html, body { background: transparent !important; }
            `}} />
            {/* 
                For the embedded version, we default to open 
                so it feels like a native part of the host page.
                The host page controls the iframe visibility.
            */}
            <EliWidget surface="website" defaultOpen={true} />
        </div>
    );
}
