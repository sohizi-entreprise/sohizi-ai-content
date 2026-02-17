
import { Button } from '@/components/ui/button';
import { IconCategoryPlus, IconPlaylistAdd, IconTrash } from '@tabler/icons-react';
import { ClassValue } from 'clsx';
import { Sparkles} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { BlockType, type Block, type SnippetContext } from '../type';
import { useScriptStore } from '../store';
import { useShallow } from 'zustand/shallow';
import { Spinner } from '@/components/ui/spinner';

// Helper function to highlight snippets in content
function HighlightedContent({ 
    content, 
    snippets, 
    className 
}: { 
    content: string; 
    snippets: SnippetContext[]; 
    className?: string;
}) {
    const highlightedContent = useMemo(() => {
        if (snippets.length === 0) {
            return <span className={className}>{content}</span>;
        }

        // Find all snippet matches and their positions
        const matches: { start: number; end: number; snippet: SnippetContext }[] = [];
        
        for (const snippet of snippets) {
            let startIndex = 0;
            while (true) {
                const index = content.indexOf(snippet.content, startIndex);
                if (index === -1) break;
                matches.push({ 
                    start: index, 
                    end: index + snippet.content.length,
                    snippet 
                });
                startIndex = index + 1;
            }
        }

        if (matches.length === 0) {
            return <span className={className}>{content}</span>;
        }

        // Sort by start position
        matches.sort((a, b) => a.start - b.start);

        // Build highlighted content
        const parts: React.ReactNode[] = [];
        let lastEnd = 0;

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            
            // Skip overlapping matches
            if (match.start < lastEnd) continue;

            // Add text before this match
            if (match.start > lastEnd) {
                parts.push(
                    <span key={`text-${i}`}>
                        {content.slice(lastEnd, match.start)}
                    </span>
                );
            }

            // Add highlighted match
            parts.push(
                <mark 
                    key={`highlight-${i}`} 
                    className="bg-amber-300/50 text-inherit rounded-sm px-0.5 -mx-0.5"
                >
                    {content.slice(match.start, match.end)}
                </mark>
            );

            lastEnd = match.end;
        }

        // Add remaining text
        if (lastEnd < content.length) {
            parts.push(
                <span key="text-end">{content.slice(lastEnd)}</span>
            );
        }

        return <span className={className}>{parts}</span>;
    }, [content, snippets, className]);

    return highlightedContent;
}

type BlockProps = Block & {
    onContentChange: (content: string) => void; 
    onAddBlock: (type: BlockType) => void;
    onOpenAiEdit: () => void;
    snippets: SnippetContext[];
}

type CustomContentEditableProps = {
    onFocus: () => void;
    onBlur: () => void;
    onInput: (e: React.FormEvent<HTMLDivElement>) => void;
    contentRef: React.RefObject<HTMLDivElement | null>;
    isEditing: boolean;
}

type BaseBlockProps = BlockProps & {
    editableContent: React.ReactNode
    label?: string
    hideSubBlocks?: BlockType[]
    disableDelete?: boolean
    disableMenuBlock?: boolean
    customContentEditable?: (props: CustomContentEditableProps) => React.ReactNode
}

type BlockMenuOption = {
    label: string
    key: BlockType
    icon: React.ReactNode
}

type BlockActionMenuProps = {
    id: string;
    type: BlockType;
    onAddBlock: (type: BlockType) => void;
    parentId?: string;
    disableSubBlocks?: BlockType[];
    disableDelete?: boolean;
    className?: ClassValue;
}

