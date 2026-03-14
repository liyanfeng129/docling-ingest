import { useMemo, useState } from 'react';
import MetadataDisplay from './MetadataDisplay';

const MAX_PREVIEW_CHARS = 300;

export default function ResultCard({ result }) {
    const [expanded, setExpanded] = useState(false);
    const content = result?.content || '';
    const isLongContent = content.length > MAX_PREVIEW_CHARS;

    const visibleContent = useMemo(() => {
        if (!isLongContent || expanded) {
            return content;
        }
        return `${content.slice(0, MAX_PREVIEW_CHARS)}...`;
    }, [content, expanded, isLongContent]);

    return (
        <div className="bg-white border border-brand-grey-7 p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 bg-brand-grey-8 text-brand-grey-2">Rank #{result.rank}</span>
                <span className="text-xs px-2 py-1 bg-brand-blue-light-4 text-brand-blue">Distance: {Number(result.distance || 0).toFixed(4)}</span>
                {result.rerankScore !== undefined && (
                    <span className="text-xs px-2 py-1 bg-brand-green-5 text-brand-green-dark">
                        Rerank: {Number(result.rerankScore).toFixed(4)}
                    </span>
                )}
            </div>

            <p className="text-sm text-brand-grey-2 whitespace-pre-wrap">{visibleContent}</p>
            {isLongContent && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-2 text-xs text-brand-blue"
                >
                    {expanded ? 'Collapse' : 'Expand'}
                </button>
            )}

            <MetadataDisplay metadata={result.metadata} />
        </div>
    );
}
