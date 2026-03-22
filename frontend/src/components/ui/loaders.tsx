import { motion } from "motion/react";

export function DotsLoader() {
    return (
        <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
            <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" />
        </span>
    )
}

export function TypingCursor() {
    return (
        <span className="inline-block w-2 h-4 bg-foreground animate-pulse" />
    )
}
  
export const TextShimmer = ({ text }: { text: string }) => {
return (
    <div className="font-sans font-bold [--shadow-color:var(--color-neutral-500)] dark:[--shadow-color:var(--color-neutral-100)]">
    {text.split("").map((char, i) => (
        <motion.span
        key={i}
        className="inline-block"
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{
            scale: [1, 1.1, 1],
            textShadow: [
            "0 0 0 var(--shadow-color)",
            "0 0 1px var(--shadow-color)",
            "0 0 0 var(--shadow-color)",
            ],
            opacity: [0.5, 1, 0.5],
        }}
        transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * 0.05,
            ease: "easeInOut" as const,
            repeatDelay: 2,
        }}
        >
        {char === " " ? "\u00A0" : char}
        </motion.span>
    ))}
    </div>
);
};