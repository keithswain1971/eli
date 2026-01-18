import { NextRequest } from 'next/server';

interface RateLimitConfig {
    limit: number;
    windowMs: number;
}

const trackers = new Map<string, number[]>();

// Simple in-memory rate limiter
export function rateLimit(ip: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps for this IP
    let timestamps = trackers.get(ip) || [];

    // Filter out old timestamps
    timestamps = timestamps.filter(t => t > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= config.limit) {
        return false;
    }

    // Add new timestamp
    timestamps.push(now);
    trackers.set(ip, timestamps);

    // Cleanup old entries periodically (optional, or just let them be overwritten)
    return true;
}

export function getIP(req: Request): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return '127.0.0.1';
}