export default function BlockEditor() {
        const {blocks, 
               addBlock, 
               updateBlock,
               addOrRemoveAiBlockContext,
               snippetContexts
            } = useScriptStore(
                useShallow(state => ({
                    blocks: state.blocks, 
                    addBlock: state.addBlock, 
                    updateBlock: state.updateBlock,
                    addOrRemoveAiBlockContext: state.addOrRemoveAiBlockContext,
                    snippetContexts: state.snippetContexts
                })))

  // Get snippets for a specific block
  const getSnippetsForBlock = useCallback((blockId: string) => {
    return snippetContexts.filter(s => s.sourceBlockId === blockId);
  }, [snippetContexts]);

  return (
    <div className='relative flex flex-col gap-8'>
        {blocks.map((block, index) => (
            <RenderBlock key={block.id} 
                   id={block.id}
                   content={block.content} 
                   onContentChange={(value) => updateBlock(block.id, value)} 
                   onAddBlock={(type) => addBlock(type, index, block.parentId)} 
                   onOpenAiEdit={() => addOrRemoveAiBlockContext(block)}
                   type={block.type}
                   snippets={getSnippetsForBlock(block.id)}
            />
        ))}
        <div className='h-[200px]' />
    </div>
  )
}


function RenderBlock(props: BlockProps){

    switch(props.type){
        case 'title':
            return <RenderBlockTitle {...props} />
        case 'logline':
            return <RenderBlockLogline {...props} />
        case 'segment':
            return <RenderBlockSegment {...props} />
        case 'scene':
            return <RenderBlockScene {...props} />
        case 'segmentSummary':
            return <RenderBlockSummary {...props} />
        default:
            return null;
    }
}

