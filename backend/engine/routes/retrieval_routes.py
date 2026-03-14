"""Retrieval routes for query testing endpoints."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from controllers.retrieval_controller import retrieval_controller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])


class RetrievalSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    collectionId: str = Field(..., min_length=1)
    k: int = Field(default=8, ge=1, le=50)
    enableReranking: bool = Field(default=False)
    rerankK: int = Field(default=3, ge=1, le=20)


@router.post(
    "/search",
    responses={
        400: {"description": "Invalid request"},
        500: {"description": "Internal server error"},
    },
)
async def search(request: RetrievalSearchRequest):
    try:
        result = await retrieval_controller.search(
            collection_id=request.collectionId,
            query=request.query,
            k=request.k,
            enable_reranking=request.enableReranking,
            rerank_k=request.rerankK,
        )
        return result
    except ValueError as e:
        logger.error("Retrieval search validation error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e
    except (RuntimeError, OSError) as e:
        logger.error("Retrieval search failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/collections",
    responses={500: {"description": "Internal server error"}},
)
async def list_collections():
    try:
        collections = await retrieval_controller.list_collections_with_counts()
        return {"success": True, "collections": collections}
    except (RuntimeError, OSError, ValueError) as e:
        logger.error("Failed to list retrieval collections: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get(
    "/collection/{collection_id}/info",
    responses={
        404: {"description": "Collection not found"},
        500: {"description": "Internal server error"},
    },
)
async def get_collection_info(collection_id: str):
    try:
        info = await retrieval_controller.get_collection_info(collection_id)
        return {"success": True, "collection": info}
    except ValueError as e:
        logger.error("Collection info validation error: %s", e)
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (RuntimeError, OSError) as e:
        logger.error("Failed to get collection info for '%s': %s", collection_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
