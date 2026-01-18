
import { Button } from '@/components/ui/button';
import { IconCategoryPlus, IconPlaylistAdd, IconTrash } from '@tabler/icons-react';
import { ClassValue } from 'clsx';
import { Sparkles} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRef, useState } from 'react';
import AiBlockEditor from './ai-block-editor';
import { BlockType, type Block } from '../type';
import { useScriptStore } from '../store';
import { useShallow } from 'zustand/shallow';
import { Spinner } from '@/components/ui/spinner';

type BlockProps = Block & {
    onContentChange: (content: string) => void; 
    onAddBlock: (type: BlockType) => void;
    onOpenAiEdit: () => void;
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
               addOrRemoveAiBlockContext
            } = useScriptStore(
                useShallow(state => ({
                    blocks: state.blocks, 
                    addBlock: state.addBlock, 
                    updateBlock: state.updateBlock,
                    addOrRemoveAiBlockContext: state.addOrRemoveAiBlockContext
                })))


  return (
    <div className='flex flex-col gap-8'>
        {blocks.map((block, index) => (
            <RenderBlock key={block.id} 
                   id={block.id}
                   content={block.content} 
                   onContentChange={(value) => updateBlock(block.id, value)} 
                   onAddBlock={(type) => addBlock(type, index, block.parentId)} 
                   onOpenAiEdit={() => addOrRemoveAiBlockContext(block)}
                   type={block.type}
            />
        ))}
        <AiBlockEditor className='fixed bottom-8 left-[calc(50%+3.5rem)] -translate-x-1/2 z-50' />
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
        case 'summary':
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
    const contentRef = useRef<HTMLDivElement>(null);

    const isInAiContext = useScriptStore(state => state.aiBlockContext.some(b => b.id === id));
    const readonly = useScriptStore(state => state.readonly);
    const isStreaming = useScriptStore(state => state.isStreaming);

    const showActionMenu = !readonly && !disableMenuBlock;
    const showAiEditButton = !readonly && isInAiContext;
    const showAiBtnLoader = isStreaming && isInAiContext;



    const handleContentFocus = () => {
        setIsEditing(true);
    }
    const handleContentBlur = () => {
        setIsEditing(false);
    }
    const handleContentInput = (e: React.FormEvent<HTMLDivElement>) => {
        onContentChange(e.currentTarget.innerText);
    }

    return (
        <div className="relative flex flex-col group">

            <div className={cn('self-end absolute -right-4 -top-4 hidden group-hover:flex', showAiEditButton && 'flex')}>
                <Button size="icon" 
                        onClick={onOpenAiEdit}
                        disabled={showAiBtnLoader}
                        className={cn('bg-green-500 rounded-full hover:bg-green-600', isInAiContext && 'bg-green-500')}
                >
                    {showAiBtnLoader ? <Spinner /> : <Sparkles className='h-4 w-4' />}
                </Button>
            </div>

            <div className={cn('flex flex-col gap-2 px-4 py-2 group-hover:bg-green-50 rounded-md', isInAiContext && 'bg-green-50', readonly && 'group-hover:bg-transparent')}>
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
    const {content} = props;
    
    return (
        <BaseBlock {...props} 
                   editableContent={<h1 className='text-2xl font-bold text-center text-gray-800'>{content}</h1>}
                   disableMenuBlock
        />
    )
}

function RenderBlockLogline(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   label='Logline'
                   editableContent={<p className='text-left'>{props.content}</p>}
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
                            {props.content}
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
                   editableContent={<p className='text-left'>{props.content}</p>}
        />
    )
}

function RenderBlockSummary(props: BlockProps){
    return (
        <BaseBlock {...props} 
                   editableContent={<p className='text-left italic'>{props.content}</p>}
                   hideSubBlocks={['segment']}
        />
    )
}