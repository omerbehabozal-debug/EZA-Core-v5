# -*- coding: utf-8 -*-
"""
Qdrant Vector DB Client (PASİF)
Ethical embeddings ve vakaları saklayabilecek hazır ama kullanılmayan vektör altyapısı.

🔒 ALTIN KURAL: Bu modül hiçbir karar mekanizmasına bağlanmayacak.
Feature flag (VECTOR_DB_ENABLED) kapalıyken hiçbir işlem yapılmayacak.
"""

import logging
from typing import Dict, Any, List, Optional
from backend.config import get_settings

logger = logging.getLogger(__name__)


class QdrantClient:
    """
    Qdrant Vector DB Client (PASİF)
    
    Fail-safe: VECTOR_DB_ENABLED=false ise hiçbir işlem yapılmaz.
    """
    
    def __init__(self):
        """Initialize Qdrant client (only if enabled)"""
        self.settings = get_settings()
        self.enabled = self.settings.VECTOR_DB_ENABLED
        self.client = None
        self.initialized = False
        
        if self.enabled:
            try:
                from qdrant_client import QdrantClient as QdrantClientLib
                from qdrant_client.models import Distance, VectorParams
                
                self.client = QdrantClientLib(
                    url=self.settings.VECTOR_DB_URL or "http://localhost:6333",
                    api_key=self.settings.VECTOR_DB_API_KEY,
                )
                self.initialized = True
                logger.info("[VectorDB] Qdrant client initialized (PASİF mode)")
            except ImportError:
                logger.warning("[VectorDB] qdrant-client not installed, vector DB disabled")
                self.enabled = False
            except Exception as e:
                logger.warning(f"[VectorDB] Failed to initialize Qdrant: {e}, vector DB disabled")
                self.enabled = False
        else:
            logger.debug("[VectorDB] Vector DB disabled via feature flag (VECTOR_DB_ENABLED=false)")
    
    async def ensure_collections(self):
        """
        Ensure ethical_embeddings and ethical_cases collections exist.
        PASİF: Only creates if VECTOR_DB_ENABLED=true
        """
        if not self.enabled or not self.client:
            return  # No-op if disabled
        
        try:
            from qdrant_client.models import Distance, VectorParams
            
            # Collection: ethical_embeddings
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if "ethical_embeddings" not in collection_names:
                self.client.create_collection(
                    collection_name="ethical_embeddings",
                    vectors_config=VectorParams(
                        size=1536,  # OpenAI embedding size (default)
                        distance=Distance.COSINE
                    )
                )
                logger.info("[VectorDB] Created collection: ethical_embeddings")
            
            if "ethical_cases" not in collection_names:
                self.client.create_collection(
                    collection_name="ethical_cases",
                    vectors_config=VectorParams(
                        size=1536,
                        distance=Distance.COSINE
                    )
                )
                logger.info("[VectorDB] Created collection: ethical_cases")
                
        except Exception as e:
            logger.error(f"[VectorDB] Failed to ensure collections: {e}")
            # Don't raise - fail gracefully
    
    async def insert_embedding(
        self,
        collection_name: str,
        point_id: str,
        vector: List[float],
        payload: Dict[str, Any]
    ) -> bool:
        """
        Insert embedding into collection.
        PASİF: Returns False if disabled, no exception.
        """
        if not self.enabled or not self.client:
            return False  # No-op if disabled
        
        try:
            await self.ensure_collections()
            self.client.upsert(
                collection_name=collection_name,
                points=[{
                    "id": point_id,
                    "vector": vector,
                    "payload": payload
                }]
            )
            return True
        except Exception as e:
            logger.error(f"[VectorDB] Failed to insert embedding: {e}")
            return False  # Fail gracefully
    
    async def search_similar(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 10,
        score_threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for similar embeddings.
        PASİF: Returns empty list if disabled.
        """
        if not self.enabled or not self.client:
            return []  # No-op if disabled
        
        try:
            results = self.client.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit,
                score_threshold=score_threshold
            )
            return [
                {
                    "id": r.id,
                    "score": r.score,
                    "payload": r.payload
                }
                for r in results
            ]
        except Exception as e:
            logger.error(f"[VectorDB] Failed to search: {e}")
            return []  # Fail gracefully
    
    async def delete_point(
        self,
        collection_name: str,
        point_id: str
    ) -> bool:
        """
        Delete point from collection.
        PASİF: Returns False if disabled.
        """
        if not self.enabled or not self.client:
            return False  # No-op if disabled
        
        try:
            self.client.delete(
                collection_name=collection_name,
                points_selector=[point_id]
            )
            return True
        except Exception as e:
            logger.error(f"[VectorDB] Failed to delete point: {e}")
            return False  # Fail gracefully
    
    async def get_collection_stats(self, collection_name: str) -> Dict[str, Any]:
        """
        Get collection statistics.
        PASİF: Returns empty dict if disabled.
        """
        if not self.enabled or not self.client:
            return {}  # No-op if disabled
        
        try:
            info = self.client.get_collection(collection_name)
            return {
                "points_count": info.points_count,
                "vectors_count": info.vectors_count,
                "indexed_vectors_count": info.indexed_vectors_count or 0
            }
        except Exception as e:
            logger.error(f"[VectorDB] Failed to get stats: {e}")
            return {}  # Fail gracefully

