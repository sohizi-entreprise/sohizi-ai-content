import { useState } from "react";
import { Sparkles, X, ArrowUp, Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { useShallow } from "zustand/shallow";
import { useScriptStore } from "../store";
import { BlockType } from "../type";

type Props = {
    className?: ClassValue;
}

export default function AiBlockEditor(props: Props){

    const {className} = props;

    const {aiBlockContext, clearAiBlockContext} = useScriptStore(useShallow(state => ({aiBlockContext: state.aiBlockContext, clearAiBlockContext: state.clearAiBlockContext})))

    const [prompt, setPrompt] = useState('');

    const handleSubmit = () => {
        if (!prompt.trim()) return;
        console.log('submit to ai', prompt);
        console.log('ai block context', aiBlockContext);
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
        if (e.key === 'Escape') {
            clearAiBlockContext();
        }
    };

    const displayContext = aiBlockContext.reduce((acc, block) => {
        acc[block.type] = (acc[block.type] || 0) + 1;
        return acc;
    }, {} as Record<BlockType, number>);

    const disableButton = !prompt.trim();

    if(aiBlockContext.length === 0) return null;

    return (
        <div className={cn('w-[640px] max-w-[90vw] font-geist bg-zinc-900 border border-zinc-700/50 flex flex-col rounded-2xl shadow-2xl shadow-black/50', className)}>
            {/* Input Area */}
            <div className='relative flex items-start gap-3 p-5 pb-3'>
                <Sparkles className='size-5 text-green-400 mt-1 shrink-0' />
                <Textarea 
                    className='flex-1 bg-transparent! text-zinc-100 placeholder:text-zinc-500 text-base resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-none p-0 min-h-[80px]' 
                    placeholder='Request Changes...' 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />
            </div>
            
            {/* Bottom Toolbar */}
            <div className='flex items-center justify-between px-4 pb-4'>
                {/* Left Actions */}
                <div className='flex items-center gap-1 text-zinc-400'>
                    {Object.entries(displayContext).map(([type, count]) => (
                        <div key={type} 
                                className='flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-green-100 text-green-800 font-medium'>
                            <span>{type}</span>
                            {count > 1 && (
                                <span>{count}</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Actions */}
                <div className='flex items-center gap-2'>
                    <button 
                        onClick={clearAiBlockContext}
                        className='size-8 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors'
                    >
                        <X className='size-4' />
                    </button>
                    <button 
                        className='size-8 flex items-center justify-center rounded-full bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors'
                    >
                        <Mic className='size-4' />
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={disableButton}
                        className='size-8 flex items-center justify-center rounded-full bg-linear-to-br from-green-300 to-green-600 text-white hover:from-green-400 hover:to-green-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-green-500/25'
                    >
                        <ArrowUp className='size-4' />
                    </button>
                </div>
            </div>
        </div>
    )
}