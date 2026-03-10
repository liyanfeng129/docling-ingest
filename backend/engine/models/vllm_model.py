"""
Vision LLM Model Manager
Handles Ollama Vision LLM for image understanding tasks.
"""

import base64
import logging
from typing import Optional, AsyncIterator, Dict, Any, List, Union
from pathlib import Path

from ollama import AsyncClient, ResponseError

from config.settings import settings

logger = logging.getLogger(__name__)

# Default vision model
VISION_MODEL = getattr(settings, 'OLLAMA_VISION_MODEL', 'granite3.2-vision:2b')

VISION_SYSTEM_PROMPT = """You are an image analysis assistant for document processing.
Your task is to describe images from documents to help users understand the content.

INSTRUCTIONS:
1. Describe what you see in the image clearly and concisely.
2. Focus on UI elements, buttons, menus, forms, and visible text.
3. For software screenshots, describe the workflow or action being shown.
4. Keep descriptions factual and helpful for someone learning from the document.
5. Respond in English.

IMPORTANT:
- Be specific about button labels, menu items, and form fields.
- Describe the layout and navigation elements.
- If content is highlighted or circled, emphasize those elements.
- Keep descriptions under 200 words unless more detail is required."""


class VisionLLMManager:
    """Manages the Ollama Vision LLM lifecycle for image understanding"""

    _instance: Optional["VisionLLMManager"] = None
    _client: Optional[AsyncClient] = None
    _is_loaded: bool = False
    _model_params: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not hasattr(self, "_initialized"):
            self._initialized = True
            self._is_loaded = False
            self._model = VISION_MODEL
            self._model_params = {
                "temperature": 0.2,
                "num_ctx": 8192,
                "repeat_penalty": 1.1,
                "num_predict": 1024,
            }

    async def load(self) -> bool:
        """Load the Ollama Vision LLM"""
        if self._is_loaded:
            logger.info("Vision LLM already loaded")
            return True

        try:
            logger.info("Loading Ollama Vision LLM: %s", self._model)
            self._client = AsyncClient(host=settings.OLLAMA_BASE_URL)

            try:
                await self._client.show(self._model)
                logger.info("Vision LLM (%s) verified and ready", self._model)
            except ResponseError as e:
                if e.status_code == 404:
                    logger.warning(
                        "Vision model '%s' not found. Please run 'ollama pull %s'",
                        self._model, self._model
                    )
                else:
                    raise

            self._is_loaded = True
            return True

        except ResponseError as e:
            logger.error("Ollama API Error: %s", e)
            self._is_loaded = False
            return False
        except Exception as e:
            logger.error("Failed to connect to Ollama for Vision LLM: %s", e)
            self._is_loaded = False
            return False

    def get_client(self) -> AsyncClient:
        """Get the Ollama client"""
        if not self._is_loaded or self._client is None:
            raise RuntimeError("Vision LLM not loaded. Call load() first.")
        return self._client

    def _encode_image(self, image_source: Union[str, bytes, Path]) -> str:
        """Encode an image to base64 for the vision model."""
        if isinstance(image_source, bytes):
            return base64.b64encode(image_source).decode('utf-8')

        if isinstance(image_source, Path):
            image_source = str(image_source)

        if isinstance(image_source, str):
            if image_source.startswith('data:image'):
                return image_source.split(',', 1)[1]

            if image_source.startswith('/static/images/'):
                relative_path = image_source[len('/static/images/'):]
                base_path = Path(__file__).parent.parent / "static" / "images"
                file_path = base_path / relative_path
                if file_path.exists():
                    with open(file_path, 'rb') as f:
                        return base64.b64encode(f.read()).decode('utf-8')
                else:
                    raise ValueError(f"Static image not found: {file_path}")

            if Path(image_source).exists():
                with open(image_source, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf-8')

            if '/' not in image_source and '\\' not in image_source and len(image_source) > 100:
                return image_source

            raise ValueError(f"Image not found or unsupported format: {image_source}")

        raise ValueError(f"Unsupported image source type: {type(image_source)}")

    async def describe_image(
        self,
        image: Union[str, bytes, Path],
        prompt: str = "Describe this image briefly and concisely.",
        context: Optional[str] = None
    ) -> str:
        """Generate a description for an image."""
        client = self.get_client()

        try:
            image_b64 = self._encode_image(image)

            user_content = prompt
            if context:
                user_content = f"Context: {context}\n\n{prompt}"

            response = await client.chat(
                model=self._model,
                messages=[
                    {"role": "system", "content": VISION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": user_content,
                        "images": [image_b64],
                    },
                ],
                options=self._model_params,
                stream=False,
            )

            content = response["message"]["content"] or ''
            return content.strip()

        except Exception as e:
            logger.error("Error during Vision LLM generation: %s", e)
            raise

    async def describe_images_batch(
        self,
        images: List[Dict[str, Any]],
        default_prompt: str = "Describe this image from a document briefly and concisely."
    ) -> List[Dict[str, str]]:
        """Generate descriptions for multiple images."""
        results = []

        for img_data in images:
            img_id = img_data.get('id', 'unknown')
            image = img_data.get('image') or img_data.get('imageUrl')
            prompt = img_data.get('prompt', default_prompt)
            context = img_data.get('context')

            if not image:
                logger.warning("Skipping image %s: no image data provided", img_id)
                results.append({
                    'id': img_id,
                    'description': '',
                    'error': 'No image data provided'
                })
                continue

            try:
                description = await self.describe_image(image, prompt, context)
                results.append({
                    'id': img_id,
                    'description': description
                })
                logger.info("Generated description for image %s", img_id)
            except Exception as e:
                logger.error("Failed to describe image %s: %s", img_id, e)
                results.append({
                    'id': img_id,
                    'description': '',
                    'error': str(e)
                })

        return results

    async def stream_describe_image(
        self,
        image: Union[str, bytes, Path],
        prompt: str = "Describe this image briefly and concisely.",
        context: Optional[str] = None
    ) -> AsyncIterator[str]:
        """Stream generate a description for an image."""
        client = self.get_client()

        try:
            image_b64 = self._encode_image(image)

            user_content = prompt
            if context:
                user_content = f"Context: {context}\n\n{prompt}"

            async for chunk in await client.chat(
                model=self._model,
                messages=[
                    {"role": "system", "content": VISION_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": user_content,
                        "images": [image_b64],
                    },
                ],
                options=self._model_params,
                stream=True,
            ):
                yield chunk["message"]["content"]

        except Exception as e:
            logger.error("Error during Vision LLM streaming: %s", e)
            raise

    async def classify_image(
        self,
        image: Union[str, bytes, Path],
        categories: List[str]
    ) -> Dict[str, Any]:
        """Classify an image into one of the provided categories."""
        categories_str = ", ".join(categories)
        prompt = f"""Classify this image into exactly ONE of these categories: {categories_str}

Reply with ONLY the category name, nothing else."""

        try:
            response = await self.describe_image(image, prompt)
            category = response.strip().lower()

            for cat in categories:
                if cat.lower() in category or category in cat.lower():
                    return {"category": cat, "raw_response": response}

            return {"category": response.strip(), "raw_response": response}

        except Exception as e:
            logger.error("Error during image classification: %s", e)
            raise

    @property
    def is_loaded(self) -> bool:
        """Check if Vision LLM is loaded"""
        return self._is_loaded

    @property
    def model_name(self) -> str:
        """Get the current model name"""
        return self._model

    def unload(self):
        """Unload the Vision LLM"""
        self._client = None
        self._is_loaded = False
        logger.info("Vision LLM unloaded")


# Singleton instance
vllm_manager = VisionLLMManager()
