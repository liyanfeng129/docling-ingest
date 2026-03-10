/**
 * ImageItem Component
 * 
 * Displays an image with classification badge and controls.
 * Supports delete, classification change, and lightbox expand.
 */

import { useState, useCallback, useMemo } from 'react';
import { INGESTION_CONFIG } from '../../../config/ingestionConfig';

// LLM service base URL for static images
const LLM_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:8000';

/**
 * Resolve image URL - handle data URLs, full URLs, and static paths
 * @param {string} url - The image URL from the backend
 * @returns {string} - Resolved URL
 */
function resolveImageUrl(url) {
    if (!url) return '';
    // Data URLs and full URLs - use as-is
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // Static paths from LLM service - prefix with base URL
    if (url.startsWith('/static/')) {
        return `${LLM_BASE_URL}${url}`;
    }
    // Other relative paths - also prefix with base URL
    return `${LLM_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * @param {Object} props
 * @param {Object} props.item - Image item object { id, type, imageUrl, classification }
 * @param {Function} props.onDelete - Delete handler (itemId)
 * @param {Function} props.onClassChange - Classification change handler (itemId, newClass)
 * @param {Array} props.availableClasses - Available classification options
 */
export default function ImageItem({
    item,
    onDelete,
    onClassChange,
    availableClasses = [],
}) {
    const [showLightbox, setShowLightbox] = useState(false);
    const [showClassDropdown, setShowClassDropdown] = useState(false);

    // Check if image needs resizing
    const needsResize =
        item.imageWidth > INGESTION_CONFIG.image.maxDisplayWidth ||
        item.imageHeight > INGESTION_CONFIG.image.maxDisplayHeight;

    // Resolve the image URL (handle static paths from LLM service)
    const resolvedImageUrl = useMemo(() => resolveImageUrl(item.imageUrl), [item.imageUrl]);

    // Handle classification change
    const handleClassChange = useCallback((newClass) => {
        if (onClassChange) {
            onClassChange(item.id, newClass);
        }
        setShowClassDropdown(false);
    }, [item.id, onClassChange]);

    return (
        <>
            <div className="bg-white p-4 border border-brand-grey-7 group hover:border-brand-blue transition-colors">
                <div className="relative">
                    {/* Image */}
                    <img
                        src={resolvedImageUrl}
                        alt="Document image"
                        className={`cursor-pointer ${needsResize ? 'max-w-full h-auto' : ''}`}
                        style={{
                            maxWidth: INGESTION_CONFIG.image.maxDisplayWidth,
                            maxHeight: INGESTION_CONFIG.image.maxDisplayHeight,
                        }}
                        onClick={() => setShowLightbox(true)}
                        title={needsResize ? 'Click to expand' : undefined}
                    />

                    {/* Classification badge */}
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={() => setShowClassDropdown(!showClassDropdown)}
                            className="px-2 py-1 text-xs font-bold
                                bg-white border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white
                                transition-colors shadow-sm"
                        >
                            {item.classification || 'unclassified'}
                        </button>

                        {/* Classification dropdown */}
                        {showClassDropdown && availableClasses.length > 0 && (
                            <div className="absolute top-full right-0 mt-1 bg-white border border-brand-grey-7 
                                shadow-lg py-1 z-10 min-w-[120px] max-h-80 overflow-y-auto">
                                {availableClasses.map((cls) => (
                                    <button
                                        key={cls}
                                        onClick={() => handleClassChange(cls)}
                                        className={`
                                            w-full px-3 py-2 text-left text-sm transition-colors
                                            hover:bg-brand-blue-light-3
                                            ${cls === item.classification
                                                ? 'text-brand-blue font-medium bg-brand-blue-light-4'
                                                : 'text-brand-grey-1 bg-white'}
                                        `}
                                    >
                                        {cls}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Expand hint for large images */}
                    {needsResize && (
                        <div className="absolute bottom-2 left-2 text-xs text-brand-grey-4 
                            bg-white/80 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            Click to expand
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onDelete && (
                        <button
                            onClick={() => onDelete(item.id)}
                            className="px-3 py-1 text-xs rounded-md bg-white border border-brand-grey-7 
                                text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                        >
                            🗑️ Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {showLightbox && (
                <div
                    className="fixed inset-0 bg-brand-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    onClick={() => setShowLightbox(false)}
                >
                    <div className="relative max-w-full max-h-full overflow-auto">
                        <img
                            src={resolvedImageUrl}
                            alt="Document image (full size)"
                            className="max-w-none shadow-2xl rounded-sm"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button
                            onClick={() => setShowLightbox(false)}
                            className="absolute top-4 right-4 text-brand-black bg-white/90 
                                rounded-full w-10 h-10 flex items-center justify-center
                                hover:bg-white transition-colors shadow-lg z-50"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
