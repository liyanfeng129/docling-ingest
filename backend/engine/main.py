"""
Docling Ingest - Document Processing Engine
Main FastAPI application entry point

This server handles:
- PDF document conversion using Docling
- Embedding generation with Sentence Transformers
- ChromaDB vector store management
- Optional vision model for image descriptions
"""
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from config.settings import settings
from routes.ingestion_routes import router as ingestion_router
from services.startup_service import startup_service

# Add the engine directory to the path for imports
sys.path.insert(0, ".")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("=" * 60)
    logger.info("Docling Ingest Engine Starting...")
    logger.info("=" * 60)

    try:
        def progress_callback(message: str, progress: int):
            logger.info("[%d%%] %s", progress, message)

        await startup_service.initialize_all(progress_callback=progress_callback)

        logger.info("=" * 60)
        logger.info("Engine is ready to accept requests!")
        logger.info("API available at: http://%s:%s", settings.HOST, settings.PORT)
        logger.info("=" * 60)

    except (RuntimeError, OSError, ValueError) as e:
        logger.error("Failed to initialize components: %s", e)
        logger.error("Server will start but some endpoints may not be available")

    yield

    # Shutdown
    logger.info("Shutting down Engine...")
    startup_service.shutdown()
    logger.info("Engine shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Docling Ingest Engine",
    description="""
    Document processing engine for Docling Ingest.

    This server provides:
    - PDF/document conversion using Docling
    - Vector store management with ChromaDB
    - Embedding generation with Sentence Transformers
    - Optional vision model for image descriptions
    """,
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving images from resources folder
resources_path = Path(__file__).parent / "docling" / "output" / "resources"
if resources_path.exists():
    app.mount("/docling-resources", StaticFiles(directory=str(resources_path)), name="docling_resources")
    logger.info("Serving docling images from: %s", resources_path)

# Mount static files for permanent image storage (after ingestion)
permanent_images_path = Path(__file__).parent / "resources" / "pictures"
permanent_images_path.mkdir(parents=True, exist_ok=True)
app.mount("/resources/pictures", StaticFiles(directory=str(permanent_images_path)), name="permanent_images")
logger.info("Serving permanent images from: %s", permanent_images_path)

# Mount static files for extracted document images (temporary, for editing)
static_images_path = Path(__file__).parent / "static" / "images"
static_images_path.mkdir(parents=True, exist_ok=True)
app.mount("/static/images", StaticFiles(directory=str(static_images_path)), name="static_images")
logger.info("Serving document images from: %s", static_images_path)

# Include routers
app.include_router(ingestion_router)


@app.get("/")
async def root():
    """Root endpoint with basic server information"""
    return {
        "name": "Docling Ingest Engine",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "ingestion": {
                "config": "/api/ingestion/config",
                "collections": "/api/ingestion/collections",
                "convert": "/api/ingestion/convert",
                "ingest": "/api/ingestion/ingest",
                "helpers": "/api/ingestion/helper/{helper_id}",
                "strategies": "/api/ingestion/strategy/{strategy_id}",
            },
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Engine is ready"}


def main():
    """Main entry point to run the server"""
    logger.info("Starting server on %s:%s", settings.HOST, settings.PORT)
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )


if __name__ == "__main__":
    main()
