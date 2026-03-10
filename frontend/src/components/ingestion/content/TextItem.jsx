/**
 * TextItem Component
 * 
 * Displays text content with edit mode support.
 * Renders Markdown normally, switches to raw editor on click (like a notebook cell).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * @param {Object} props
 * @param {Object} props.item - Text item object { id, type, content }
 * @param {Function} props.onEdit - Edit handler (itemId, newContent)
 * @param {Function} props.onDelete - Delete handler (itemId)
 */
export default function TextItem({
    item,
    onEdit,
    onDelete,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(item.content);
    const textareaRef = useRef(null);

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

    // Reset edit content when item changes
    useEffect(() => {
        setEditContent(item.content);
    }, [item.content]);

    // Handle save
    const handleSave = useCallback(() => {
        if (editContent !== item.content && onEdit) {
            onEdit(item.id, editContent);
        }
        setIsEditing(false);
    }, [editContent, item.content, item.id, onEdit]);

    // Handle cancel
    const handleCancel = useCallback(() => {
        setEditContent(item.content);
        setIsEditing(false);
    }, [item.content]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') {
            handleCancel();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            handleSave();
        }
    }, [handleCancel, handleSave]);

    return (
        <div
            className={`
                bg-white p-4 border transition-all group
                ${isEditing ? 'border-brand-blue ring-1 ring-brand-blue' : 'border-brand-grey-7 hover:border-brand-blue'}
            `}
        >
            {isEditing ? (
                <div className="space-y-2">
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={(e) => {
                            setEditContent(e.target.value);
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        className="w-full min-h-[200px] p-3 border border-brand-grey-7 rounded-lg 
                            focus:outline-none focus:ring-2 focus:ring-brand-blue
                            font-mono text-sm bg-white text-brand-grey-1 resize-y"
                        placeholder="Enter markdown content..."
                        style={{ height: 'auto', minHeight: Math.max(200, editContent.split('\n').length * 24) + 'px' }}
                    />
                    <div className="flex justify-end space-x-2 text-xs text-brand-grey-4">
                        <span>Ctrl+Enter to save • ESC to cancel</span>
                    </div>
                </div>
            ) : (
                <div
                    className="cursor-text"
                    onClick={() => setIsEditing(true)}
                >
                    <div className="prose prose-sm max-w-none 
                        prose-headings:text-brand-grey-1 prose-headings:font-semibold
                        prose-p:text-brand-grey-1 prose-p:my-2
                        prose-strong:text-brand-grey-1
                        prose-ul:text-brand-grey-1 prose-ol:text-brand-grey-1
                        prose-li:text-brand-grey-1
                        prose-a:text-brand-blue
                        prose-code:text-brand-grey-1 prose-code:bg-brand-grey-8 prose-code:px-1 prose-code:rounded
                        prose-pre:bg-brand-grey-8 prose-pre:text-brand-grey-1">
                        <ReactMarkdown>{item.content}</ReactMarkdown>
                    </div>

                    {/* Action buttons on hover */}
                    <div className="flex items-center justify-end space-x-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(true);
                            }}
                            className="px-3 py-1 text-xs rounded-md bg-white border border-brand-grey-7 
                                text-brand-blue hover:bg-brand-blue-light-4 hover:border-brand-blue transition-colors"
                        >
                            ✏️ Edit
                        </button>
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item.id);
                                }}
                                className="px-3 py-1 text-xs rounded-md bg-white border border-brand-grey-7 
                                    text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors"
                            >
                                🗑️ Delete
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
