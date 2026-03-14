export default function QueryInput({ query, onChange, onSearch, isSearching, disabled }) {
    const handleKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            onSearch();
        }
    };

    return (
        <div className="bg-white border border-brand-grey-7 p-4">
            <label className="block text-sm font-semibold text-brand-grey-2 mb-2">
                Query
            </label>
            <textarea
                value={query}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question to test retrieval quality..."
                rows={4}
                disabled={disabled || isSearching}
                className="w-full border border-brand-grey-7 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-light-2"
            />
            <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-brand-grey-4">Press Ctrl+Enter to search</p>
                <button
                    type="button"
                    onClick={onSearch}
                    disabled={disabled || isSearching || !query.trim()}
                    className="px-4 py-2 text-sm font-semibold bg-brand-blue text-white disabled:opacity-50"
                >
                    {isSearching ? 'Searching...' : 'Search'}
                </button>
            </div>
        </div>
    );
}
