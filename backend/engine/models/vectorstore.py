"""
Vector Store Manager
Handles ChromaDB vector store initialization and management.
Supports multiple collections for different document sets.
"""

import asyncio
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass


import chromadb
from chromadb.api.models.Collection import Collection


from config.settings import settings
from models.embedding_model import embedding_manager

logger = logging.getLogger(__name__)


@dataclass
class Document:
    page_content: str
    metadata: Dict[str, Any]


class VectorStoreManager:
    """
    Manages ChromaDB vector store lifecycle.

    Supports multiple collections:
    - Default collection loaded at startup
    - Dynamic collection access for ingestion to different targets
    """

    _instance: Optional["VectorStoreManager"] = None

    _default_client: Optional[chromadb.PersistentClient] = None
    _default_collection: Optional[Collection] = None
    _is_loaded: bool = False
    _current_db_name: Optional[str] = None

    _collection_cache: Dict[str, tuple] = {}
    _switch_lock: Optional[asyncio.Lock] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._default_client = None
            self._default_collection = None
            self._is_loaded = False
            self._current_db_name = None
            self._collection_cache = {}
            self._switch_lock = None

    @property
    def current_db_name(self) -> Optional[str]:
        """Get the name of the currently loaded vector database."""
        return self._current_db_name

    async def load(self) -> bool:
        """Load the default ChromaDB vector store"""
        if self._is_loaded:
            logger.info("Vector store already loaded")
            return True

        return await asyncio.to_thread(self._load_store)

    def _load_store(self) -> bool:
        """Load the default collection from CHROMA_PERSIST_DIRECTORY"""
        try:
            if not embedding_manager.is_loaded:
                raise RuntimeError("Embedding model must be loaded before vector store")

            persist_directory = settings.CHROMA_PERSIST_DIRECTORY
            if not os.path.exists(persist_directory) or not os.listdir(persist_directory):
                logger.warning(
                    "No default vector store found at: %s. "
                    "Ingestion endpoints are still available.",
                    persist_directory
                )
                self._is_loaded = False
                return False

            logger.info("Loading vector store from: %s", persist_directory)

            self._default_client = chromadb.PersistentClient(path=persist_directory)

            try:
                self._default_collection = self._default_client.get_collection(
                    name=settings.CHROMA_COLLECTION_NAME
                )
            except ValueError as exc:
                raise RuntimeError(
                    f"Collection '{settings.CHROMA_COLLECTION_NAME}' not found in DB."
                ) from exc

            self._is_loaded = True
            self._current_db_name = Path(persist_directory).name
            logger.info("Vector store loaded successfully")
            return True

        except Exception as e:
            logger.error("Failed to load vector store: %s", e)
            self._is_loaded = False
            raise

    def _get_collection_path(self, collection_id: str) -> Path:
        """Get the filesystem path for a collection."""
        chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
        return chroma_base / collection_id

    def _get_or_create_collection(
        self,
        collection_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple:
        """Get or create a ChromaDB collection for the given collection_id."""
        if collection_id in self._collection_cache:
            return self._collection_cache[collection_id]

        if not embedding_manager.is_loaded:
            logger.info("Loading embedding model for ingestion...")
            embedding_manager.load()

        collection_path = self._get_collection_path(collection_id)
        collection_path.mkdir(parents=True, exist_ok=True)

        logger.info("Opening collection at: %s", collection_path)

        client = chromadb.PersistentClient(path=str(collection_path))
        create_kwargs = {"name": settings.CHROMA_COLLECTION_NAME}
        if metadata:
            create_kwargs["metadata"] = metadata
        collection = client.get_or_create_collection(**create_kwargs)

        self._collection_cache[collection_id] = (client, collection)

        return client, collection

    async def create_collection(
        self,
        collection_id: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new ChromaDB collection."""
        collection_path = self._get_collection_path(collection_id)

        if collection_id in self._collection_cache:
            return {
                "success": False,
                "error": f"Collection '{collection_id}' already exists",
            }

        if collection_path.exists() and any(collection_path.iterdir()):
            return {
                "success": False,
                "error": f"Collection '{collection_id}' already exists",
            }

        collection_path.mkdir(parents=True, exist_ok=True)
        logger.info("Creating new collection at: %s", collection_path)

        try:
            def _init_collection():
                client = chromadb.PersistentClient(path=str(collection_path))
                create_kwargs = {"name": settings.CHROMA_COLLECTION_NAME}
                if description:
                    create_kwargs["metadata"] = {"description": description}
                collection = client.get_or_create_collection(**create_kwargs)
                return client, collection

            client, collection = await asyncio.to_thread(_init_collection)

            self._collection_cache[collection_id] = (client, collection)

            logger.info("Successfully created collection: %s", collection_id)

            return {
                "success": True,
                "collection": {
                    "id": collection_id,
                    "name": collection_id,
                    "label": collection_id.replace("_", " ").title(),
                    "type": "chroma",
                    "path": str(collection_path),
                    "description": description,
                    "createdAt": datetime.now().isoformat(),
                },
                "message": f"Collection '{collection_id}' created successfully",
            }
        except Exception as e:
            logger.error("Failed to create collection '%s': %s", collection_id, e)
            if collection_path.exists() and not any(collection_path.iterdir()):
                collection_path.rmdir()
            raise

    async def list_collections(self) -> List[Dict[str, Any]]:
        """List all available ChromaDB collections."""
        collections = []
        chroma_base = Path(settings.CHROMA_DB_DIRECTORY)

        if not chroma_base.exists():
            logger.warning("ChromaDB base directory not found: %s", chroma_base)
            return collections

        for item in sorted(chroma_base.iterdir()):
            if item.is_dir():
                collection_id = item.name
                label = collection_id.replace("_", " ").title()

                collections.append({
                    "id": collection_id,
                    "label": label,
                    "type": "chroma",
                    "path": str(item),
                    "isDefault": collection_id == "default",
                })

        logger.info("Found %d ChromaDB collections", len(collections))
        return collections

    async def search(self, query: str, k: int = 8) -> List[Document]:
        """Similarity search on default collection."""
        if not self._is_loaded or self._default_collection is None:
            raise RuntimeError("Vector store not loaded. Call load() first.")

        query_vector = embedding_manager.embed_query(query)

        results = await asyncio.to_thread(
            self._default_collection.query,
            query_embeddings=[query_vector],
            n_results=k,
            include=["documents", "metadatas", "distances"],
        )

        documents = []

        if results["ids"] and len(results["ids"][0]) > 0:
            num_results = len(results["ids"][0])
            for i in range(num_results):
                content = results["documents"][0][i]
                meta = results["metadatas"][0][i]
                doc = Document(page_content=content, metadata=meta)
                documents.append(doc)

        return documents

    async def search_with_scores(
        self,
        query: str,
        k: int = 8,
        collection_id: Optional[str] = None,
        query_vector: Optional[List[float]] = None,
    ) -> Tuple[List[Document], List[float], Dict[str, Any]]:
        """Similarity search with distance scores on a specific collection.

        Uses a temporary read-only client/collection and does not mutate
        singleton default collection state.
        """
        target_collection_id = collection_id or self.current_db_name or "default"
        resolved_query_vector = query_vector if query_vector is not None else embedding_manager.embed_query(query)

        collection_path = self._get_collection_path(target_collection_id)
        if not collection_path.exists():
            raise ValueError(f"Collection '{target_collection_id}' not found")

        def _query_collection() -> Dict[str, Any]:
            temp_client = chromadb.PersistentClient(path=str(collection_path))
            temp_collection = temp_client.get_collection(name=settings.CHROMA_COLLECTION_NAME)
            return temp_collection.query(
                query_embeddings=[resolved_query_vector],
                n_results=k,
                include=["documents", "metadatas", "distances"],
            )

        results = await asyncio.to_thread(_query_collection)

        documents: List[Document] = []
        distances: List[float] = []

        if results.get("ids") and len(results["ids"][0]) > 0:
            num_results = len(results["ids"][0])
            for i in range(num_results):
                content = results["documents"][0][i]
                metadata = results["metadatas"][0][i] if results["metadatas"][0] else {}
                distance = float(results["distances"][0][i]) if results.get("distances") else 0.0

                documents.append(Document(page_content=content, metadata=metadata or {}))
                distances.append(distance)

        observability = {
            "embeddingDim": len(resolved_query_vector),
            "collectionDocCount": await self._get_collection_doc_count(target_collection_id),
            "collectionName": target_collection_id,
        }
        return documents, distances, observability

    async def get_collection_info(self, collection_id: str) -> Dict[str, Any]:
        """Get metadata summary information for a collection."""
        collection_path = self._get_collection_path(collection_id)
        if not collection_path.exists():
            raise ValueError(f"Collection '{collection_id}' not found")

        def _info() -> Dict[str, Any]:
            temp_client = chromadb.PersistentClient(path=str(collection_path))
            temp_collection = temp_client.get_collection(name=settings.CHROMA_COLLECTION_NAME)
            total_docs = temp_collection.count()

            sample_result = temp_collection.get(limit=10, include=["metadatas"])
            metadata_keys = set()
            sample_metadata = {}

            for metadata in sample_result.get("metadatas", []):
                if metadata:
                    metadata_keys.update(metadata.keys())
                    if not sample_metadata:
                        sample_metadata = metadata

            return {
                "id": collection_id,
                "docCount": total_docs,
                "metadataKeys": sorted(metadata_keys),
                "sampleMetadata": sample_metadata,
            }

        return await asyncio.to_thread(_info)

    async def _get_collection_doc_count(self, collection_id: str) -> int:
        """Get document count for a collection without mutating state."""
        collection_path = self._get_collection_path(collection_id)
        if not collection_path.exists():
            return 0

        def _count() -> int:
            temp_client = chromadb.PersistentClient(path=str(collection_path))
            temp_collection = temp_client.get_collection(name=settings.CHROMA_COLLECTION_NAME)
            return temp_collection.count()

        return await asyncio.to_thread(_count)

    @property
    def is_loaded(self) -> bool:
        """Return whether the default vector store has been loaded."""
        return self._is_loaded

    async def ingest(
        self,
        collection_id: str,
        documents: List[Dict[str, Any]],
        strategy: str = "embed_per_page",
        batch_size: int = 32
    ) -> Dict[str, Any]:
        """Ingest documents into a specific collection."""
        if not documents:
            return {
                "success": False,
                "error": "No documents provided for ingestion",
            }

        logger.info(
            "[Ingest] Starting ingestion of %d documents to '%s'",
            len(documents), collection_id
        )

        ids = []
        texts = []
        metadatas = []

        for i, doc in enumerate(documents):
            doc_id = doc.get('id', f'doc_{i}')
            content = doc.get('content', '')
            metadata = doc.get('metadata', {})

            # Guard against None or non-string content
            if content is None:
                logger.warning("[Ingest] Skipping document with None content: %s", doc_id)
                continue
            content = str(content)

            if not content.strip():
                logger.warning("[Ingest] Skipping empty document: %s", doc_id)
                continue

            clean_metadata = self._clean_metadata(metadata)

            ids.append(doc_id)
            texts.append(content)
            metadatas.append(clean_metadata)

        if not ids:
            return {
                "success": False,
                "error": "No valid documents to ingest (all empty)",
            }

        logger.info("[Ingest] Embedding %d documents...", len(texts))
        embeddings = await asyncio.to_thread(
            embedding_manager.embed_documents,
            texts,
            batch_size,
            True
        )

        collection_path = self._get_collection_path(collection_id)
        default_path = os.path.normpath(os.path.abspath(settings.CHROMA_PERSIST_DIRECTORY))
        ingestion_path = os.path.normpath(os.path.abspath(str(collection_path)))

        if ingestion_path == default_path and self._is_loaded and self._default_collection:
            logger.info("[Ingest] Using default collection (same path)")
            collection = self._default_collection
        else:
            _, collection = await asyncio.to_thread(
                self._get_or_create_collection,
                collection_id,
                {"strategy": strategy}
            )

        logger.info("[Ingest] Adding %d documents to ChromaDB...", len(ids))
        await asyncio.to_thread(
            collection.add,
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=texts
        )

        logger.info(
            "[Ingest] Successfully ingested %d documents to '%s'",
            len(ids), collection_id
        )

        return {
            "success": True,
            "collectionId": collection_id,
            "collectionPath": str(collection_path),
            "strategy": strategy,
            "documentCount": len(ids),
            "totalChars": sum(len(t) for t in texts),
            "message": f"Successfully ingested {len(ids)} documents to {collection_id}",
        }

    def _clean_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Clean metadata for ChromaDB storage."""
        clean = {}
        for key, value in metadata.items():
            if isinstance(value, (str, int, float, bool)):
                clean[key] = value
            elif isinstance(value, list):
                clean[key] = json.dumps(value)
            elif value is not None:
                clean[key] = str(value)
        return clean

    def clear_collection_cache(self):
        """Clear the collection cache to free resources."""
        self._collection_cache.clear()
        logger.info("Collection cache cleared")

    async def switch_collection(self, db_name: str) -> bool:
        """Switch to a different vector database by name."""
        if self._switch_lock is None:
            self._switch_lock = asyncio.Lock()

        async with self._switch_lock:
            logger.info("Switching to vector database: %s", db_name)

            chroma_base = Path(settings.CHROMA_DB_DIRECTORY)
            db_path = chroma_base / db_name

            if not db_path.exists():
                logger.error("Vector database not found: %s", db_path)
                return False

            try:
                success = await asyncio.to_thread(
                    self._switch_collection_sync, db_name, str(db_path)
                )
                return success
            except (RuntimeError, OSError, ValueError) as e:
                logger.error("Failed to switch to '%s': %s", db_name, e)
                self._is_loaded = False
                return False

    def _switch_collection_sync(self, db_name: str, db_path: str) -> bool:
        """Synchronous implementation of collection switch."""
        self._default_client = None
        self._default_collection = None
        self._is_loaded = False
        self._collection_cache.clear()

        logger.info("Loading vector store from: %s", db_path)
        self._default_client = chromadb.PersistentClient(path=db_path)
        self._default_collection = self._default_client.get_collection(
            name=settings.CHROMA_COLLECTION_NAME
        )
        self._is_loaded = True
        self._current_db_name = db_name

        doc_count = self._default_collection.count()
        logger.info("Switched to '%s', documents: %d", db_name, doc_count)
        return True

    def unload(self):
        """Unload all vector stores and clear cache"""
        self._default_client = None
        self._default_collection = None
        self._is_loaded = False
        self._collection_cache.clear()
        logger.info("Vector store unloaded")


# Singleton instance
vectorstore_manager = VectorStoreManager()
