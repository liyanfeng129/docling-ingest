export default function NavBar({ activeTab, onChange }) {
    const tabs = [
        { id: 'ingestion', label: 'Ingestion' },
        { id: 'query-testing', label: 'Query Testing' },
    ];

    return (
        <div className="border-b border-brand-grey-7 bg-white px-6 py-3">
            <div className="flex items-center gap-3">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={`px-3 py-2 text-sm font-semibold transition-colors border-b-2 ${isActive
                                    ? 'border-brand-blue text-brand-blue'
                                    : 'border-transparent text-brand-grey-3 hover:text-brand-blue'
                                }`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
