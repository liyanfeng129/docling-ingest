import ResultCard from './ResultCard';

export default function ResultsList({ results, isSearching, error, hasSearched }) {
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

    if (hasSearched && results.length === 0) {
        return (
            <div className="bg-white border border-brand-grey-7 p-6 text-sm text-brand-grey-3">
                No results found for this query.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {results.map((result, index) => (
                <ResultCard key={`${result.rank}-${index}`} result={{ ...result, rank: result.rank || index + 1 }} />
            ))}
        </div>
    );
}
