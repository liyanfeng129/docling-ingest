"""
Reranker Model Manager
Handles loading and managing CrossEncoder reranking models.
"""

import importlib
import logging
from typing import Optional, List

from sentence_transformers import CrossEncoder

from config.settings import settings
from models.vectorstore import Document

logger = logging.getLogger(__name__)


class RerankerManager:
    """Manages reranker model lifecycle with lazy loading."""

    _instance: Optional["RerankerManager"] = None
    _reranker: Optional[CrossEncoder] = None
    _is_loaded: bool = False
    _model_name: Optional[str] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._reranker = None
            self._is_loaded = False
            self._model_name = None

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

    def load(self, model_name: Optional[str] = None) -> bool:
        """Load reranker model if not already loaded."""
        target_model = model_name or settings.RERANKER_MODEL

        if self._is_loaded and self._reranker is not None and self._model_name == target_model:
            logger.info("Reranker model already loaded: %s", target_model)
            return True

        try:
            logger.info("Loading reranker model: %s", target_model)
            device = self._resolve_device(settings.EMBEDDING_DEVICE)
            logger.info("Using reranker device: %s", device)

            self._reranker = CrossEncoder(target_model, device=device)
            self._is_loaded = True
            self._model_name = target_model

            logger.info("Reranker model loaded successfully")
            return True
        except (RuntimeError, OSError, ValueError) as e:
            logger.error("Failed to load reranker model: %s", e)
            self._is_loaded = False
            self._reranker = None
            self._model_name = None
            return False

    def reload(self, model_name: Optional[str] = None) -> bool:
        """Force reload reranker model."""
        self.unload()
        return self.load(model_name=model_name)

    def rerank(self, query: str, documents: List[Document], top_k: int = 3) -> List[Document]:
        """Rerank documents by relevance score for a query."""
        if not documents:
            return []

        model_name = settings.RERANKER_MODEL
        if not self._is_loaded or self._reranker is None or self._model_name != model_name:
            if not self.load(model_name=model_name):
                raise RuntimeError("Reranker model could not be loaded")

        top_k = max(1, min(top_k, len(documents)))
        sentence_pairs = [(query, doc.page_content) for doc in documents]
        scores = self._reranker.predict(sentence_pairs)

        scored_documents = []
        for document, score in zip(documents, scores):
            updated_metadata = dict(document.metadata or {})
            updated_metadata["rerank_score"] = float(score)
            scored_documents.append(
                Document(page_content=document.page_content, metadata=updated_metadata)
            )

        scored_documents.sort(
            key=lambda doc: doc.metadata.get("rerank_score", float("-inf")),
            reverse=True,
        )
        return scored_documents[:top_k]

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    @property
    def model_name(self) -> Optional[str]:
        return self._model_name

    def unload(self):
        self._reranker = None
        self._is_loaded = False
        self._model_name = None
        logger.info("Reranker model unloaded")


reranker_manager = RerankerManager()
