import { useState } from 'react';
import ResultCard from './ResultCard';
import LlmExportModal from './LlmExportModal';

export default function ResultsList({ query, results, isSearching, error, hasSearched }) {
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);

    if (isSearching) {
        return (
            <div className="bg-white border border-brand-grey-7 p-6 text-sm text-brand-grey-3">
                Running similarity search...
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {error}
            </div>
        );
    }

    if (!hasSearched) {
        return null;
    }

    return (
        <>
            <div className="bg-white border border-brand-grey-7 p-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-brand-grey-3">
                    {results.length} result{results.length === 1 ? '' : 's'}
                </p>
                <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={results.length === 0}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-60"
                >
                    Export to LLM
                </button>
            </div>

            {results.length === 0 ? (
                <div className="bg-white border border-brand-grey-7 p-6 text-sm text-brand-grey-3">
                    No results found for this query.
                </div>
            ) : (
                <div className="space-y-3">
                    {results.map((result, index) => (
                        <ResultCard key={`${result.rank}-${index}`} result={{ ...result, rank: result.rank || index + 1 }} />
                    ))}
                </div>
            )}

            <LlmExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                query={query}
                results={results}
            />
        </>
    );
}
