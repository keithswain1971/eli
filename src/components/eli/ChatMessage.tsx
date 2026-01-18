'use client';

import ReactMarkdown from 'react-markdown';
import { RichCard, RichCardProps } from '@/components/eli/ui/RichCard';
import { RichCarousel } from '@/components/eli/ui/RichCarousel';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface ChatMessageProps {
    role: 'user' | 'assistant';
    content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
    const { textParts, aggregatedCards, hasCarousel } = useMemo(() => {
        if (role === 'user') return { textParts: [{ type: 'text', content }], aggregatedCards: [], hasCarousel: false };

        const result: any[] = [];
        const foundCards: any[] = [];
        let hasCarouselToken = false;

        let currentIndex = 0;
        const searchToken = "[UI_COMPONENT:";

        while (currentIndex < content.length) {
            const tokenIndex = content.indexOf(searchToken, currentIndex);

            if (tokenIndex === -1) {
                // No more tokens, push remaining text
                const remaining = content.slice(currentIndex);
                if (remaining) result.push({ type: 'text', content: remaining });
                break;
            }

            // Push text before token
            if (tokenIndex > currentIndex) {
                result.push({ type: 'text', content: content.slice(currentIndex, tokenIndex) });
            }

            // Start parsing JSON (Bracket Counting)
            const jsonStartIndex = content.indexOf('{', tokenIndex);
            if (jsonStartIndex === -1) {
                // Malformed start, skip this token marker
                currentIndex = tokenIndex + searchToken.length;
                continue;
            }

            let bracketCount = 0;
            let jsonEndIndex = -1;

            // Walk forward from jsonStartIndex
            for (let i = jsonStartIndex; i < content.length; i++) {
                if (content[i] === '{') bracketCount++;
                else if (content[i] === '}') bracketCount--;

                if (bracketCount === 0) {
                    jsonEndIndex = i + 1; // Include the closing brace
                    break;
                }
            }

            if (jsonEndIndex !== -1) {
                const jsonStr = content.slice(jsonStartIndex, jsonEndIndex);

                // Try Parsing
                try {
                    let data;
                    try {
                        data = JSON.parse(jsonStr);
                    } catch (originalError) {
                        // Fallback fix
                        const fixedJson = jsonStr
                            .replace(/'/g, '"')
                            .replace(/(\w+):/g, '"$1":')
                            .replace(/,\s*([\]}])/g, '$1');
                        data = JSON.parse(fixedJson);
                    }

                    if (data.type === 'card') {
                        foundCards.push(data.data);
                    } else {
                        if (data.type === 'carousel') hasCarouselToken = true;
                        result.push({ type: 'ui', data: data });
                    }
                } catch (e) {
                    result.push({ type: 'ui', data: { type: 'error', raw: jsonStr } });
                }

                // Advance index past the JSON and the closing ']' if strictly formatted
                // The prompt says [UI_COMPONENT: {...}]
                // So expected closing is ']'
                const closingBracketIndex = content.indexOf(']', jsonEndIndex);
                if (closingBracketIndex !== -1 && closingBracketIndex - jsonEndIndex < 5) {
                    currentIndex = closingBracketIndex + 1;
                } else {
                    currentIndex = jsonEndIndex;
                }
            } else {
                // No matching closing brace found? Treat as text or broken
                currentIndex = tokenIndex + searchToken.length;
            }
        }

        return { textParts: result, aggregatedCards: foundCards, hasCarousel: hasCarouselToken };
    }, [content, role]);

    return (
        <div className="flex flex-col w-full space-y-2 my-2">

            {/* 1. Text Bubble (if there is text) */}
            {textParts.some(p => p.type === 'text' && p.content.trim()) && (
                <div
                    className={cn(
                        "flex w-full",
                        role === 'user' ? "justify-end" : "justify-start"
                    )}
                >
                    <div
                        className={cn(
                            "max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed shadow-sm space-y-3",
                            role === 'user'
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-white text-slate-700 border border-slate-200 rounded-bl-none"
                        )}
                    >
                        {textParts.map((part, idx) => {
                            if (part.type === 'text') {
                                return (
                                    <div key={idx} className="prose prose-sm max-w-none dark:prose-invert">
                                        <ReactMarkdown>{part.content}</ReactMarkdown>
                                    </div>
                                );
                            }
                            // UI errors can stay inside the bubble
                            if (part.type === 'ui' && part.data.type === 'error') {
                                return (
                                    <div key={idx} className="text-xs text-red-500 bg-red-50 p-2 rounded border border-red-200">
                                        ⚠️ JSON Error: {part.data.raw.slice(0, 50)}...
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            )}

            {/* 2. Breakout Components (Carousels/Cards) - Rendered Full Width */}
            {aggregatedCards.length > 0 && !hasCarousel && (
                <div className="w-full pl-0 sm:pl-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {aggregatedCards.length === 1 ? (
                        <div className="flex justify-start">
                            <RichCard {...aggregatedCards[0]} className="w-[260px] ml-0" />
                        </div>
                    ) : (
                        <RichCarousel items={aggregatedCards} />
                    )}
                </div>
            )}

            {/* 3. Explicit Carousel Tokens (if any) */}
            {textParts.map((part, idx) => {
                if (part.type === 'ui' && part.data.type === 'carousel') {
                    return (
                        <div key={idx} className="w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <RichCarousel items={part.data.items} />
                        </div>
                    );
                }
                return null;
            })}
        </div>
    );
}