function BaseBlock(props: BaseBlockProps){

    const {id, 
          onContentChange, 
          onAddBlock, 
          onOpenAiEdit, 
          editableContent,
          label,
          hideSubBlocks, 
          disableDelete, 
          disableMenuBlock,
          customContentEditable
        } = props;
    
    const [isEditing, setIsEditing] = useState(false);
    const [selectionTooltip, setSelectionTooltip] = useState<{ x: number; y: number } | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isInAiContext = useScriptStore(state => state.aiBlockContext.some(b => b.id === id));
    const readonly = useScriptStore(state => state.readonly);
    const isStreaming = useScriptStore(state => state.isStreaming);
    const addSnippetContext = useScriptStore(state => state.addSnippetContext);

    const showActionMenu = !readonly && !disableMenuBlock;
    const showAiEditButton = !readonly && isInAiContext;
    const showAiBtnLoader = isStreaming && isInAiContext;

    // Find the scrollable parent container
    const getScrollContainer = useCallback((): HTMLElement | null => {
        let element = containerRef.current?.parentElement;
        while (element) {
            const style = getComputedStyle(element);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                return element;
            }
            element = element.parentElement;
        }
        return document.documentElement;
    }, []);

    // Scroll block into view, accounting for the sticky AI editor at the bottom
    const scrollBlockIntoView = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const scrollContainer = getScrollContainer();
        if (!scrollContainer) return;

        const rect = container.getBoundingClientRect();
        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const aiEditorHeight = 200; // Approximate height of the AI editor + padding
        const visibleBottom = scrollContainerRect.bottom - aiEditorHeight;

        // If the block's bottom is below the visible area (above AI editor)
        if (rect.bottom > visibleBottom) {
            const scrollAmount = rect.bottom - visibleBottom + 40; // Extra padding
            scrollContainer.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }
        // If the block's top is above the scroll container's top
        else if (rect.top < scrollContainerRect.top) {
            const scrollAmount = rect.top - scrollContainerRect.top - 20;
            scrollContainer.scrollBy({
                top: scrollAmount,
                behavior: 'smooth'
            });
        }
    }, [getScrollContainer]);

    // Handle text selection to show tooltip
    const handleSelectionChange = useCallback(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        const container = containerRef.current;

        if (selectedText && selectedText.length > 0 && container && selection?.anchorNode) {
            const isWithinBlock = container.contains(selection.anchorNode);
            if (isWithinBlock && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                
                setSelectionTooltip({
                    x: rect.left + rect.width / 2 - containerRect.left,
                    y: rect.top - containerRect.top - 8,
                });
                return;
            }
        }
        setSelectionTooltip(null);
    }, []);

    // Listen for selection changes
    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [handleSelectionChange]);

    // Handle Cmd+I / Ctrl+I to capture selected text as snippet
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();
            
            if (selectedText && selectedText.length > 0) {
                // Check if selection is within this block
                const container = containerRef.current;
                if (container && selection?.anchorNode) {
                    const isWithinBlock = container.contains(selection.anchorNode);
                    if (isWithinBlock) {
                        e.preventDefault();
                        addSnippetContext({
                            content: selectedText,
                            sourceBlockId: id,
                            sourceBlockType: props.type,
                        });
                        setSelectionTooltip(null);
                        // Clear selection after adding
                        window.getSelection()?.removeAllRanges();
                        // Scroll block into view after a short delay to let the AI editor appear
                        setTimeout(scrollBlockIntoView, 100);
                    }
                }
            }
        }
    }, [id, props.type, addSnippetContext, scrollBlockIntoView]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('keydown', handleKeyDown);
            return () => container.removeEventListener('keydown', handleKeyDown);
        }
    }, [handleKeyDown]);

    // Handle adding snippet via button click
    const handleAddSnippetClick = useCallback(() => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        
        if (selectedText && selectedText.length > 0) {
            addSnippetContext({
                content: selectedText,
                sourceBlockId: id,
                sourceBlockType: props.type,
            });
            setSelectionTooltip(null);
            window.getSelection()?.removeAllRanges();
            // Scroll block into view after a short delay to let the AI editor appear
            setTimeout(scrollBlockIntoView, 100);
        }
    }, [id, props.type, addSnippetContext, scrollBlockIntoView]);

    const handleContentFocus = () => {
        setIsEditing(true);
    }
    const handleContentBlur = () => {
        setIsEditing(false);
    }
    const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
        onContentChange(e.currentTarget.innerText);
    }

    // Handle adding block to AI context with scroll
    const handleOpenAiEdit = useCallback(() => {
        onOpenAiEdit();
        // Scroll block into view after a short delay to let the AI editor appear/update
        setTimeout(scrollBlockIntoView, 100);
    }, [onOpenAiEdit, scrollBlockIntoView]);

    // Detect if on Mac for correct shortcut display
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return (
        <div className="relative flex flex-col group" ref={containerRef}>

            {/* Selection Tooltip */}
            {selectionTooltip && !readonly && (
                <div 
                    className="absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                    style={{ 
                        left: selectionTooltip.x, 
                        top: selectionTooltip.y,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <button
                        onClick={handleAddSnippetClick}
                        className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
                    >
                        <Sparkles className="size-3 text-emerald-400" />
                        <span>Add to context</span>
                        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-[10px] text-zinc-400 font-mono">
                            {isMac ? '⌘' : 'Ctrl'}+I
                        </kbd>
                    </button>
                    {/* Tooltip arrow */}
                    <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 bg-zinc-900 border-r border-b border-zinc-700" />
                </div>
            )}

            <div className={cn('self-end absolute -right-4 -top-4 hidden group-hover:flex', showAiEditButton && 'flex')}>
                <Button size="icon" 
                        onClick={handleOpenAiEdit}
                        disabled={showAiBtnLoader}
                        className={cn('bg-emerald-500 rounded-full hover:bg-emerald-600', isInAiContext && 'bg-emerald-600 ring-2 ring-emerald-400/50')}
                >
                    {showAiBtnLoader ? <Spinner /> : <Sparkles className='h-4 w-4' />}
                </Button>
            </div>

            <div className={cn(
                'flex flex-col gap-2 px-4 py-2 group-hover:bg-emerald-500/10 rounded-md transition-colors',
                '[&_*::selection]:bg-emerald-400/40 [&_*::selection]:text-emerald-950',
                isInAiContext && 'bg-emerald-500/10 ring-1 ring-emerald-500/30', 
                readonly && 'group-hover:bg-transparent'
            )}>
                {label && (
                    <h2 className='text-gray-800 font-semibold'>{label}</h2>
                )}

                {
                    customContentEditable ? (
                        customContentEditable({onFocus: handleContentFocus, onBlur: handleContentBlur, onInput: handleContentInput, contentRef: contentRef, isEditing: isEditing})
                    ) : 
                    <div contentEditable={isEditing}
                         onFocus={handleContentFocus}
                         onBlur={handleContentBlur}
                         onInput={handleContentInput}
                         suppressContentEditableWarning
                         tabIndex={0}
                         ref={contentRef}
                    >
                        {editableContent}
                    </div>
                }

            </div>

            {
                showActionMenu && (
                    <div className='hidden group-hover:flex items-center absolute -bottom-8 w-full'>
                        <div className='h-px flex-1 bg-black' />
                        <BlockActionMenu onAddBlock={onAddBlock} 
                                         id={id}
                                         type={props.type}
                                         disableSubBlocks={hideSubBlocks} 
                                         disableDelete={disableDelete}
                        />
                        <div className='h-px flex-1 bg-black' />
                    </div>
                )
            }
        </div>
    )
}


