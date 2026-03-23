import { useEffect, useMemo, useState } from 'react';
import { generateLlmPrompt } from '../../utils/llmExport';

export default function LlmExportModal({ isOpen, onClose, query, results = [] }) {
    const [includeMetadata, setIncludeMetadata] = useState(true);
    const [includeScores, setIncludeScores] = useState(false);
    const [maxDocuments, setMaxDocuments] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen && copied) {
            setCopied(false);
        }
    }, [copied, isOpen]);

    useEffect(() => {
        if (!copied) {
            return undefined;
        }
        const timeoutId = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timeoutId);
    }, [copied]);

    const preview = useMemo(() => {
        return generateLlmPrompt({
            query,
            results,
            options: {
                includeMetadata,
                includeScores,
                maxDocuments,
            },
        });
    }, [includeMetadata, includeScores, maxDocuments, query, results]);

    const maxDocumentOptions = useMemo(() => {
        const count = results.length;
        if (count <= 0) {
            return [];
        }
        const seeds = [1, 3, 5, 10, count];
        return [...new Set(seeds.filter((value) => value > 0 && value < count))].sort((left, right) => left - right);
    }, [results.length]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(preview);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="llm-export-title">
            <button
                type="button"
                className="absolute inset-0 bg-black/40"
                aria-label="Close export dialog"
                onClick={onClose}
            />

            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white border border-brand-grey-7 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-brand-grey-8">
                    <h3 id="llm-export-title" className="text-base font-semibold text-brand-grey-2">Export to LLM</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-brand-grey-4 hover:text-brand-grey-2"
                    >
                        Close
                    </button>
                </div>

                <div className="px-5 py-4 border-b border-brand-grey-8 space-y-3">
                    <p className="text-xs font-semibold text-brand-grey-3 uppercase tracking-wide">Options</p>
                    <div className="flex flex-wrap gap-4 items-center">
                        <label className="inline-flex items-center gap-2 text-sm text-brand-grey-2">
                            <input
                                type="checkbox"
                                checked={includeMetadata}
                                onChange={(event) => setIncludeMetadata(event.target.checked)}
                            />
                            Include metadata
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm text-brand-grey-2">
                            <input
                                type="checkbox"
                                checked={includeScores}
                                onChange={(event) => setIncludeScores(event.target.checked)}
                            />
                            Include scores
                        </label>

                        <label className="inline-flex items-center gap-2 text-sm text-brand-grey-2">
                            Max documents
                            <select
                                value={maxDocuments ?? 'all'}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setMaxDocuments(value === 'all' ? null : Number(value));
                                }}
                                className="border border-brand-grey-7 px-2 py-1 bg-white"
                            >
                                <option value="all">All ({results.length})</option>
                                {maxDocumentOptions.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <div className="px-5 py-4 flex-1 min-h-0">
                    <textarea
                        value={preview}
                        readOnly
                        className="w-full h-full min-h-[360px] max-h-full p-3 border border-brand-grey-7 text-xs font-mono text-brand-grey-2 bg-brand-grey-20 whitespace-pre"
                    />
                </div>

                <div className="px-5 py-4 border-t border-brand-grey-8 flex items-center justify-end">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="px-4 py-2 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-60"
                    >
                        {copied ? 'Copied!' : 'Copy to Clipboard'}
                    </button>
                </div>
            </div>
        </div>
    );
}
