import { fetchStrapi } from '@/lib/strapi';
import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const response = await fetchStrapi('company-details?populate=*');
        const rawData = response.data;

        // Handle Strapi response structure (Array vs Single Object vs Attributes wrapper)
        let attr;
        if (Array.isArray(rawData)) {
            attr = rawData[0]?.attributes || rawData[0];
        } else {
            attr = rawData?.attributes || rawData;
        }

        if (!attr) throw new Error('No company details found');

        return NextResponse.json({
            phone: attr.phone || '0800 123 4567',
            email: attr.email || 'advisor@solveway.co.uk',
            website: attr.website || 'https://solveway.co.uk'
        });
    } catch (error) {
        console.error('Error fetching contact details:', error);
        // Fallback to defaults if Strapi fails
        return NextResponse.json({
            phone: '0800 123 4567',
            email: 'advisor@solveway.co.uk',
            website: 'https://solveway.co.uk'
        });
    }
}
