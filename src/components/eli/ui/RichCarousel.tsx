'use client';

import { useRef } from 'react';
import { RichCard, RichCardProps } from './RichCard';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface RichCarouselProps {
    items: RichCardProps[];
}

export function RichCarousel({ items }: RichCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const scrollAmount = 300;
        scrollRef.current.scrollBy({
            left: direction === 'right' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
    };

    if (!items || items.length === 0) return null;

    return (
        <div className="relative w-full max-w-full my-4 group/carousel">
            {/* Scroll Buttons */}
            <button
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur border border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-600 opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 -ml-2 hover:bg-white"
                aria-label="Scroll left"
            >
                <ChevronLeft size={16} />
            </button>

            <button
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/80 backdrop-blur border border-slate-200 rounded-full flex items-center justify-center shadow-sm text-slate-600 opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 -mr-2 hover:bg-white"
                aria-label="Scroll right"
            >
                <ChevronRight size={16} />
            </button>

            {/* Container */}
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 snap-x snap-mandatory scrollbar-hide mask-gradient-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {items.map((item, idx) => (
                    <RichCard key={idx} {...item} />
                ))}
            </div>
        </div>
    );
}
