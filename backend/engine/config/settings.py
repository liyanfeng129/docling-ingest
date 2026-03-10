"""
Docling Ingest Engine - Configuration Settings
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True

    # Ollama Configuration (for optional vision model)
    OLLAMA_BASE_URL: str = "http://ollama:11434"
    OLLAMA_VISION_MODEL: str = "granite3.2-vision:2b"

    # Vision model toggle (disabled by default to reduce dependencies)
    ENABLE_VISION_MODEL: bool = False

    # Embedding Configuration
    EMBEDDING_MODEL: str = "Snowflake/snowflake-arctic-embed-l-v2.0"
    # Device selection: "auto" (recommended), "cuda", "mps" (Apple Silicon), or "cpu"
    EMBEDDING_DEVICE: str = "auto"

    # ChromaDB Configuration
    CHROMA_DB_DIRECTORY: str = "./resources/chroma_db"
    CHROMA_PERSIST_DIRECTORY: str = "./resources/chroma_db/default"
    CHROMA_COLLECTION_NAME: str = "documents"

    # Chunking Configuration
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 300

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Singleton instance
settings = Settings()
