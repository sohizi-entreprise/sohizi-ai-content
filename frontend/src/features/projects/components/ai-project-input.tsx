import { useState } from "react";
import { Sparkles, Link2, Settings2, LayoutGrid, X, ArrowUp, Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

type Props = {
    onSubmit: (prompt: string) => void;
    onClose: () => void;
    className?: ClassValue;
}

export default function AiProjectInput(props: Props){

    const {onSubmit, onClose, className} = props;

    const [prompt, setPrompt] = useState('');

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (prompt.trim()) onSubmit(prompt);
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div className={cn('w-[640px] max-w-[90vw] font-geist bg-zinc-900 border border-zinc-700/50 flex flex-col rounded-2xl fixed bottom-8 left-1/2 -translate-x-1/2 z-50 shadow-2xl shadow-black/50', className)}>
            {/* Input Area */}
            <div className='relative flex items-start gap-3 p-5 pb-3'>
                <Sparkles className='size-5 text-violet-400 mt-1 shrink-0' />
                <Textarea 
                    className='flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 text-base resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-none p-0 min-h-[80px]' 
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
                    <button className='flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-sm'>
                        <Link2 className='size-4' />
                        <span>Attach</span>
                    </button>
                    <div className='w-px h-4 bg-zinc-700 mx-1' />
                    <button className='flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-sm'>
                        <Settings2 className='size-4' />
                        <span>Settings</span>
                    </button>
                    <div className='w-px h-4 bg-zinc-700 mx-1' />
                    <button className='flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-sm'>
                        <LayoutGrid className='size-4' />
                        <span>Options</span>
                    </button>
                </div>

                {/* Right Actions */}
                <div className='flex items-center gap-2'>
                    <button 
                        onClick={onClose}
                        className='size-10 flex items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors'
                    >
                        <X className='size-5' />
                    </button>
                    <button 
                        className='size-10 flex items-center justify-center rounded-full bg-zinc-700/50 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors'
                    >
                        <Mic className='size-5' />
                    </button>
                    <button 
                        onClick={() => prompt.trim() && onSubmit(prompt)}
                        disabled={!prompt.trim()}
                        className='size-10 flex items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-fuchsia-600 text-white hover:from-violet-400 hover:to-fuchsia-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25'
                    >
                        <ArrowUp className='size-5' />
                    </button>
                </div>
            </div>
        </div>
    )
}