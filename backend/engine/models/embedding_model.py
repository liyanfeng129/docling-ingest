"""
Embedding Model Manager
Handles loading and managing the embedding model for vector representations
"""

import logging
from typing import Optional, List
from sentence_transformers import SentenceTransformer
from torch import Tensor
import importlib
from config.settings import settings

logger = logging.getLogger(__name__)


class EmbeddingManager:
    """Manages the embedding model lifecycle"""

    _instance: Optional["EmbeddingManager"] = None
    _embeddings: Optional[SentenceTransformer] = None
    _is_loaded: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._embeddings = None
            self._is_loaded = False

    def load(self) -> bool:
        """Load the embedding model"""
        if self._is_loaded:
            logger.info("Embedding model already loaded")
            return True

        try:
            logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
            device = self._resolve_device(settings.EMBEDDING_DEVICE)
            logger.info("Using embedding device: %s", device)
            self._embeddings = SentenceTransformer(
                model_name_or_path=settings.EMBEDDING_MODEL,
                device=device,
                similarity_fn_name="cosine",
            )

            # Warm up the model with a test embedding
            _ = self._embeddings.encode("test")

            self._is_loaded = True
            logger.info("Embedding model loaded successfully")
            return True

        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load embedding model: %s", e)
            self._is_loaded = False
            return False

    def _resolve_device(self, preferred: Optional[str]) -> str:
        """Resolve the actual device to use based on system capabilities."""
        pref = (preferred or "auto").strip().lower()
        try:
            torch = importlib.import_module("torch")
        except Exception as e:
            logger.warning("Torch not available; defaulting to cpu (%s)", e)
            return "cpu"

        def has_mps() -> bool:
            return (
                hasattr(torch, "backends")
                and hasattr(torch.backends, "mps")
                and torch.backends.mps.is_available()
            )

        if pref == "auto":
            if torch.cuda.is_available():
                return "cuda"
            if has_mps():
                return "mps"
            return "cpu"

        if pref == "cuda":
            if torch.cuda.is_available():
                return "cuda"
            logger.warning("CUDA requested but not available; falling back to auto detection")
            return self._resolve_device("auto")

        if pref == "mps":
            if has_mps():
                return "mps"
            logger.warning("MPS requested but not available; falling back to auto detection")
            return self._resolve_device("auto")

        if pref == "cpu":
            return "cpu"

        logger.warning("Unknown device '%s'; falling back to auto", preferred)
        return self._resolve_device("auto")

    def embed_query(self, text: str) -> List[float]:
        """Generate embedding for a single query text."""
        if not self._is_loaded or self._embeddings is None:
            raise RuntimeError("Embedding model not loaded")
        return self._embeddings.encode(text, normalize_embeddings=True).tolist()

    def embed_documents(self, texts: List[str], batch_size: int = 32, show_progress: bool = True) -> List[List[float]]:
        """Generate embeddings for multiple texts in batches."""
        if not self._is_loaded or self._embeddings is None:
            raise RuntimeError("Embedding model not loaded")

        if not texts:
            return []

        # Sanitize: remove None entries and ensure all values are strings
        safe_texts = [str(t) for t in texts if t is not None]
        if len(safe_texts) != len(texts):
            logger.warning(
                "embed_documents: dropped %d None/invalid entries before encoding",
                len(texts) - len(safe_texts)
            )
        texts = safe_texts

        if not texts:
            return []

        logger.info("Embedding %d documents in batches of %d", len(texts), batch_size)

        embeddings = self._embeddings.encode(
            texts,
            batch_size=batch_size,
            normalize_embeddings=True,
            show_progress_bar=show_progress
        )

        return [emb.tolist() for emb in embeddings]

    def get_embeddings(self) -> SentenceTransformer:
        """Get the loaded embedding model"""
        if not self._is_loaded or self._embeddings is None:
            raise RuntimeError("Embedding model not loaded. Call load() first.")
        return self._embeddings

    @property
    def is_loaded(self) -> bool:
        """Check if embedding model is loaded"""
        return self._is_loaded

    def unload(self):
        """Unload the embedding model to free memory"""
        self._embeddings = None
        self._is_loaded = False
        logger.info("Embedding model unloaded")


# Singleton instance
embedding_manager = EmbeddingManager()
