"""
Image Storage Service - Permanent storage for ingested document images.

This service handles moving images from temporary storage (static/images/)
to permanent storage (resources/pictures/) during document ingestion.
"""

import logging
import shutil
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class ImageStorageService:
    """Service for managing permanent image storage."""

    BASE_DIR = Path(__file__).parent.parent
    TEMP_IMAGES_DIR = BASE_DIR / "static" / "images"
    PERMANENT_IMAGES_DIR = BASE_DIR / "resources" / "pictures"
    STORAGE_PATH_PREFIX = "resources/pictures"

    def __init__(self):
        self.PERMANENT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    def migrate_image_to_permanent_storage(self, temp_image_url: str) -> Optional[str]:
        """Copy an image from temporary to permanent storage."""
        try:
            if not temp_image_url or not temp_image_url.startswith("/static/images/"):
                logger.warning("Invalid temp image URL: %s", temp_image_url)
                return None

            relative_path = temp_image_url.replace("/static/images/", "")
            temp_file_path = self.TEMP_IMAGES_DIR / relative_path

            if not temp_file_path.exists():
                logger.warning("Temp image file not found: %s", temp_file_path)
                return None

            image_uuid = str(uuid.uuid4())
            extension = temp_file_path.suffix.lower() or ".png"
            permanent_filename = f"{image_uuid}{extension}"
            permanent_file_path = self.PERMANENT_IMAGES_DIR / permanent_filename

            shutil.copy2(temp_file_path, permanent_file_path)

            permanent_url = f"{self.STORAGE_PATH_PREFIX}/{permanent_filename}"
            logger.info("Migrated image: %s -> %s", temp_image_url, permanent_url)
            return permanent_url

        except Exception as e:
            logger.error("Failed to migrate image %s: %s", temp_image_url, e)
            return None

    def process_documents_for_ingestion(
        self,
        documents: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
        """Process all documents before ingestion, migrating images to permanent storage."""
        url_mapping: Dict[str, str] = {}
        processed_count = 0
        skipped_count = 0

        for doc in documents:
            metadata = doc.get('metadata', {})
            images = metadata.get('images', [])

            if not images:
                continue

            for image in images:
                old_url = image.get('imageUrl', '')

                if not old_url:
                    skipped_count += 1
                    continue

                if old_url.startswith(self.STORAGE_PATH_PREFIX):
                    logger.debug("Image already in permanent storage: %s", old_url)
                    continue

                if old_url in url_mapping:
                    image['imageUrl'] = url_mapping[old_url]
                    processed_count += 1
                    continue

                new_url = self.migrate_image_to_permanent_storage(old_url)

                if new_url:
                    url_mapping[old_url] = new_url
                    image['imageUrl'] = new_url
                    processed_count += 1
                else:
                    logger.warning("Keeping original URL due to migration failure: %s", old_url)
                    skipped_count += 1

        logger.info(
            "[ImageStorage] Processed %d images, skipped %d, migrated %d unique files",
            processed_count, skipped_count, len(url_mapping)
        )

        return documents, url_mapping

    def get_serving_url(self, storage_path: str, storage_backend: str = "local") -> str:
        """Convert storage-agnostic path to full serving URL."""
        return f"/{storage_path}"


# Singleton instance
image_storage_service = ImageStorageService()
