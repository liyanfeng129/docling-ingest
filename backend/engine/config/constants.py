"""
Constants for the engine service.

This module contains constants used across the service,
including Docling picture classification classes.
"""

# =============================================================================
# DOCLING PICTURE CLASSIFICATION CLASSES
# =============================================================================

DOCLING_PICTURE_CLASSES = [
    "bar_chart",
    "bar_code",
    "box_plot",
    "calendar",
    "chemistry_structure",
    "crossword_puzzle",
    "engineering_drawing",
    "flow_chart",
    "full_page_image",
    "geographical_map",
    "icon",
    "line_chart",
    "logo",
    "music",
    "other",
    "page_thumbnail",
    "photograph",
    "pie_chart",
    "qr_code",
    "scatter_plot",
    "screenshot_from_computer",
    "screenshot_from_manual",
    "signature",
    "stamp",
    "table",
    "topographical_map",
]

# Set for O(1) lookup
DOCLING_PICTURE_CLASSES_SET = frozenset(DOCLING_PICTURE_CLASSES)

# Categories for grouping
DOCLING_PICTURE_CATEGORIES = {
    "charts": ["bar_chart", "line_chart", "pie_chart", "scatter_plot", "box_plot"],
    "diagrams": ["flow_chart", "engineering_drawing", "chemistry_structure"],
    "maps": ["geographical_map", "topographical_map"],
    "codes": ["bar_code", "qr_code"],
    "screenshots": ["screenshot_from_computer", "screenshot_from_manual"],
    "decorative": ["logo", "icon", "stamp", "signature"],
    "photos": ["photograph", "full_page_image", "page_thumbnail"],
    "other": ["calendar", "crossword_puzzle", "music", "table", "other"],
}

DOCLING_DECORATIVE_CLASSES = frozenset([
    "logo", "icon", "stamp", "signature", "bar_code", "qr_code",
])

DOCLING_CONTENT_CLASSES = frozenset([
    "bar_chart", "line_chart", "pie_chart", "scatter_plot", "box_plot",
    "flow_chart", "engineering_drawing", "chemistry_structure",
    "geographical_map", "topographical_map",
    "screenshot_from_computer", "screenshot_from_manual",
    "photograph", "table",
])


def is_valid_picture_class(class_name: str) -> bool:
    """Check if a class name is a valid Docling picture classification."""
    return class_name in DOCLING_PICTURE_CLASSES_SET


def get_picture_category(class_name: str) -> str | None:
    """Get the category for a picture classification class."""
    for category, classes in DOCLING_PICTURE_CATEGORIES.items():
        if class_name in classes:
            return category
    return None


def is_decorative_class(class_name: str) -> bool:
    """Check if a picture class is typically decorative (noise)."""
    return class_name in DOCLING_DECORATIVE_CLASSES


def is_content_class(class_name: str) -> bool:
    """Check if a picture class typically contains meaningful content."""
    return class_name in DOCLING_CONTENT_CLASSES