function BlockActionMenu(props: BlockActionMenuProps){

    const {onAddBlock, id, type, className, disableSubBlocks, disableDelete=false } = props;

    const removeBlock = useScriptStore(state => state.removeBlock)

    const handleDelete = () => {
        if(disableDelete) return;
        if(type === 'segment'){
            const ok = confirm("Deleting the segment will remove all scenes with in it. Continue?")
            if(!ok) return;
        }
        removeBlock(id);
    }

    const options: BlockMenuOption[] = [
        {
            label: 'Segment',
            key: 'segment',
            icon: <IconCategoryPlus className="size-4" />
        },
        {
            label: 'Scene',
            key: 'scene',
            icon: <IconPlaylistAdd className="size-4" />
        }
    ]

    const filteredOptions = options.filter(option => !disableSubBlocks?.includes(option.key));

    return (
        <div className={cn('relative flex items-center justify-center gap-2 bg-gray-100 rounded-full', className)}>
            {filteredOptions.map((option) => (
                    <Button variant="ghost" className='rounded-full' key={option.key} onMouseDown={() => onAddBlock(option.key)}>
                        {option.icon}
                        {option.label}
                    </Button>
                ))
            }
            {
                !disableDelete && (
                    <Button variant="ghost" className='rounded-full' onClick={handleDelete}>
                        <IconTrash className="size-4"/>
                        Delete
                    </Button>
                )
            }
        </div>
    )
}

function RenderBlockTitle(props: BlockProps){
    const {content, snippets} = props;
    
    return (
        <BaseBlock {...props} 
                   editableContent={
                       <h1 className='text-2xl font-bold text-center text-gray-800'>
                           <HighlightedContent content={content} snippets={snippets} />
                       </h1>
                   }
                   disableMenuBlock
        />
    )
}

function RenderBlockLogline(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   label='Logline'
                   editableContent={
                       <p className='text-left'>
                           <HighlightedContent content={props.content} snippets={props.snippets} />
                       </p>
                   }
                   hideSubBlocks={['scene']}
                   disableDelete
        />
    )

}

function RenderBlockSegment(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   customContentEditable={({onFocus, onBlur, onInput, contentRef, isEditing}) => (
                    <div className='flex items-center gap-2'>
                        <div className='h-px flex-1 bg-gray-200' />
                        <h2 className='font-semibold text-center text-gray-800' 
                            onFocus={onFocus} 
                            onBlur={onBlur} 
                            onInput={onInput} 
                            ref={contentRef}
                            contentEditable={isEditing}
                            suppressContentEditableWarning
                            tabIndex={0}
                        >
                            <HighlightedContent content={props.content} snippets={props.snippets} />
                        </h2>
                        <div className='h-px flex-1 bg-gray-200' />
                    </div>
                   )}
                   hideSubBlocks={['segment', 'scene']}
                   editableContent={null}
        />
    )

}
function RenderBlockScene(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   label='Scene'
                   editableContent={
                       <p className='text-left'>
                           <HighlightedContent content={props.content} snippets={props.snippets} />
                       </p>
                   }
        />
    )
}

function RenderBlockSummary(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   editableContent={
                       <p className='text-left italic'>
                           <HighlightedContent content={props.content} snippets={props.snippets} />
                       </p>
                   }
                   hideSubBlocks={['segment']}
        />
    )
}