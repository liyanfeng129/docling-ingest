import { useEffect, useState } from 'react';

import useQueryTesting from '../hooks/useQueryTesting';
import CollectionSelector from '../components/retrieval/CollectionSelector';
import ObservabilityPanel from '../components/retrieval/ObservabilityPanel';
import QueryInput from '../components/retrieval/QueryInput';
import ResultsList from '../components/retrieval/ResultsList';
import SearchParamsPanel from '../components/retrieval/SearchParamsPanel';

function SearchHistory({ entries, onRun, isSearching }) {
    return (
        <div className="bg-white border border-brand-grey-7 p-4">
            <h3 className="text-sm font-bold text-brand-grey-2 mb-3">Recent Searches</h3>
            {entries.length === 0 && (
                <p className="text-xs text-brand-grey-4">No history yet in this session.</p>
            )}
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {entries.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => onRun(entry)}
                        disabled={isSearching}
                        className="w-full text-left border border-brand-grey-8 p-2 hover:border-brand-blue disabled:opacity-50"
                    >
                        <p className="text-xs font-semibold text-brand-grey-2 truncate">{entry.query}</p>
                        <p className="text-xs text-brand-grey-4 mt-1">
                            {entry.collectionId} • k={entry.params.k} • {entry.resultCount} results • {entry.totalMs}ms
                        </p>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function QueryTestingPage() {
    const [hasSearched, setHasSearched] = useState(false);
    const {
        query,
        collectionId,
        collections,
        collectionInfo,
        params,
        results,
        timing,
        observability,
        error,
        isSearching,
        isLoadingCollections,
        searchHistory,
        setQuery,
        setCollectionId,
        updateParams,
        loadCollections,
        loadCollectionInfo,
        executeSearch,
        runHistoryEntry,
    } = useQueryTesting();

    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    useEffect(() => {
        if (collectionId) {
            loadCollectionInfo(collectionId);
        }
    }, [collectionId, loadCollectionInfo]);

    const handleSearch = async () => {
        const response = await executeSearch();
        if (response) {
            setHasSearched(true);
        }
    };

    const handleCollectionChange = (nextCollectionId) => {
        setCollectionId(nextCollectionId);
    };

    return (
        <div className="h-[calc(100vh-64px)] bg-brand-grey-20">
            <div className="h-full grid grid-cols-[280px_1fr_340px] gap-4 p-4">
                <div className="space-y-4 overflow-y-auto">
                    <CollectionSelector
                        collections={collections}
                        collectionId={collectionId}
                        collectionInfo={collectionInfo}
                        isLoading={isLoadingCollections}
                        onChange={handleCollectionChange}
                    />
                </div>

                <div className="space-y-4 overflow-y-auto">
                    <QueryInput
                        query={query}
                        onChange={setQuery}
                        onSearch={handleSearch}
                        isSearching={isSearching}
                        disabled={!collectionId || isLoadingCollections}
                    />

                    <ResultsList
                        query={query}
                        results={results}
                        isSearching={isSearching}
                        error={error}
                        hasSearched={hasSearched}
                    />
                </div>

                <div className="space-y-4 overflow-y-auto">
                    <SearchParamsPanel
                        params={params}
                        onChange={updateParams}
                        disabled={isSearching}
                    />
                    <ObservabilityPanel timing={timing} observability={observability} />
                    <SearchHistory
                        entries={searchHistory}
                        onRun={async (entry) => {
                            setHasSearched(true);
                            await runHistoryEntry(entry);
                        }}
                        isSearching={isSearching}
                    />
                </div>
            </div>
        </div>
    );
}
