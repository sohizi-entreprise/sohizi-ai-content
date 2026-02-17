import { useState } from "react";
import { Sparkles, X, ArrowUp, Mic, Quote } from "lucide-react";
import { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/shallow";
import { useScriptStore } from "../store";
import { BlockType, SnippetContext } from "../type";
import { z } from "zod";
import { useHandleScriptStream } from "../hooks/use-handle-script-stream";

type Props = {
    className?: ClassValue;
    projectId: string;
}

export const correctScriptSchema = z.array(
    z.object({
        id: z.string().describe("Unique identifier for the part. The same id that will be sent from the user"),
        content: z.string().describe("New corrected content of the part"),
    })
)

export default function AiBlockEditor(props: Props){

    const {className, projectId} = props;
    const [prompt, setPrompt] = useState('');

    const {
        aiBlockContext, 
        clearAiBlockContext,
        snippetContexts, 
        removeSnippetContext, 
        clearSnippetContexts,
        isStreaming
    } = useScriptStore(useShallow(state => ({
        aiBlockContext: state.aiBlockContext, 
        clearAiBlockContext: state.clearAiBlockContext,
        snippetContexts: state.snippetContexts,
        removeSnippetContext: state.removeSnippetContext,
        clearSnippetContexts: state.clearSnippetContexts,
        isStreaming: state.isStreaming,
    })))


    const {startStream} = useHandleScriptStream(projectId)

    const handleSubmit = () => {
        if (!prompt.trim()) return;
        // const payload = JSON.stringify({
        //     userRequest: prompt,
        //     partsToEdit: JSON.stringify(aiBlockContext.map(block => block.id)),
        //     snippets: JSON.stringify(snippetContexts),
        // })
        startStream(prompt);
        setPrompt('');
        clearSnippetContexts();
        clearAiBlockContext();
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            clearAiBlockContext();
            clearSnippetContexts();
        }
    };

    const handleClearAll = () => {
        clearAiBlockContext();
        clearSnippetContexts();
    };

    const displayContext = aiBlockContext.reduce((acc, block) => {
        acc[block.type] = (acc[block.type] || 0) + 1;
        return acc;
    }, {} as Record<BlockType, number>);

    const disableButton = !prompt.trim() || isStreaming;
    const disableVoice = isStreaming;

    return (
        <>
            {/* Context Display - Scrollable */}
            <div className={cn('w-full font-geist', className)}>
                {/* Snippet Contexts */}
                {snippetContexts.length > 0 && (
                    <div className='mb-4'>
                        <div className='flex flex-col gap-2'>
                            {snippetContexts.map((snippet) => (
                                <SnippetContextItem 
                                    key={snippet.id} 
                                    snippet={snippet} 
                                    onRemove={() => removeSnippetContext(snippet.id)} 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Block Context Display */}
                {aiBlockContext.length > 0 && (
                    <div className='flex flex-wrap gap-2'>
                        {Object.entries(displayContext).map(([type, count]) => (
                            <div key={type} 
                                className='flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30'>
                                <span>{type}</span>
                                {count > 1 && (
                                    <span>{count}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area - Fixed at Bottom */}
            <div className='w-full font-geist bg-zinc-800/30 border rounded-lg border-zinc-700/50 flex flex-col p-2'>
                {/* Input Area */}
                <div className='relative flex items-start gap-3 mb-3'>
                    <Sparkles className='size-5 text-emerald-400 mt-1 shrink-0' />
                    <textarea 
                        className='flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 text-sm resize-none focus:outline-none border-none p-0 min-h-[80px] max-h-[140px]' 
                        placeholder='Request changes...' 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isStreaming}
                    />
                </div>
                
                {/* Bottom Toolbar */}
                <div className='flex items-center justify-end gap-2'>
                    <button 
                        onClick={handleClearAll}
                        disabled={isStreaming}
                        className='size-8 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <X className='size-4' />
                    </button>
                    <button 
                        disabled={disableVoice}
                        className='size-8 flex items-center justify-center rounded-full bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        <Mic className='size-4' />
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={disableButton}
                        className='size-8 flex items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-green-600 text-white hover:from-emerald-500 hover:to-green-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25'
                    >
                        <ArrowUp className='size-4' />
                    </button>
                </div>
            </div>
        </>
    )
}

// Snippet Context Item Component
function SnippetContextItem({ snippet, onRemove }: { snippet: SnippetContext; onRemove: () => void }) {
    return (
        <div className='group relative flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20'>
            <Quote className='size-3 text-amber-400 mt-0.5 shrink-0' />
            <p className='text-xs text-zinc-300 leading-relaxed line-clamp-2 flex-1'>
                {snippet.content}
            </p>
            <button
                onClick={onRemove}
                className='size-5 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100'
            >
                <X className='size-3' />
            </button>
            <span className='absolute -bottom-0.5 right-2 text-[10px] text-amber-500/60 capitalize'>
                from {snippet.sourceBlockType}
            </span>
        </div>
    )
}