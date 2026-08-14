import { createTikTokStyleCaptions } from '@remotion/captions';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { useMemo } from 'react';
import { whisperToCaptions } from './whisper-to-caption';
import type { CaptionClip } from './types';

export const CaptionsRenderer = ({ clip }: { clip: CaptionClip }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const timeMs = (frame / fps) * 1000;


    const {captions} = useMemo(() => whisperToCaptions({ transcription: clip.captions }), [clip.captions]);
  
    const { pages } = createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: 500, // Word-by-word
    });

    const {
        fontSize=48,
        color='#ffffff',
        fontWeight='bold',
        align='center',
        opacity=1,
        xRatio=0.5,
        yRatio=0.85,
        widthRatio=0.7,
        heightRatio=0.18,
        hightlightColor='#FFD700',
    } = clip.properties
  
    const currentPage = pages.find(
      page => timeMs >= page.startMs && timeMs < page.startMs + page.durationMs
    );
  
    return (
      <div style={{
        position: 'absolute',
        left: `${xRatio * 100}%`,
        top: `${yRatio * 100}%`,
        width: `${widthRatio * 100}%`,
        height: `${heightRatio * 100}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
        fontSize,
        fontWeight,
        textAlign: align,
        whiteSpace: 'pre',
        opacity,
        pointerEvents: 'none',
      }}>
        {currentPage?.tokens.map((token, i) => {
          const isActive = timeMs >= token.fromMs && timeMs < token.toMs;
          const wordStartFrame = (token.fromMs / 1000) * fps;
          const bounce = spring({
            frame: frame - wordStartFrame,
            fps,
            config: { damping: 10, mass: 0.5 },
          });
  
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                transform: `scale(${isActive ? bounce : 1})`,
                color: isActive ? hightlightColor : color,
                backgroundColor: isActive ? 'rgba(0,0,0,0.8)' : 'transparent',
                padding: isActive ? '4px 8px' : '0',
                borderRadius: isActive ? '4px' : '0',
                textShadow: isActive 
                  ? '0 0 10px #FFD700, 2px 2px 4px rgba(0,0,0,0.8)'
                  : '2px 2px 4px rgba(0,0,0,0.8)',
                margin: '0 2px',
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    );
  };
