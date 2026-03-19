import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type CSSProperties } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  title?: string;
  minOverflowPx?: number;
  gapPx?: number;
  speedPxPerSecond?: number;
}

export const MarqueeText = ({
  text,
  className,
  title,
  minOverflowPx = 4,
  gapPx = 32,
  speedPxPerSecond = 48,
}: MarqueeTextProps) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [overflowState, setOverflowState] = useState({
    isOverflowing: false,
    distancePx: 0,
    durationSeconds: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    const measure = () => {
      const containerWidth = container.clientWidth;
      const contentWidth = content.scrollWidth;
      const isOverflowing = contentWidth > containerWidth + minOverflowPx;

      if (!isOverflowing) {
        setOverflowState((previous) =>
          previous.isOverflowing
            ? { isOverflowing: false, distancePx: 0, durationSeconds: 0 }
            : previous,
        );
        return;
      }

      const distancePx = contentWidth + gapPx;
      const durationSeconds = Math.max(
        8,
        Math.min(24, distancePx / speedPxPerSecond),
      );

      setOverflowState((previous) => {
        if (
          previous.isOverflowing === isOverflowing &&
          previous.distancePx === distancePx &&
          previous.durationSeconds === durationSeconds
        ) {
          return previous;
        }

        return { isOverflowing, distancePx, durationSeconds };
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    resizeObserver.observe(content);

    return () => {
      resizeObserver.disconnect();
    };
  }, [gapPx, minOverflowPx, speedPxPerSecond, text]);

  const animationStyle = overflowState.isOverflowing
    ? ({
        "--marquee-distance": `${overflowState.distancePx}px`,
        "--marquee-duration": `${overflowState.durationSeconds}s`,
        "--marquee-gap": `${gapPx}px`,
      } as CSSProperties)
    : undefined;

  return (
    <span
      ref={containerRef}
      className={cn(
        "player-marquee",
        overflowState.isOverflowing && "player-marquee-overflowing",
        className,
      )}
      title={title ?? text}
    >
      <span
        className={cn(
          "player-marquee-track",
          overflowState.isOverflowing && "player-marquee-track-running",
        )}
        style={animationStyle}
      >
        <span ref={contentRef} className="player-marquee-item">
          {text}
        </span>
        {overflowState.isOverflowing ? (
          <span aria-hidden className="player-marquee-item">
            {text}
          </span>
        ) : null}
      </span>
    </span>
  );
};
