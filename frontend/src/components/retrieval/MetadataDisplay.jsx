import { useMemo, useState } from 'react';

const IMAGE_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:8000';

function resolveImagePath(imageEntry) {
    // Support both plain string paths and object entries with imageUrl
    const imagePath = typeof imageEntry === 'object' && imageEntry !== null
        ? (imageEntry.imageUrl || imageEntry.url || imageEntry.src || '')
        : imageEntry;

    if (!imagePath || typeof imagePath !== 'string') {
        return '';
    }
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('data:')) {
        return imagePath;
    }
    return `${IMAGE_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

function parseImages(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value !== 'string') {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function ValueRow({ label, value }) {
    const [expanded, setExpanded] = useState(false);
    const asText = typeof value === 'string' ? value : JSON.stringify(value);
    const needsTruncate = asText.length > 140;

    return (
        <div className="text-xs text-brand-grey-3">
            <span className="font-semibold text-brand-grey-2">{label}: </span>
            <span>{needsTruncate && !expanded ? `${asText.slice(0, 140)}...` : asText}</span>
            {needsTruncate && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="ml-2 text-brand-blue"
                >
                    {expanded ? 'Collapse' : 'Expand'}
                </button>
            )}
        </div>
    );
}

export default function MetadataDisplay({ metadata = {} }) {
    const normalizedMetadata = metadata || {};

    const images = useMemo(() => parseImages(normalizedMetadata.images), [normalizedMetadata.images]);

    const genericEntries = Object.entries(normalizedMetadata).filter(([key]) => {
        return !['source', 'filename', 'page_number', 'page_range', 'strategy', 'chunk_index', 'images', 'rerank_score'].includes(key);
    });

    return (
        <div className="space-y-2 mt-3 pt-3 border-t border-brand-grey-8">
            <div className="flex flex-wrap gap-2">
                {(normalizedMetadata.source || normalizedMetadata.filename) && (
                    <span className="text-xs px-2 py-1 bg-brand-blue-light-4 text-brand-blue">
                        {normalizedMetadata.source || normalizedMetadata.filename}
                    </span>
                )}
                {(normalizedMetadata.page_number || normalizedMetadata.page_range) && (
                    <span className="text-xs px-2 py-1 bg-brand-grey-8 text-brand-grey-2">
                        Page {normalizedMetadata.page_number || normalizedMetadata.page_range}
                    </span>
                )}
                {normalizedMetadata.strategy && (
                    <span className="text-xs px-2 py-1 bg-brand-green-5 text-brand-green-dark">
                        {normalizedMetadata.strategy}
                    </span>
                )}
                {normalizedMetadata.chunk_index !== undefined && (
                    <span className="text-xs px-2 py-1 bg-brand-orange-4 text-brand-orange">
                        Chunk #{normalizedMetadata.chunk_index}
                    </span>
                )}
            </div>

            {images.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-brand-grey-2 mb-2">Images</p>
                    <div className="flex flex-wrap gap-2">
                        {images.map((imagePath, index) => (
                            <img
                                key={`${imagePath}-${index}`}
                                src={resolveImagePath(imagePath)}
                                alt={`result-image-${index}`}
                                className="h-14 w-14 object-cover border border-brand-grey-7"
                            />
                        ))}
                    </div>
                </div>
            )}

            {genericEntries.map(([key, value]) => (
                <ValueRow key={key} label={key} value={value} />
            ))}
        </div>
    );
}
