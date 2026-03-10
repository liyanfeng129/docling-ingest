"""
Startup Service
Handles the initialization of all components on server startup.

Only loads ingestion-related components:
- Docling PDF converter
- Embedding model
- Vector store
- Vision model (optional, controlled by ENABLE_VISION_MODEL)
"""

import asyncio
import logging
from typing import Callable, List, Optional

from models.embedding_model import embedding_manager
from models.vectorstore import vectorstore_manager
from services.docling_service import DoclingService
from config.settings import settings

logger = logging.getLogger(__name__)


class StartupService:
    """Manages the startup sequence for all components"""

    def __init__(self):
        self._is_loaded = False
        self._loading_progress: List[str] = []
        self._docling_service: Optional[DoclingService] = None

    async def initialize_all(
        self, progress_callback: Optional[Callable[[str, int], None]] = None
    ) -> bool:
        """Initialize all components in the correct order."""
        steps = [
            ("Loading Docling PDF converter...", self._load_docling, 20),
            ("Loading embedding model...", self._load_embeddings, 50),
            ("Loading vector store...", self._load_vectorstore, 75),
        ]

        # Only load vision model if enabled
        if settings.ENABLE_VISION_MODEL:
            steps.append(("Loading Vision LLM (Ollama)...", self._load_vllm, 100))
        else:
            logger.info("Vision model disabled (set ENABLE_VISION_MODEL=true to enable)")

        try:
            for message, loader, progress in steps:
                logger.info(message)
                self._loading_progress.append(message)

                if progress_callback:
                    progress_callback(message, progress)

                await loader()

            self._is_loaded = True
            logger.info("All components initialized successfully!")
            return True

        except Exception as e:
            logger.error("Failed to initialize components: %s", e)
            self._is_loaded = False
            raise

    async def _load_docling(self):
        """Load the Docling PDF converter"""
        self._docling_service = await asyncio.to_thread(DoclingService)
        logger.info("Docling PDF converter initialized")

    async def _load_embeddings(self):
        """Load the embedding model"""
        await asyncio.to_thread(embedding_manager.load)

    async def _load_vectorstore(self):
        """Load the vector store (non-fatal if no default collection exists)"""
        result = await vectorstore_manager.load()
        if not result:
            logger.warning(
                "Default vector store not loaded. "
                "Ingestion endpoints are still available."
            )

    async def _load_vllm(self):
        """Load the Ollama Vision LLM for image understanding"""
        from models.vllm_model import vllm_manager
        await vllm_manager.load()

    def get_status(self) -> dict:
        """Get the current status of all components"""
        from models.vllm_model import vllm_manager

        return {
            "is_loaded": self._is_loaded,
            "components": {
                "docling": self._docling_service is not None,
                "embedding_model": embedding_manager.is_loaded,
                "vectorstore": vectorstore_manager.is_loaded,
                "vllm": vllm_manager.is_loaded if settings.ENABLE_VISION_MODEL else "disabled",
            },
            "loading_progress": self._loading_progress,
        }

    @property
    def is_loaded(self) -> bool:
        """Return whether all components are loaded."""
        return self._is_loaded

    def shutdown(self):
        """Cleanup and shutdown all components"""
        logger.info("Shutting down components...")

        if settings.ENABLE_VISION_MODEL:
            from models.vllm_model import vllm_manager
            vllm_manager.unload()

        vectorstore_manager.unload()
        embedding_manager.unload()

        self._is_loaded = False
        self._loading_progress = []
        logger.info("All components shut down")


# Singleton instance
startup_service = StartupService()
