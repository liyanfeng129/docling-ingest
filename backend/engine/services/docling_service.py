"""
Docling Service - PDF/Document to Frontend-ready JSON conversion.

This service provides two main functions:
1. convert_pdf() - Convert PDF to Docling JSON (lossless, in memory)
2. parse_to_ingestion_page() - Parse Docling JSON to frontend format
"""

from __future__ import annotations

import base64
import hashlib
import json
import uuid
from pathlib import Path
from typing import Any, ClassVar, Dict, List, Optional, Union

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    LayoutOptions,
    PictureDescriptionVlmOptions,
)
from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
from docling_core.types.doc.document import DoclingDocument as DoclingDocumentType


# =============================================================================
# LABEL ENUMS - All possible Docling item labels
# =============================================================================

class DocItemLabel:
    """All possible document item labels from Docling."""
    CAPTION = "caption"
    CHART = "chart"
    FOOTNOTE = "footnote"
    FORMULA = "formula"
    LIST_ITEM = "list_item"
    PAGE_FOOTER = "page_footer"
    PAGE_HEADER = "page_header"
    PICTURE = "picture"
    SECTION_HEADER = "section_header"
    TABLE = "table"
    TEXT = "text"
    TITLE = "title"
    DOCUMENT_INDEX = "document_index"
    CODE = "code"
    CHECKBOX_SELECTED = "checkbox_selected"
    CHECKBOX_UNSELECTED = "checkbox_unselected"
    FORM = "form"
    KEY_VALUE_REGION = "key_value_region"
    GRADING_SCALE = "grading_scale"
    HANDWRITTEN_TEXT = "handwritten_text"
    EMPTY_VALUE = "empty_value"
    PARAGRAPH = "paragraph"
    REFERENCE = "reference"


class GroupLabel:
    """All possible group labels from Docling."""
    LIST = "list"
    ORDERED_LIST = "ordered_list"
    CHAPTER = "chapter"
    SECTION = "section"
    SHEET = "sheet"
    SLIDE = "slide"
    FORM_AREA = "form_area"
    KEY_VALUE_AREA = "key_value_area"
    COMMENT_SECTION = "comment_section"
    INLINE = "inline"
    PICTURE_AREA = "picture_area"


class PictureClassificationLabel:
    """Picture classification labels."""
    OTHER = "other"
    PICTURE_GROUP = "picture_group"
    PIE_CHART = "pie_chart"
    BAR_CHART = "bar_chart"
    STACKED_BAR_CHART = "stacked_bar_chart"
    LINE_CHART = "line_chart"
    FLOW_CHART = "flow_chart"
    SCATTER_CHART = "scatter_chart"
    GRAPH_CHART = "graph_chart"
    AREA_CHART = "area_chart"
    FIGURE = "figure"
    MAP = "map"
    PHOTOGRAPH = "photograph"
    LOGO = "logo"
    ICON = "icon"
    ILLUSTRATION = "illustration"
    DIAGRAM = "diagram"
    NATURAL_IMAGE = "natural_image"
    MOLECULE = "molecule"
    CHECKLIST = "checklist"
    STAMP = "stamp"
    SIGNATURE = "signature"
    BARCODE = "barcode"
    QRCODE = "qrcode"
    MUSIC_NOTATION = "music_notation"


# =============================================================================
# DOCLING SERVICE - Singleton
# =============================================================================

