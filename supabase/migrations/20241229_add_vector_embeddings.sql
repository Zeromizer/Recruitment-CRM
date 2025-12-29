-- Migration: Add vector embeddings for semantic search (RAG)
-- Run this in Supabase SQL Editor

-- =============================================================================
-- STEP 1: Enable pgvector extension
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- STEP 2: Add embedding column to knowledgebase table
-- =============================================================================
-- Using 1536 dimensions for OpenAI text-embedding-3-small
-- Change to 3072 for text-embedding-3-large if needed
ALTER TABLE knowledgebase
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add index for fast similarity search (using HNSW for better performance)
CREATE INDEX IF NOT EXISTS idx_knowledgebase_embedding
ON knowledgebase
USING hnsw (embedding vector_cosine_ops);

-- =============================================================================
-- STEP 3: Create similarity search function
-- =============================================================================
CREATE OR REPLACE FUNCTION search_knowledgebase(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5,
    filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    key TEXT,
    value JSONB,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.id,
        k.category,
        k.key,
        k.value,
        1 - (k.embedding <=> query_embedding) AS similarity
    FROM knowledgebase k
    WHERE k.is_active = TRUE
      AND k.embedding IS NOT NULL
      AND (filter_category IS NULL OR k.category = filter_category)
      AND 1 - (k.embedding <=> query_embedding) > match_threshold
    ORDER BY k.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Create function to search FAQs specifically
-- =============================================================================
CREATE OR REPLACE FUNCTION search_faqs(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.4,
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    key TEXT,
    question TEXT,
    answer TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.key,
        k.value->>'question' AS question,
        k.value->>'answer' AS answer,
        1 - (k.embedding <=> query_embedding) AS similarity
    FROM knowledgebase k
    WHERE k.category = 'faq'
      AND k.is_active = TRUE
      AND k.embedding IS NOT NULL
      AND 1 - (k.embedding <=> query_embedding) > match_threshold
    ORDER BY k.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 5: Create function to search roles by description
-- =============================================================================
CREATE OR REPLACE FUNCTION search_roles(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    key TEXT,
    title TEXT,
    keywords TEXT[],
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        k.key,
        k.value->>'title' AS title,
        ARRAY(SELECT jsonb_array_elements_text(k.value->'keywords')) AS keywords,
        1 - (k.embedding <=> query_embedding) AS similarity
    FROM knowledgebase k
    WHERE k.category = 'role'
      AND k.is_active = TRUE
      AND k.embedding IS NOT NULL
      AND 1 - (k.embedding <=> query_embedding) > match_threshold
    ORDER BY k.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 6: Create hybrid search function (keyword + vector)
-- =============================================================================
CREATE OR REPLACE FUNCTION hybrid_search_knowledgebase(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 5,
    keyword_weight FLOAT DEFAULT 0.3,
    vector_weight FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    key TEXT,
    value JSONB,
    combined_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH keyword_matches AS (
        -- Full-text search on value JSONB
        SELECT
            k.id,
            k.category,
            k.key,
            k.value,
            ts_rank(
                to_tsvector('english', k.value::text),
                plainto_tsquery('english', query_text)
            ) AS keyword_score
        FROM knowledgebase k
        WHERE k.is_active = TRUE
          AND to_tsvector('english', k.value::text) @@ plainto_tsquery('english', query_text)
    ),
    vector_matches AS (
        -- Vector similarity search
        SELECT
            k.id,
            k.category,
            k.key,
            k.value,
            1 - (k.embedding <=> query_embedding) AS vector_score
        FROM knowledgebase k
        WHERE k.is_active = TRUE
          AND k.embedding IS NOT NULL
    ),
    combined AS (
        SELECT
            COALESCE(km.id, vm.id) AS id,
            COALESCE(km.category, vm.category) AS category,
            COALESCE(km.key, vm.key) AS key,
            COALESCE(km.value, vm.value) AS value,
            (COALESCE(km.keyword_score, 0) * keyword_weight) +
            (COALESCE(vm.vector_score, 0) * vector_weight) AS combined_score
        FROM keyword_matches km
        FULL OUTER JOIN vector_matches vm ON km.id = vm.id
    )
    SELECT c.id, c.category, c.key, c.value, c.combined_score
    FROM combined c
    WHERE c.combined_score > 0.1
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON FUNCTION search_knowledgebase IS 'Semantic search across all knowledgebase entries using vector similarity';
COMMENT ON FUNCTION search_faqs IS 'Search FAQs by semantic similarity to find relevant answers';
COMMENT ON FUNCTION search_roles IS 'Find job roles matching a description using semantic search';
COMMENT ON FUNCTION hybrid_search_knowledgebase IS 'Combined keyword + vector search for best results';
