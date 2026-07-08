import { cn } from "@/lib/utils";
import { motion } from "motion/react";

export function DotsLoader({bgColor}: {bgColor?: string}) {
    return (
        <span className="flex gap-1">
            <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]", bgColor)} />
            <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]", bgColor)} />
            <span className={cn("size-1.5 rounded-full bg-muted-foreground animate-bounce", bgColor)} />
        </span>
    )
}

export function TypingCursor() {
    return (
        <span className="inline-block w-2 h-4 bg-foreground animate-pulse" />
    )
}

export function TextShimmerCss({ text, className }: { text: string; className?: string }) {
    return (
        <span className={cn('inline-block text-sm font-medium text-muted-foreground animate-shimmer', className)}>
            {text}
        </span>
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


export const SphereLoader = ({
    isLoading,
    size = 120,
    className,
    showRings = true,
}: {
    isLoading: boolean;
    size?: number;
    className?: string;
    showRings?: boolean;
}) => {
    // Three tilted orbital rings, each carrying a glowing particle.
    const orbits = [
        { tilt: 0, dur: 2.4, delay: 0, scaleY: 0.42, color: "oklch(0.85 0.20 148)" },
        { tilt: 60, dur: 3.1, delay: -0.6, scaleY: 0.34, color: "oklch(0.78 0.18 175)" },
        { tilt: 120, dur: 2.8, delay: -1.2, scaleY: 0.5, color: "oklch(0.72 0.17 200)" },
    ];

    return (
        <div
            className={cn("relative shrink-0", className)}
            style={{ width: size, height: size }}
        >
            {/* Expanding energy pulses (only while loading) */}
            {showRings &&
                isLoading &&
                [0, 1, 2].map((i) => (
                    <motion.div
                        key={`pulse-${i}`}
                        className="absolute inset-0 rounded-full"
                        style={{
                            border: `${size * 0.015}px solid oklch(0.80 0.20 150 / 0.5)`,
                        }}
                        animate={{ scale: [0.6, 1.5], opacity: [0, 0.6, 0] }}
                        transition={{
                            duration: 2.4,
                            repeat: Infinity,
                            ease: "easeOut",
                            delay: i * 0.8,
                        }}
                    />
                ))}

            {/* Ambient outer glow, breathing faster when loading */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    inset: -size * 0.1,
                    background:
                        "radial-gradient(circle, oklch(0.80 0.22 150 / 0.35) 0%, transparent 70%)",
                }}
                animate={
                    isLoading
                        ? { opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.08, 0.95] }
                        : { opacity: 0.35, scale: 1 }
                }
                transition={
                    isLoading
                        ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.4 }
                }
            />

            {/* Morphing plasma core */}
            <motion.div
                className="absolute"
                style={{
                    inset: size * 0.22,
                    background:
                        "conic-gradient(from 0deg, oklch(0.88 0.22 148), oklch(0.75 0.18 175), oklch(0.66 0.16 205), oklch(0.80 0.21 130), oklch(0.88 0.22 148))",
                    boxShadow: `0 0 ${size * 0.25}px oklch(0.80 0.22 150 / 0.7)`,
                }}
                animate={
                    isLoading
                        ? {
                              rotate: 360,
                              borderRadius: [
                                  "42% 58% 63% 37% / 41% 44% 56% 59%",
                                  "63% 37% 42% 58% / 59% 56% 44% 41%",
                                  "42% 58% 63% 37% / 41% 44% 56% 59%",
                              ],
                              scale: [1, 1.08, 1],
                          }
                        : { rotate: 0, borderRadius: "50%", scale: 1 }
                }
                transition={
                    isLoading
                        ? {
                              rotate: { duration: 2.2, repeat: Infinity, ease: "linear" },
                              borderRadius: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                              scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
                          }
                        : { duration: 0.5 }
                }
            />

            {/* Glass specular highlight */}
            <div
                className="absolute rounded-full opacity-70"
                style={{
                    width: size * 0.32,
                    height: size * 0.18,
                    top: size * 0.24,
                    left: size * 0.3,
                    background:
                        "radial-gradient(ellipse at center, rgba(255,255,255,0.9) 0%, transparent 100%)",
                    filter: `blur(${size * 0.03}px)`,
                }}
            />

            {/* Orbiting particles on tilted rings */}
            {orbits.map((o, i) => (
                <motion.div
                    key={`orbit-${i}`}
                    className="absolute inset-0"
                    style={{ transform: `rotate(${o.tilt}deg)` }}
                >
                    <motion.div
                        className="absolute inset-0"
                        style={{ transformOrigin: "50% 50%" }}
                        animate={{ rotate: isLoading ? 360 : 0 }}
                        transition={
                            isLoading
                                ? {
                                      duration: o.dur,
                                      repeat: Infinity,
                                      ease: "linear",
                                      delay: o.delay,
                                  }
                                : { duration: 0.5 }
                        }
                    >
                        {/* the tilted elliptical path a particle rides on */}
                        <div
                            className="absolute left-1/2 top-1/2"
                            style={{
                                width: size,
                                height: size,
                                transform: `translate(-50%, -50%) scaleY(${o.scaleY})`,
                            }}
                        >
                            <motion.div
                                className="absolute left-1/2 top-0 rounded-full"
                                style={{
                                    width: size * 0.11,
                                    height: size * 0.11,
                                    marginLeft: -size * 0.055,
                                    background: o.color,
                                    boxShadow: `0 0 ${size * 0.14}px ${o.color}`,
                                }}
                                animate={
                                    isLoading
                                        ? { scale: [1, 1.35, 1] }
                                        : { scale: 1 }
                                }
                                transition={
                                    isLoading
                                        ? {
                                              duration: 1,
                                              repeat: Infinity,
                                              ease: "easeInOut",
                                          }
                                        : { duration: 0.3 }
                                }
                            />
                        </div>
                    </motion.div>
                </motion.div>
            ))}
        </div>
    );
};