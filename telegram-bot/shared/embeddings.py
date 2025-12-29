"""
Embeddings Module for RAG (Retrieval Augmented Generation)

This module handles:
- Generating embeddings using OpenAI's text-embedding-3-small model
- Storing embeddings in Supabase pgvector
- Semantic search for FAQs, roles, and general knowledge

Usage:
    from shared.embeddings import (
        generate_embedding,
        search_similar_knowledge,
        search_faqs,
        search_roles
    )

    # Generate embedding for text
    embedding = await generate_embedding("What jobs do you have?")

    # Search FAQs semantically
    faqs = await search_faqs("how much does it pay")
"""

import os
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from .database import get_supabase

# Initialize OpenAI client
_openai_client: Optional[AsyncOpenAI] = None

# Embedding model configuration
EMBEDDING_MODEL = "text-embedding-3-small"  # 1536 dimensions, cheap & fast
EMBEDDING_DIMENSIONS = 1536

# Cache for embeddings to avoid redundant API calls
_embedding_cache: Dict[str, List[float]] = {}
MAX_CACHE_SIZE = 100


def get_openai_client() -> AsyncOpenAI:
    """Get or create OpenAI async client."""
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        _openai_client = AsyncOpenAI(api_key=api_key)
    return _openai_client


async def generate_embedding(text: str, use_cache: bool = True) -> Optional[List[float]]:
    """
    Generate embedding vector for text using OpenAI.

    Args:
        text: The text to embed
        use_cache: Whether to use cached embeddings

    Returns:
        List of floats representing the embedding vector, or None on error
    """
    if not text or not text.strip():
        return None

    # Normalize text for caching
    cache_key = text.strip().lower()[:500]  # Limit cache key length

    # Check cache
    if use_cache and cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    try:
        client = get_openai_client()

        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text.strip(),
            dimensions=EMBEDDING_DIMENSIONS
        )

        embedding = response.data[0].embedding

        # Cache the result
        if use_cache:
            if len(_embedding_cache) >= MAX_CACHE_SIZE:
                # Remove oldest entries (simple FIFO)
                keys_to_remove = list(_embedding_cache.keys())[:MAX_CACHE_SIZE // 2]
                for key in keys_to_remove:
                    del _embedding_cache[key]
            _embedding_cache[cache_key] = embedding

        return embedding

    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None


async def generate_embeddings_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts in a single API call.

    Args:
        texts: List of texts to embed

    Returns:
        List of embedding vectors (None for any that failed)
    """
    if not texts:
        return []

    # Filter out empty texts
    valid_texts = [t.strip() for t in texts if t and t.strip()]
    if not valid_texts:
        return [None] * len(texts)

    try:
        client = get_openai_client()

        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=valid_texts,
            dimensions=EMBEDDING_DIMENSIONS
        )

        # Map results back to original order
        embeddings = [None] * len(texts)
        valid_idx = 0
        for i, text in enumerate(texts):
            if text and text.strip():
                embeddings[i] = response.data[valid_idx].embedding
                valid_idx += 1

        return embeddings

    except Exception as e:
        print(f"Error generating batch embeddings: {e}")
        return [None] * len(texts)


# =============================================================================
# SEMANTIC SEARCH FUNCTIONS
# =============================================================================

async def search_similar_knowledge(
    query: str,
    category: str = None,
    threshold: float = 0.5,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Search knowledgebase for entries similar to the query.

    Args:
        query: The search query
        category: Optional category filter ('faq', 'role', 'company', etc.)
        threshold: Minimum similarity score (0-1)
        limit: Maximum results to return

    Returns:
        List of matching entries with similarity scores
    """
    # Generate embedding for query
    embedding = await generate_embedding(query)
    if not embedding:
        return []

    client = get_supabase()

    try:
        # Call the search function
        result = client.rpc('search_knowledgebase', {
            'query_embedding': embedding,
            'match_threshold': threshold,
            'match_count': limit,
            'filter_category': category
        }).execute()

        return result.data or []

    except Exception as e:
        print(f"Error searching knowledgebase: {e}")
        return []


async def search_faqs(
    query: str,
    threshold: float = 0.4,
    limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Search FAQs semantically to find relevant answers.

    Args:
        query: The user's question
        threshold: Minimum similarity score
        limit: Maximum FAQs to return

    Returns:
        List of matching FAQs with question, answer, and similarity
    """
    embedding = await generate_embedding(query)
    if not embedding:
        return []

    client = get_supabase()

    try:
        result = client.rpc('search_faqs', {
            'query_embedding': embedding,
            'match_threshold': threshold,
            'match_count': limit
        }).execute()

        return result.data or []

    except Exception as e:
        print(f"Error searching FAQs: {e}")
        return []


async def search_roles(
    query: str,
    threshold: float = 0.3,
    limit: int = 3
) -> List[Dict[str, Any]]:
    """
    Search job roles semantically to find matching positions.

    Args:
        query: Description of what the candidate is looking for
        threshold: Minimum similarity score
        limit: Maximum roles to return

    Returns:
        List of matching roles with title, keywords, and similarity
    """
    embedding = await generate_embedding(query)
    if not embedding:
        return []

    client = get_supabase()

    try:
        result = client.rpc('search_roles', {
            'query_embedding': embedding,
            'match_threshold': threshold,
            'match_count': limit
        }).execute()

        return result.data or []

    except Exception as e:
        print(f"Error searching roles: {e}")
        return []


async def hybrid_search(
    query: str,
    limit: int = 5,
    keyword_weight: float = 0.3,
    vector_weight: float = 0.7
) -> List[Dict[str, Any]]:
    """
    Combined keyword + vector search for best results.

    Args:
        query: The search query
        limit: Maximum results
        keyword_weight: Weight for keyword matches (0-1)
        vector_weight: Weight for semantic matches (0-1)

    Returns:
        List of results with combined scores
    """
    embedding = await generate_embedding(query)
    if not embedding:
        return []

    client = get_supabase()

    try:
        result = client.rpc('hybrid_search_knowledgebase', {
            'query_text': query,
            'query_embedding': embedding,
            'match_count': limit,
            'keyword_weight': keyword_weight,
            'vector_weight': vector_weight
        }).execute()

        return result.data or []

    except Exception as e:
        print(f"Error in hybrid search: {e}")
        return []


# =============================================================================
# EMBEDDING MANAGEMENT
# =============================================================================

async def update_knowledge_embedding(category: str, key: str, text_to_embed: str) -> bool:
    """
    Generate and store embedding for a knowledgebase entry.

    Args:
        category: The knowledge category
        key: The knowledge key
        text_to_embed: The text content to embed

    Returns:
        True on success
    """
    embedding = await generate_embedding(text_to_embed, use_cache=False)
    if not embedding:
        return False

    client = get_supabase()

    try:
        client.table('knowledgebase').update({
            'embedding': embedding
        }).eq('category', category).eq('key', key).execute()

        print(f"Updated embedding for {category}/{key}")
        return True

    except Exception as e:
        print(f"Error updating embedding: {e}")
        return False


async def embed_all_knowledge() -> Dict[str, int]:
    """
    Generate embeddings for all knowledgebase entries that don't have one.

    Returns:
        Dict with counts: {'processed': N, 'failed': N, 'skipped': N}
    """
    client = get_supabase()
    stats = {'processed': 0, 'failed': 0, 'skipped': 0}

    try:
        # Get all entries without embeddings
        result = client.table('knowledgebase').select(
            'id, category, key, value'
        ).is_('embedding', 'null').eq('is_active', True).execute()

        if not result.data:
            print("All knowledge entries already have embeddings")
            return stats

        print(f"Generating embeddings for {len(result.data)} entries...")

        for entry in result.data:
            # Create text representation for embedding
            text_parts = []
            value = entry['value']

            # Build searchable text based on category
            if entry['category'] == 'faq':
                text_parts.append(value.get('question', ''))
                text_parts.append(value.get('answer', ''))
            elif entry['category'] == 'role':
                text_parts.append(value.get('title', ''))
                text_parts.append(' '.join(value.get('keywords', [])))
                text_parts.append(value.get('notes', ''))
                text_parts.extend(value.get('experience_questions', []))
            elif entry['category'] == 'company':
                text_parts.append(str(value))
            else:
                # Generic: convert whole value to text
                text_parts.append(str(value))

            text_to_embed = ' '.join(filter(None, text_parts))

            if not text_to_embed.strip():
                stats['skipped'] += 1
                continue

            success = await update_knowledge_embedding(
                entry['category'],
                entry['key'],
                text_to_embed
            )

            if success:
                stats['processed'] += 1
            else:
                stats['failed'] += 1

        print(f"Embedding complete: {stats}")
        return stats

    except Exception as e:
        print(f"Error embedding all knowledge: {e}")
        return stats


def get_text_for_embedding(category: str, value: Dict) -> str:
    """
    Convert a knowledgebase value to text suitable for embedding.

    Args:
        category: The knowledge category
        value: The value dict

    Returns:
        Text string to embed
    """
    text_parts = []

    if category == 'faq':
        text_parts.append(value.get('question', ''))
        text_parts.append(value.get('answer', ''))
    elif category == 'role':
        text_parts.append(value.get('title', ''))
        text_parts.append(' '.join(value.get('keywords', [])))
        text_parts.append(value.get('notes', ''))
        text_parts.extend(value.get('experience_questions', []))
        text_parts.extend(value.get('key_skills', []))
    elif category == 'company':
        if isinstance(value, dict):
            text_parts.append(value.get('name', ''))
            text_parts.append(value.get('description', ''))
            text_parts.extend(value.get('focus_areas', []))
        else:
            text_parts.append(str(value))
    elif category == 'phrase':
        # Phrases are templates, embed the keys/values
        for k, v in value.items():
            if isinstance(v, list):
                text_parts.extend(v)
            else:
                text_parts.append(str(v))
    else:
        text_parts.append(str(value))

    return ' '.join(filter(None, text_parts))
