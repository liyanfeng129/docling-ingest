"""
Retrieval Controller

Handles retrieval/query testing operations:
- collection listing with counts
- collection info lookup
- similarity search and optional reranking
"""

import logging
import time
from typing import Any, Dict, List

from config.settings import settings
from models.embedding_model import embedding_manager
from models.reranker_model import reranker_manager
from models.vectorstore import vectorstore_manager, Document

logger = logging.getLogger(__name__)


class RetrievalController:
    """Controller for retrieval operations."""

    @staticmethod
    def _with_origin_index(documents: List[Document]) -> List[Document]:
        return [
            Document(
                page_content=doc.page_content,
                metadata={**(doc.metadata or {}), "_origin_index": index},
            )
            for index, doc in enumerate(documents)
        ]

    @staticmethod
    def _build_results(
        documents: List[Document],
        distance_by_index: Dict[int, float],
        score_by_index: Dict[int, float],
        include_rerank_score: bool,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []

        for index, document in enumerate(documents):
            origin_index = document.metadata.get("_origin_index")
            safe_metadata = dict(document.metadata or {})
            safe_metadata.pop("_origin_index", None)

            result = {
                "rank": index + 1,
                "content": document.page_content,
                "metadata": safe_metadata,
                "distance": float(distance_by_index.get(origin_index, 0.0)),
            }

            if include_rerank_score and isinstance(origin_index, int):
                result["rerankScore"] = float(score_by_index.get(origin_index, 0.0))

            results.append(result)

        return results

    async def list_collections_with_counts(self) -> List[Dict[str, Any]]:
        collections = await vectorstore_manager.list_collections()
        enriched = []

        for collection in collections:
            try:
                info = await vectorstore_manager.get_collection_info(collection["id"])
                enriched.append({**collection, "docCount": info.get("docCount", 0)})
            except (RuntimeError, OSError, ValueError) as e:
                logger.warning(
                    "Failed to read count for collection '%s': %s",
                    collection.get("id"),
                    e,
                )
                enriched.append({**collection, "docCount": 0})

        return enriched

    async def get_collection_info(self, collection_id: str) -> Dict[str, Any]:
        return await vectorstore_manager.get_collection_info(collection_id)

    async def search(
        self,
        collection_id: str,
        query: str,
        k: int = 8,
        enable_reranking: bool = False,
        rerank_k: int = 3,
    ) -> Dict[str, Any]:
        total_start = time.perf_counter()

        embedding_start = time.perf_counter()
        query_vector = embedding_manager.embed_query(query)
        embedding_ms = int((time.perf_counter() - embedding_start) * 1000)

        search_start = time.perf_counter()
        documents, distances, observability = await vectorstore_manager.search_with_scores(
            query=query,
            k=k,
            collection_id=collection_id,
            query_vector=query_vector,
        )
        search_ms = int((time.perf_counter() - search_start) * 1000)

        indexed_documents = self._with_origin_index(documents)

        rerank_ms = 0
        reranked_documents = indexed_documents
        score_by_index: Dict[int, float] = {}

        if enable_reranking and indexed_documents:
            rerank_start = time.perf_counter()
            top_k = min(max(rerank_k, 1), len(indexed_documents))
            reranked_documents = reranker_manager.rerank(query, indexed_documents, top_k=top_k)
            rerank_ms = int((time.perf_counter() - rerank_start) * 1000)

            for reranked_doc in reranked_documents:
                score = reranked_doc.metadata.get("rerank_score")
                origin_index = reranked_doc.metadata.get("_origin_index")
                if score is not None and isinstance(origin_index, int):
                    score_by_index[origin_index] = float(score)

        distance_by_index = {index: distances[index] for index in range(min(len(documents), len(distances)))}

        result_documents: List[Document] = reranked_documents if enable_reranking else indexed_documents
        results = self._build_results(
            documents=result_documents,
            distance_by_index=distance_by_index,
            score_by_index=score_by_index,
            include_rerank_score=enable_reranking,
        )

        total_ms = int((time.perf_counter() - total_start) * 1000)

        response_observability = {
            "embeddingModel": settings.EMBEDDING_MODEL,
            "embeddingDim": observability.get("embeddingDim", 0),
            "collectionDocCount": observability.get("collectionDocCount", 0),
            "queryLength": len(query),
        }

        if enable_reranking:
            response_observability["rerankerModel"] = reranker_manager.model_name or settings.RERANKER_MODEL

        logger.info(
            "[Retrieval] collection=%s queryLen=%d k=%d rerank=%s total=%dms",
            collection_id,
            len(query),
            k,
            enable_reranking,
            total_ms,
        )

        return {
            "success": True,
            "results": results,
            "timing": {
                "embeddingMs": embedding_ms,
                "searchMs": search_ms,
                "rerankMs": rerank_ms,
                "totalMs": total_ms,
            },
            "observability": response_observability,
        }


retrieval_controller = RetrievalController()
