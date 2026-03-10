/**
 * TableItem Component
 * 
 * Displays table content in a formatted table view.
 * Read-only for now (editing could be added later).
 */

/**
 * @param {Object} props
 * @param {Object} props.item - Table item object { id, type, tableData }
 * @param {Function} props.onDelete - Delete handler (itemId)
 */
export default function TableItem({
    item,
    onDelete,
}) {
    const { tableData } = item;

    if (!tableData || !tableData.headers || !tableData.rows) {
        return (
            <div className="bg-white p-4 border border-brand-grey-7">
                <p className="text-sm text-brand-grey-4">Invalid table data</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-4 border border-brand-grey-7 group hover:border-brand-blue transition-colors">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-brand-grey-7 border border-brand-grey-7">
                    <thead className="bg-brand-blue-light-5">
                        <tr>
                            {tableData.headers.map((header, i) => (
                                <th
                                    key={i}
                                    className="px-4 py-2 text-left text-xs font-bold text-brand-black uppercase tracking-wider"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-brand-grey-7">
                        {tableData.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-brand-blue-light-5 transition-colors">
                                {row.map((cell, j) => (
                                    <td
                                        key={j}
                                        className="px-4 py-2 text-sm text-brand-black whitespace-nowrap"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDelete && (
                    <button
                        onClick={() => onDelete(item.id)}
                        className="px-3 py-1 text-xs font-bold bg-white border border-brand-orange 
                            text-brand-orange hover:bg-brand-orange hover:text-white transition-colors"
                    >
                        🗑️ Delete
                    </button>
                )}
            </div>
        </div>
    );
}
