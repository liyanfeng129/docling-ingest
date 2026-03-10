/**
 * PageContent Component
 * 
 * Container for rendering page items (text, images, tables).
 * Filters deleted items from main view.
 */

import TextItem from './TextItem';
import ImageItem from './ImageItem';
import TableItem from './TableItem';

/**
 * @param {Object} props
 * @param {Object} props.page - Page object { pageNumber, items }
 * @param {Function} props.onEditItem - Edit handler (itemId, newContent)
 * @param {Function} props.onDeleteItem - Delete handler (itemId)
 * @param {Function} props.onClassChange - Classification change handler (itemId, newClass)
 * @param {Array} props.availableClasses - Available image classification options
 */
export default function PageContent({
    page,
    onEditItem,
    onDeleteItem,
    onClassChange,
    availableClasses = [],
}) {
    if (!page || !page.items) {
        return (
            <div className="text-center text-brand-grey-4 py-12">
                No content on this page
            </div>
        );
    }

    // Filter out deleted items (soft-deleted items stay in state for undo)
    const items = page.items.filter((item) => !item.deleted);

    if (items.length === 0) {
        return (
            <div className="text-center text-brand-grey-4 py-12">
                All items on this page have been deleted
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {items.map((item) => {
                switch (item.type) {
                    case 'text':
                        return (
                            <TextItem
                                key={item.id}
                                item={item}
                                onEdit={onEditItem}
                                onDelete={onDeleteItem}
                            />
                        );

                    case 'image':
                    case 'picture':
                        return (
                            <ImageItem
                                key={item.id}
                                item={item}
                                onDelete={onDeleteItem}
                                onClassChange={onClassChange}
                                availableClasses={availableClasses}
                            />
                        );

                    case 'table':
                        return (
                            <TableItem
                                key={item.id}
                                item={item}
                                onDelete={onDeleteItem}
                            />
                        );

                    default:
                        return (
                            <div
                                key={item.id}
                                className="bg-white rounded-xl p-4 shadow-sm border border-brand-grey-7"
                            >
                                <p className="text-sm text-brand-grey-4">
                                    Unknown item type: {item.type}
                                </p>
                            </div>
                        );
                }
            })}
        </div>
    );
}