class DoclingService:
    """
    Docling Service for PDF conversion and JSON transformation.
    Singleton pattern ensures converter is only initialized once.
    """

    _instance: ClassVar[Optional["DoclingService"]] = None
    _initialized: bool = False
    converter: DocumentConverter

    def __new__(cls) -> "DoclingService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the DocumentConverter with pipeline options."""
        if self._initialized:
            return

        print("[DoclingService] Initializing PDF converter...")

        pipeline_options = PdfPipelineOptions(
            do_ocr=False,
            force_backend_text=True,
            ocr_batch_size=4,
            generate_parsed_pages=True,
            generate_page_images=True,
            generate_picture_images=True,
            images_scale=2.0,
            do_table_structure=True,
            table_batch_size=8,
            do_picture_classification=True,
            do_picture_description=False,
            picture_description_options=PictureDescriptionVlmOptions(
                repo_id="Qwen/Qwen3-VL-2B-Instruct",
                prompt="describe the picture: if it is pure text, get the exact text content, else describe the image content in few words",
                batch_size=16,
                picture_area_threshold=0.30,
            ),
            layout_options=LayoutOptions(),
            layout_batch_size=8,
            allow_external_plugins=True,
            accelerator_options=AcceleratorOptions(
                device=AcceleratorDevice.AUTO,
                num_threads=8,
            ),
        )

        self.converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )

        self._initialized = True
        print("[DoclingService] PDF converter initialized successfully")

    # =========================================================================
    # MAIN API - PDF CONVERSION
    # =========================================================================

    def convert_pdf(
        self,
        pdf_path: Union[str, Path],
        verbose: bool = True
    ) -> Dict[str, Any]:
        """Convert a PDF file to Docling JSON (lossless, in memory)."""
        source_path = Path(pdf_path)

        if verbose:
            print(f"[DoclingService] Converting: {source_path.name}")

        conv_results = self.converter.convert_all([source_path])

        for result in conv_results:
            if verbose:
                print(f"[DoclingService] Status: {result.status.name}")

                if hasattr(result, 'timings') and result.timings:
                    print("[DoclingService] Timings:")
                    for key, value in result.timings.items():
                        print(f"  - {key}: {value:.2f}s")

            doc = result.document
            if doc:
                if verbose:
                    self._print_doc_info(doc)

                return doc.model_dump(mode='json', by_alias=True)

        raise RuntimeError(f"No conversion result for {pdf_path}")

    def _print_doc_info(self, doc: DoclingDocumentType) -> None:
        """Print document statistics."""
        texts = doc.texts if hasattr(doc, 'texts') else []
        tables = doc.tables if hasattr(doc, 'tables') else []
        pictures = doc.pictures if hasattr(doc, 'pictures') else []
        pages = doc.pages if hasattr(doc, 'pages') else {}
        key_value_items = doc.key_value_items if hasattr(doc, 'key_value_items') else []

        print("[DoclingService] Document Info:")
        print(f"  - Pages: {len(pages)}")
        print(f"  - Text blocks: {len(texts)}")
        print(f"  - Tables: {len(tables)}")
        print(f"  - Pictures: {len(pictures)}")
        print(f"  - Key-Value Items: {len(key_value_items)}")
        print("[DoclingService] Conversion complete!")

    # =========================================================================
    # MAIN API - PARSE TO FRONTEND FORMAT
    # =========================================================================

    STATIC_IMAGES_DIR = Path(__file__).parent.parent / "static" / "images"

    def parse_to_ingestion_page(
        self,
        docling_json: Dict[str, Any],
        include_furniture: bool = False,
        document_id: Optional[str] = None,
        save_images_to_disk: bool = True
    ) -> Dict[str, Any]:
        """Parse Docling JSON to frontend ingestion page format."""
        doc = docling_json

        if not document_id:
            document_id = f"doc_{uuid.uuid4().hex[:8]}"

        if save_images_to_disk:
            self.STATIC_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

        doc_name = doc.get('name', 'unknown')
        pages_data = doc.get('pages', {})

        texts = {i: t for i, t in enumerate(doc.get('texts', []))}
        tables = {i: t for i, t in enumerate(doc.get('tables', []))}
        pictures = {i: p for i, p in enumerate(doc.get('pictures', []))}
        groups = {i: g for i, g in enumerate(doc.get('groups', []))}
        key_value_items = {i: kv for i, kv in enumerate(doc.get('key_value_items', []))}
        form_items = {i: f for i, f in enumerate(doc.get('form_items', []))}

        ref_map = {}
        for i, t in texts.items():
            ref_map[f'#/texts/{i}'] = ('text', t, i)
        for i, t in tables.items():
            ref_map[f'#/tables/{i}'] = ('table', t, i)
        for i, p in pictures.items():
            ref_map[f'#/pictures/{i}'] = ('picture', p, i)
        for i, g in groups.items():
            ref_map[f'#/groups/{i}'] = ('group', g, i)
        for i, kv in key_value_items.items():
            ref_map[f'#/key_value_items/{i}'] = ('key_value', kv, i)
        for i, f in form_items.items():
            ref_map[f'#/form_items/{i}'] = ('form', f, i)

        page_items: Dict[int, List[Dict[str, Any]]] = {}

        for idx, text_item in texts.items():
            page_num = self._get_page_number(text_item)
            if page_num is None:
                continue

            label = text_item.get('label', 'text')

            if not include_furniture and label in [
                DocItemLabel.PAGE_HEADER,
                DocItemLabel.PAGE_FOOTER
            ]:
                continue

            if page_num not in page_items:
                page_items[page_num] = []

            frontend_item = self._transform_text_item(text_item, idx)
            if frontend_item:
                page_items[page_num].append(frontend_item)

        for idx, table_item in tables.items():
            page_num = self._get_page_number(table_item)
            if page_num is None:
                continue

            if page_num not in page_items:
                page_items[page_num] = []

            frontend_item = self._transform_table_item(table_item, idx)
            if frontend_item:
                page_items[page_num].append(frontend_item)

        for idx, picture_item in pictures.items():
            page_num = self._get_page_number(picture_item)
            if page_num is None:
                continue

            if page_num not in page_items:
                page_items[page_num] = []

            frontend_item = self._transform_picture_item(
                picture_item, idx, document_id, save_images_to_disk
            )
            if frontend_item:
                page_items[page_num].append(frontend_item)

        for idx, kv_item in key_value_items.items():
            page_num = self._get_page_number(kv_item)
            if page_num is None:
                continue

            if page_num not in page_items:
                page_items[page_num] = []

            frontend_item = self._transform_key_value_item(kv_item, idx)
            if frontend_item:
                page_items[page_num].append(frontend_item)

        for idx, form_item in form_items.items():
            page_num = self._get_page_number(form_item)
            if page_num is None:
                continue

            if page_num not in page_items:
                page_items[page_num] = []

            frontend_item = self._transform_form_item(form_item, idx)
            if frontend_item:
                page_items[page_num].append(frontend_item)

        for page_num in page_items:
            page_items[page_num] = self._sort_items_by_position(page_items[page_num])

        total_pages = len(pages_data) if pages_data else max(page_items.keys(), default=0)

        pages = []
        for page_num in range(1, total_pages + 1):
            pages.append({
                "pageNumber": page_num,
                "items": page_items.get(page_num, [])
            })

        return {
            "documentId": document_id,
            "filename": doc_name,
            "totalPages": total_pages,
            "pages": pages
        }

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def _get_page_number(self, item: Dict[str, Any]) -> Optional[int]:
        """Extract page number from item's provenance."""
        prov = item.get('prov', [])
        for p in prov:
            page_no = p.get('page_no', p.get('page', None))
            if page_no is not None:
                return page_no
        return None

    def _get_bbox(self, item: Dict[str, Any]) -> Optional[Dict[str, float]]:
        """Extract bounding box from item's provenance."""
        prov = item.get('prov', [])
        for p in prov:
            bbox = p.get('bbox', None)
            if bbox:
                coord_origin = bbox.get('coord_origin', 'TOPLEFT') if isinstance(bbox, dict) else 'TOPLEFT'

                if isinstance(bbox, list) and len(bbox) == 4:
                    return {
                        'x': bbox[0],
                        'y': bbox[1],
                        'width': bbox[2] - bbox[0],
                        'height': bbox[3] - bbox[1]
                    }
                elif isinstance(bbox, dict):
                    l = bbox.get('l', bbox.get('x', 0))
                    t = bbox.get('t', bbox.get('y', 0))
                    r = bbox.get('r', l)
                    b = bbox.get('b', t)

                    if coord_origin == 'BOTTOMLEFT':
                        return {
                            'x': l,
                            'y': -t,
                            'width': r - l,
                            'height': abs(t - b),
                            '_original_t': t,
                            '_original_b': b
                        }
                    else:
                        return {
                            'x': l,
                            'y': t,
                            'width': r - l,
                            'height': b - t
                        }
        return None

    def _transform_text_item(self, item: Dict[str, Any], idx: int) -> Optional[Dict[str, Any]]:
        """Transform a Docling text item to frontend format."""
        text = item.get('text', '').strip()
        if not text:
            return None

        label = item.get('label', 'text')
        level = item.get('level', 1)

        content = text
        if label == DocItemLabel.TITLE:
            content = f"# {text}"
        elif label == DocItemLabel.SECTION_HEADER:
            heading_prefix = '#' * min(level + 1, 6)
            content = f"{heading_prefix} {text}"
        elif label == DocItemLabel.LIST_ITEM:
            if item.get('enumerated'):
                content = f"1. {text}"
            else:
                content = f"- {text}"
        elif label == DocItemLabel.CODE:
            content = f"```\n{text}\n```"
        elif label == DocItemLabel.FORMULA:
            content = f"$${text}$$"
        elif label == DocItemLabel.CAPTION:
            content = f"*{text}*"
        elif label == DocItemLabel.FOOTNOTE:
            content = f"[^{idx}]: {text}"

        result = {
            "id": f"t{idx}",
            "type": "text",
            "content": content,
            "label": label,
            "deleted": False,
        }

        bbox = self._get_bbox(item)
        if bbox:
            result['bbox'] = bbox

        if label in [DocItemLabel.SECTION_HEADER, DocItemLabel.TITLE]:
            result['level'] = level

        if label == DocItemLabel.LIST_ITEM:
            result['enumerated'] = item.get('enumerated', False)

        return result

    def _transform_table_item(self, item: Dict[str, Any], idx: int) -> Optional[Dict[str, Any]]:
        """Transform a Docling table item to frontend format."""
        data = item.get('data', {})
        grid = data.get('grid', [])

        if not grid:
            return None

        headers = []
        rows = []

        for row_idx, row in enumerate(grid):
            row_cells = []
            for cell in row:
                if isinstance(cell, dict):
                    cell_text = cell.get('text', '').strip()
                else:
                    cell_text = str(cell).strip() if cell else ''
                row_cells.append(cell_text)

            if row_idx == 0:
                headers = row_cells
            else:
                rows.append(row_cells)

        result = {
            "id": f"tb{idx}",
            "type": "table",
            "tableData": {
                "headers": headers,
                "rows": rows,
                "numRows": data.get('num_rows', len(grid)),
                "numCols": data.get('num_cols', len(headers) if headers else 0),
            },
            "deleted": False,
        }

        bbox = self._get_bbox(item)
        if bbox:
            result['bbox'] = bbox

        return result

    def _transform_picture_item(
        self,
        item: Dict[str, Any],
        idx: int,
        document_id: Optional[str] = None,
        save_to_disk: bool = True
    ) -> Optional[Dict[str, Any]]:
        """Transform a Docling picture item to frontend format."""
        image_data = item.get('image', {})
        uri = image_data.get('uri', '') if isinstance(image_data, dict) else ''

        classification = self._get_picture_classification(item)

        width = image_data.get('width', 0) if isinstance(image_data, dict) else 0
        height = image_data.get('height', 0) if isinstance(image_data, dict) else 0

        if width == 0 or height == 0:
            bbox = self._get_bbox(item)
            if bbox:
                width = bbox.get('width', 0)
                height = bbox.get('height', 0)

        image_url = ''
        if uri.startswith('data:image'):
            if save_to_disk and document_id:
                image_url = self._save_base64_image(uri, document_id, idx)
            else:
                image_url = uri

        result = {
            "id": f"i{idx}",
            "type": "image",
            "imageUrl": image_url,
            "imageWidth": int(width) if width else 0,
            "imageHeight": int(height) if height else 0,
            "classification": classification or "unknown",
            "deleted": False,
        }

        bbox = self._get_bbox(item)
        if bbox:
            result['bbox'] = bbox

        description = item.get('description', '') or item.get('caption', '')
        if description:
            result['description'] = description

        return result

    def _save_base64_image(self, data_uri: str, document_id: str, idx: int) -> str:
        """Save base64 image to disk and return URL path."""
        try:
            if not data_uri.startswith('data:image'):
                return ''

            header, base64_data = data_uri.split(',', 1)
            mime_type = header.split(';')[0].split(':')[1]

            ext_map = {
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/gif': '.gif',
                'image/webp': '.webp',
                'image/svg+xml': '.svg',
            }
            extension = ext_map.get(mime_type, '.png')

            doc_dir = self.STATIC_IMAGES_DIR / document_id
            doc_dir.mkdir(parents=True, exist_ok=True)

            filename = f"i{idx}{extension}"
            file_path = doc_dir / filename

            image_bytes = base64.b64decode(base64_data)
            file_path.write_bytes(image_bytes)

            return f"/static/images/{document_id}/{filename}"

        except Exception as e:
            print(f"[DoclingService] Error saving image: {e}")
            return ''

    def _transform_key_value_item(self, item: Dict[str, Any], idx: int) -> Optional[Dict[str, Any]]:
        """Transform a Docling key-value item to frontend format."""
        graph = item.get('graph', {})
        cells = graph.get('cells', [])

        if not cells:
            key = item.get('key', '')
            value = item.get('value', '')
            if not key and not value:
                return None
            content = f"**{key}**: {value}" if key else value
        else:
            keys = []
            values = []
            for cell in cells:
                cell_kind = cell.get('kind', '')
                cell_text = cell.get('text', '')
                if cell_kind == 'key':
                    keys.append(cell_text)
                elif cell_kind == 'value':
                    values.append(cell_text)

            pairs = []
            for i, key in enumerate(keys):
                val = values[i] if i < len(values) else ''
                pairs.append(f"**{key}**: {val}")
            content = '\n'.join(pairs) if pairs else ''

        if not content:
            return None

        result = {
            "id": f"kv{idx}",
            "type": "text",
            "content": content,
            "label": DocItemLabel.KEY_VALUE_REGION,
            "deleted": False,
        }

        bbox = self._get_bbox(item)
        if bbox:
            result['bbox'] = bbox

        return result

    def _transform_form_item(self, item: Dict[str, Any], idx: int) -> Optional[Dict[str, Any]]:
        """Transform a Docling form item to frontend format."""
        graph = item.get('graph', {})
        cells = graph.get('cells', [])

        if not cells:
            return None

        parts = []
        for cell in cells:
            cell_kind = cell.get('kind', '')
            cell_text = cell.get('text', '')
            if cell_kind and cell_text:
                parts.append(f"[{cell_kind}] {cell_text}")
            elif cell_text:
                parts.append(cell_text)

        content = '\n'.join(parts) if parts else ''

        if not content:
            return None

        result = {
            "id": f"form{idx}",
            "type": "text",
            "content": content,
            "label": DocItemLabel.FORM,
            "deleted": False,
        }

        bbox = self._get_bbox(item)
        if bbox:
            result['bbox'] = bbox

        return result

    def _get_picture_classification(self, picture_item: Dict[str, Any]) -> Optional[str]:
        """Extract picture classification from annotations or meta."""
        annotations = picture_item.get('annotations', [])
        for ann in annotations:
            if ann.get('kind') == 'classification':
                predicted_classes = ann.get('predicted_classes', [])
                if predicted_classes:
                    return predicted_classes[0].get('class_name', 'unknown')

        meta = picture_item.get('meta', {})
        classification = meta.get('classification', {})
        predictions = classification.get('predictions', [])
        if predictions:
            return predictions[0].get('class_name', 'unknown')

        return None

    def _sort_items_by_position(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Sort items by their position (top-to-bottom, left-to-right)."""
        def sort_key(item):
            bbox = item.get('bbox', {})
            if not bbox:
                return (float('inf'), float('inf'))
            y = bbox.get('y', float('inf'))
            x = bbox.get('x', 0)
            return (y, x)

        return sorted(items, key=sort_key)


# =============================================================================
# MODULE-LEVEL SINGLETON ACCESS
# =============================================================================

_docling_service: Optional[DoclingService] = None


def get_docling_service() -> DoclingService:
    """Get the singleton DoclingService instance."""
    global _docling_service
    if _docling_service is None:
        _docling_service = DoclingService()
    return _docling_service
