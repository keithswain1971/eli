import { supabaseAdmin } from './supabase';

export interface ChunkResult {
    id: string;
    content: string;
    similarity: number;
    title: string;
    url: string;
    source_type: string;
}

// Increased from 5 to 50 to ensure requests for "all locations" or "all programs"
// retrieve the full set of relevant documents instead of a truncated list.
export async function findRelevantChunks(queryVector: number[], match_count = 50): Promise<ChunkResult[]> {
    try {
        console.log(`🔍 [Local Search] Starting search for vector length ${queryVector.length}...`);

        // 1. Fetch ALL embeddings (ID + Vector only)
        // For < 5000 chunks, this is fast and negligible memory (approx 10-20MB).
        const { data: allEmbeddings, error: fetchError } = await supabaseAdmin
            .from('eli_embeddings')
            .select('chunk_id, embedding');

        if (fetchError || !allEmbeddings) {
            console.error('❌ [Local Search] Failed to fetch embeddings:', fetchError);
            return [];
        }

        console.log(`📊 [Local Search] Loaded ${allEmbeddings.length} vectors from DB`);

        // 2. Perform Cosine Similarity in Memory
        const scoredChunks = (allEmbeddings as any[]).map(record => {
            // Handle vector if it comes as string or array
            let vector: number[];
            if (typeof record.embedding === 'string') {
                try { vector = JSON.parse(record.embedding); }
                catch (e) { return { id: record.chunk_id, score: -1 }; }
            } else if (Array.isArray(record.embedding)) {
                vector = record.embedding;
            } else {
                return { id: record.chunk_id, score: -1 };
            }

            // Math: Cosine Similarity
            const dotProduct = queryVector.reduce((acc, val, i) => acc + val * vector[i], 0);
            return { id: record.chunk_id, score: dotProduct }; // Normalized vectors = dot product is cosine sim
        });

        // 3. Sort and Slice
        const topChunks = scoredChunks
            // .filter(c => c.score > 0.25) // Removed threshold to capture all potential matches
            .sort((a, b) => b.score - a.score)
            .slice(0, match_count);

        console.log(`✅ [Local Search] Found ${topChunks.length} matches (Top score: ${topChunks[0]?.score.toFixed(4)})`);

        if (topChunks.length === 0) return [];

        // 4. Fetch Content for Top IDs
        const topIds = topChunks.map(c => c.id);
        const { data: contentData, error: contentError } = await supabaseAdmin
            .from('eli_chunks')
            .select(`
                id,
                content,
                eli_documents ( id, title, url, source_type )
            `)
            .in('id', topIds);

        if (contentError || !contentData) {
            console.error('❌ [Local Search] Failed to fetch content:', contentError);
            return [];
        }

        // 5. Merge Scores and Format
        return (contentData as any[]).map(chunk => {
            const score = topChunks.find(tc => tc.id === chunk.id)?.score || 0;
            // @ts-ignore - Join typing is tricky
            const doc = chunk.eli_documents;
            return {
                id: chunk.id,
                content: chunk.content,
                similarity: score,
                title: doc?.title || 'Unknown',
                url: doc?.url || '',
                source_type: doc?.source_type || 'unknown'
            };
        }).sort((a, b) => b.similarity - a.similarity);

    } catch (e) {
        console.error('🔥 [Local Search] Critical Exception:', e);
        return [];
    }
}