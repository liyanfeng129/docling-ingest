export default function ObservabilityPanel({ timing, observability }) {
    return (
        <div className="bg-white border border-brand-grey-7 p-4 space-y-3">
            <h3 className="text-sm font-bold text-brand-grey-2">Observability</h3>

            {!timing && !observability && (
                <p className="text-xs text-brand-grey-4">Run a search to view timing and model details.</p>
            )}

            {timing && (
                <div className="space-y-1 text-xs text-brand-grey-3">
                    <p><span className="font-semibold text-brand-grey-2">Total:</span> {timing.totalMs} ms</p>
                    <p><span className="font-semibold text-brand-grey-2">Embedding:</span> {timing.embeddingMs} ms</p>
                    <p><span className="font-semibold text-brand-grey-2">Search:</span> {timing.searchMs} ms</p>
                    {timing.rerankMs > 0 && <p><span className="font-semibold text-brand-grey-2">Rerank:</span> {timing.rerankMs} ms</p>}
                </div>
            )}

            {observability && (
                <div className="space-y-1 text-xs text-brand-grey-3 pt-2 border-t border-brand-grey-8">
                    <p><span className="font-semibold text-brand-grey-2">Embedding Model:</span> {observability.embeddingModel}</p>
                    <p><span className="font-semibold text-brand-grey-2">Embedding Dim:</span> {observability.embeddingDim}</p>
                    <p><span className="font-semibold text-brand-grey-2">Collection Docs:</span> {observability.collectionDocCount}</p>
                    <p><span className="font-semibold text-brand-grey-2">Query Length:</span> {observability.queryLength}</p>
                    {observability.rerankerModel && (
                        <p><span className="font-semibold text-brand-grey-2">Reranker:</span> {observability.rerankerModel}</p>
                    )}
                </div>
            )}
        </div>
    );
}
