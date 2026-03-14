export default function CollectionSelector({
    collections,
    collectionId,
    collectionInfo,
    isLoading,
    onChange,
}) {
    if (isLoading) {
        return (
            <div className="bg-white border border-brand-grey-7 p-4 text-sm text-brand-grey-3">
                Loading collections...
            </div>
        );
    }

    if (!collections.length) {
        return (
            <div className="bg-white border border-brand-grey-7 p-4 text-sm text-brand-grey-3">
                No collections found. Please ingest documents first.
            </div>
        );
    }

    return (
        <div className="bg-white border border-brand-grey-7 p-4 space-y-3">
            <label className="block text-sm font-semibold text-brand-grey-2">Collection</label>
            <select
                value={collectionId}
                onChange={(event) => onChange(event.target.value)}
                className="w-full border border-brand-grey-7 p-2 text-sm"
            >
                {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                        {collection.label || collection.id} ({collection.docCount ?? 0} docs)
                    </option>
                ))}
            </select>

            {collectionInfo && (
                <div className="text-xs text-brand-grey-3 space-y-1 pt-2 border-t border-brand-grey-8">
                    <p><span className="font-semibold text-brand-grey-2">Documents:</span> {collectionInfo.docCount ?? 0}</p>
                    <p><span className="font-semibold text-brand-grey-2">Metadata Keys:</span> {(collectionInfo.metadataKeys || []).join(', ') || '—'}</p>
                </div>
            )}
        </div>
    );
}
