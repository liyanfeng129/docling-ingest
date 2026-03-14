const PARAM_DEFINITIONS = [
    {
        id: 'k',
        label: 'Results (k)',
        type: 'number',
        min: 1,
        max: 50,
        step: 1,
    },
    {
        id: 'enableReranking',
        label: 'Enable Reranking',
        type: 'toggle',
    },
    {
        id: 'rerankK',
        label: 'Rerank Top-K',
        type: 'number',
        min: 1,
        max: 20,
        step: 1,
        visibleWhen: (params) => params.enableReranking,
    },
];

export default function SearchParamsPanel({ params, onChange, disabled }) {
    return (
        <div className="bg-white border border-brand-grey-7 p-4 space-y-4">
            <h3 className="text-sm font-bold text-brand-grey-2">Search Parameters</h3>

            {PARAM_DEFINITIONS.filter((param) => !param.visibleWhen || param.visibleWhen(params)).map((param) => {
                if (param.type === 'toggle') {
                    return (
                        <label key={param.id} className="flex items-center justify-between text-sm">
                            <span className="text-brand-grey-2">{param.label}</span>
                            <input
                                type="checkbox"
                                checked={Boolean(params[param.id])}
                                disabled={disabled}
                                onChange={(event) => onChange({ [param.id]: event.target.checked })}
                                className="h-4 w-4"
                            />
                        </label>
                    );
                }

                return (
                    <label key={param.id} className="block text-sm">
                        <span className="block mb-1 text-brand-grey-2">{param.label}</span>
                        <input
                            type="number"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={params[param.id]}
                            disabled={disabled}
                            onChange={(event) => onChange({
                                [param.id]: Math.min(
                                    param.max,
                                    Math.max(param.min, Number(event.target.value || param.min)),
                                ),
                            })}
                            className="w-full border border-brand-grey-7 p-2"
                        />
                    </label>
                );
            })}

            {params.enableReranking && (
                <p className="text-xs text-brand-grey-4">
                    First rerank request can be slower while the reranker model loads.
                </p>
            )}
        </div>
    );
}
