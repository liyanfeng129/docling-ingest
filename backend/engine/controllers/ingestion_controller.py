"""
Ingestion Controller

Handles business logic for:
- Document conversion via Docling
- ChromaDB collection management
- AI helper functions (vision)
- AI strategy functions (semantic chunking)
- Vector embedding and storage
"""
import logging
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

from config.settings import settings
from services.docling_service import DoclingService

logger = logging.getLogger(__name__)


class IngestionController:
    """Controller for ingestion operations."""

    # =========================================================================
    # Collection Management
    # =========================================================================

    async def get_collections(self) -> List[Dict[str, Any]]:
        """Get all available ChromaDB collections."""
        from models.vectorstore import vectorstore_manager

        try:
            collections = await vectorstore_manager.list_collections()
            return collections
        except Exception as e:
            logger.error("Failed to get collections: %s", e)
            raise

    async def create_collection(
        self,
        name: str,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new ChromaDB collection."""
        from models.vectorstore import vectorstore_manager

        try:
            result = await vectorstore_manager.create_collection(
                collection_id=name,
                description=description
            )
            return result
        except Exception as e:
            logger.error("Failed to create collection: %s", e)
            raise

    # =========================================================================
    # Document Conversion
    # =========================================================================

    async def convert_document(
        self,
        file_content: bytes,
        filename: str,
        content_type: str,
        config: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Convert a document using Docling."""
        temp_file_path = None

        try:
            start_time = time.time()
            logger.info("[DoclingConversion] Starting conversion: %s (%d bytes)", filename, len(file_content))

            supported_types = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]
            if content_type not in supported_types:
                raise ValueError(f"Unsupported content type: {content_type}. Supported: {supported_types}")

            ext_map = {
                "application/pdf": ".pdf",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
            }
            extension = ext_map.get(content_type, ".pdf")

            temp_dir = Path(tempfile.gettempdir()) / "docling_uploads"
            temp_dir.mkdir(parents=True, exist_ok=True)

            temp_file_path = temp_dir / f"upload_{int(time.time() * 1000)}{extension}"
            temp_file_path.write_bytes(file_content)
            logger.info("[DoclingConversion] Saved temp file: %s", temp_file_path)

            docling_service = DoclingService()
            docling_json = docling_service.convert_pdf(temp_file_path, verbose=True)

            conversion_time = time.time() - start_time
            logger.info("[DoclingConversion] Docling conversion completed in %.2fs", conversion_time)

            import uuid
            document_id = f"doc_{uuid.uuid4().hex[:8]}"

            parse_start = time.time()
            include_furniture = config.get("includeFurniture", False) if config else False
            save_images_to_disk = config.get("saveImagesToDisk", True) if config else True

            frontend_content = docling_service.parse_to_ingestion_page(
                docling_json,
                include_furniture=include_furniture,
                document_id=document_id,
                save_images_to_disk=save_images_to_disk
            )

            frontend_content["filename"] = filename

            parse_time = time.time() - parse_start
            total_time = time.time() - start_time

            logger.info(
                "[DoclingConversion] Complete: %s | Pages: %d | "
                "Conversion: %.2fs | Parse: %.2fs | Total: %.2fs",
                filename, frontend_content['totalPages'],
                conversion_time, parse_time, total_time
            )

            return {
                "success": True,
                "filename": filename,
                "content": frontend_content,
                "timing": {
                    "conversionSeconds": round(conversion_time, 2),
                    "parseSeconds": round(parse_time, 2),
                    "totalSeconds": round(total_time, 2),
                }
            }

        except Exception as e:
            logger.error("[DoclingConversion] Failed to convert document: %s", e, exc_info=True)
            raise

        finally:
            if temp_file_path and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                    logger.debug("[DoclingConversion] Cleaned up temp file: %s", temp_file_path)
                except Exception as cleanup_error:
                    logger.warning("[DoclingConversion] Failed to clean up temp file: %s", cleanup_error)

    # =========================================================================
    # Ingestion
    # =========================================================================

    async def ingest_documents(
        self,
        collection_id: str,
        documents: List[Dict],
        strategy: str
    ) -> Dict[str, Any]:
        """Ingest documents into a ChromaDB collection."""
        from models.vectorstore import vectorstore_manager
        from services.image_storage_service import image_storage_service

        try:
            total_images = sum(
                len(doc.get('metadata', {}).get('images', []))
                for doc in documents
            )

            if total_images > 0:
                logger.info("[Ingest] Processing %d images for permanent storage...", total_images)
                documents, url_mapping = image_storage_service.process_documents_for_ingestion(documents)
                logger.info("[Ingest] Migrated %d unique images to permanent storage", len(url_mapping))

            result = await vectorstore_manager.ingest(
                collection_id=collection_id,
                documents=documents,
                strategy=strategy,
                batch_size=32
            )

            if total_images > 0:
                result["totalImages"] = total_images
                result["migratedImages"] = len(url_mapping) if total_images > 0 else 0

            # Switch active collection to the one we just ingested into
            logger.info("[Ingest] Switching active vector store to '%s'...", collection_id)
            switch_success = await vectorstore_manager.switch_collection(collection_id)
            if switch_success:
                doc_count = vectorstore_manager._default_collection.count() if vectorstore_manager._default_collection else 0
                logger.info("[Ingest] Active vector store switched to '%s' with %d documents", collection_id, doc_count)
            else:
                logger.warning("[Ingest] Could not switch to '%s'", collection_id)

            return result

        except Exception as e:
            logger.error("[Ingest] Failed to ingest documents: %s", e, exc_info=True)
            raise

    # =========================================================================
    # AI Helpers
    # =========================================================================

    async def generate_image_descriptions(
        self,
        document_id: str,
        images: List[Dict]
    ) -> Dict[str, Any]:
        """Generate AI descriptions for images using vision model."""
        from models.vllm_model import vllm_manager

        try:
            logger.info("Generating descriptions for %d images in document %s", len(images), document_id)

            if not vllm_manager.is_loaded:
                try:
                    await vllm_manager.load()
                except Exception as e:
                    logger.warning("Vision model not available, using mock: %s", e)

            batch_images = []
            skipped_count = 0
            for img in images:
                classification = img.get("classification", "unclassified")
                page_num = img.get("pageNumber", "unknown")
                image_url = img.get("imageUrl", "")

                if not image_url:
                    logger.warning("Skipping image %s: no imageUrl provided", img['id'])
                    skipped_count += 1
                    continue

                prompt = self._get_description_prompt(classification, page_num)

                batch_images.append({
                    "id": img["id"],
                    "image": image_url,
                    "prompt": prompt,
                    "context": f"Document: {document_id}, Page: {page_num}, Classification: {classification}"
                })

            if skipped_count > 0:
                logger.info("Skipped %d images without URLs", skipped_count)

            if not batch_images:
                logger.warning("No images with URLs to process")
                return {
                    "success": True,
                    "descriptions": [],
                    "message": "No images with URLs to process",
                }

            results = await vllm_manager.describe_images_batch(
                batch_images,
                default_prompt="Describe this image from a document briefly and concisely."
            )

            descriptions = []
            for i, result in enumerate(results):
                img = images[i]
                descriptions.append({
                    "imageId": result["id"],
                    "classification": img.get("classification", "unclassified"),
                    "description": result.get("description", ""),
                    "error": result.get("error") if result.get("error") else None,
                })

            success_count = sum(1 for d in descriptions if d["description"] and not d.get("error"))

            return {
                "success": True,
                "descriptions": descriptions,
                "message": f"Generated descriptions for {success_count}/{len(descriptions)} image(s)",
            }
        except Exception as e:
            logger.error("Failed to generate image descriptions: %s", e)
            logger.info("Falling back to mock descriptions")
            return self._generate_default_descriptions(images)

    async def generate_image_descriptions_stream(
        self,
        document_id: str,
        images: List[Dict]
    ):
        """Stream AI descriptions for images using vision model."""
        from models.vllm_model import vllm_manager

        logger.info("Streaming descriptions for %d images in document %s", len(images), document_id)

        if not vllm_manager.is_loaded:
            try:
                await vllm_manager.load()
            except Exception as e:
                logger.warning("Vision model not available: %s", e)
                for img in images:
                    classification = img.get("classification", "unclassified")
                    page_num = img.get("pageNumber", "unknown")
                    yield {
                        "imageId": img["id"],
                        "classification": classification,
                        "description": self._get_default_description(classification, page_num),
                    }
                return

        for img in images:
            classification = img.get("classification", "unclassified")
            page_num = img.get("pageNumber", "unknown")
            image_url = img.get("imageUrl", "")

            if not image_url:
                logger.warning("Skipping image %s: no imageUrl provided", img['id'])
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "error": "No image URL provided",
                }
                continue

            prompt = self._get_description_prompt(classification, page_num)

            try:
                description = await vllm_manager.describe_image(
                    image=image_url,
                    prompt=prompt,
                    context=f"Document: {document_id}, Page: {page_num}, Classification: {classification}"
                )
                logger.info("Generated description for image %s", img['id'])
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "description": description,
                }
            except Exception as e:
                logger.error("Failed to describe image %s: %s", img['id'], e)
                yield {
                    "imageId": img["id"],
                    "classification": classification,
                    "error": str(e),
                }

    def _generate_default_descriptions(self, images: List[Dict]) -> Dict[str, Any]:
        """Generate default descriptions when vision model is unavailable"""
        descriptions = []
        for img in images:
            classification = img.get("classification", "unclassified")
            page_num = img.get("pageNumber", "unknown")
            desc = self._get_default_description(classification, page_num)
            descriptions.append({
                "imageId": img["id"],
                "classification": classification,
                "description": desc,
            })
        return {
            "success": True,
            "descriptions": descriptions,
            "message": f"Generated mock descriptions for {len(descriptions)} image(s) (vision model unavailable)",
        }

    def _get_description_prompt(self, classification: str, page_num: Any) -> str:
        """Get classification-aware prompt for the vision model"""
        prompts = {
            "logo": "Describe this logo briefly. What can you see and which company might it belong to?",
            "icon": "What does this icon show? Describe its meaning in the context of a software manual.",
            "bar_chart": "Describe this bar chart. What data is being presented?",
            "line_chart": "Describe this line chart. What trends are visible?",
            "pie_chart": "Describe this pie chart. What distribution is shown?",
            "flow_chart": "Describe this flow chart. What process or workflow is illustrated?",
            "screenshot_from_computer": "Describe this software screenshot. What elements are visible and what can the user do here?",
            "screenshot_from_manual": "Describe this screenshot from a manual. What steps or features are shown?",
            "photograph": "Describe this photograph briefly.",
            "table": "Describe this table. What data does it contain?",
            "diagram": "Describe this diagram. What structure or relationships are shown?",
        }
        base_prompt = prompts.get(classification, "Describe this image from a document.")
        return f"{base_prompt} The image is from page {page_num}."

    def _get_default_description(self, classification: str, page_num: Any) -> str:
        """Get default description based on classification"""
        prompts = {
            "logo": "This appears to be a company or brand logo.",
            "icon": "This is a small symbolic icon used for visual emphasis.",
            "bar_chart": "This is a bar chart presenting data with rectangular bars.",
            "line_chart": "This is a line chart showing trends over time or categories.",
            "pie_chart": "This is a pie chart showing proportional data distribution.",
            "flow_chart": "This is a flow chart illustrating a process or workflow.",
            "screenshot_from_computer": "This is a screenshot showing a software interface.",
            "screenshot_from_manual": "This is a screenshot from documentation or a manual.",
            "photograph": "This is a photograph capturing a real-world scene.",
            "table": "This is an image of a table containing structured data.",
            "diagram": "This is a diagram illustrating relationships or structures.",
        }
        base = prompts.get(classification, "This is a visual element from the document.")
        return f"{base} Found on page {page_num}. [default - vision model unavailable]"

    async def run_helper(self, helper_id: str, request: Dict) -> Dict[str, Any]:
        """Run a generic AI helper function."""
        try:
            if helper_id == "ai_image_descriptions":
                return await self.generate_image_descriptions(
                    document_id=request.get("documentId"),
                    images=request.get("images", [])
                )
            elif helper_id == "ai_summarize_page":
                return {
                    "success": False,
                    "error": "Helper 'ai_summarize_page' not yet implemented",
                }
            else:
                return {
                    "success": False,
                    "error": f"Unknown helper: {helper_id}",
                }
        except Exception as e:
            logger.error("Failed to run helper %s: %s", helper_id, e)
            raise

    # =========================================================================
    # AI Strategies
    # =========================================================================

    async def run_strategy(
        self,
        strategy_id: str,
        document_state: Dict,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Run a remote AI strategy for semantic chunking."""
        try:
            if strategy_id == "semantic_sections":
                return await self._run_semantic_sections(document_state, options)
            else:
                return {
                    "success": False,
                    "error": f"Unknown strategy: {strategy_id}",
                }
        except Exception as e:
            logger.error("Failed to run strategy %s: %s", strategy_id, e)
            raise

    async def _run_semantic_sections(
        self,
        document_state: Dict,
        options: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Run semantic sections strategy (placeholder)."""
        logger.info("[MOCK] Running semantic sections strategy")

        filename = document_state.get("filename", "document")
        total_pages = document_state.get("totalPages", 0)

        return {
            "success": True,
            "strategy": "semantic_sections",
            "preview": {
                "source": filename,
                "strategy": "semantic_sections",
                "total_embeddings": 2,
                "documents": [
                    {
                        "id": "section_intro",
                        "content": "Introduction section content...",
                        "metadata": {
                            "section_type": "introduction",
                            "semantic_topic": "overview",
                            "page_range": [1, 1],
                            "confidence": 0.92,
                        },
                    },
                    {
                        "id": "section_main",
                        "content": "Main content section...",
                        "metadata": {
                            "section_type": "body",
                            "semantic_topic": "main_content",
                            "page_range": [2, total_pages],
                            "confidence": 0.88,
                        },
                    },
                ],
            },
            "message": "[MOCK] Semantic sections strategy - replace with actual LLM implementation",
        }


# Singleton instance
ingestion_controller = IngestionController()
