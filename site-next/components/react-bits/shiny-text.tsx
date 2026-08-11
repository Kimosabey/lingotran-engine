"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, useAnimationFrame, useTransform } from "motion/react";

/**
 * ShinyText — vendored from React Bits (reactbits.dev), MIT.
 * Source: github.com/DavidHDev/react-bits → src/ts-tailwind/TextAnimations/ShinyText
 *
 * Kept faithful to the original API (text, speed, spread, direction, yoyo,
 * delay, pauseOnHover, color, shineColor, disabled) so it can be diffed against
 * upstream, with two integration changes, both marked INTEGRATION below:
 *
 *  1. `color` / `shineColor` accept CSS custom properties, not just hex. The
 *     original bakes literal colours into the gradient, which would have
 *     hard-coded one theme's palette; passing `var(--link)` lets the sweep flip
 *     with the site's light-dark() tokens at zero cost.
 *  2. The upstream `useAnimationFrame` runs unconditionally for the life of the
 *     page. That is fine for a hero, but this instance lives in the footer —
 *     below the fold on every route — so it would burn a callback every frame
 *     forever for something nobody is looking at. The caller gates it via the
 *     component's own `disabled` prop (see components/byline.tsx); nothing about
 *     the animation logic is altered.
 */
interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  /** INTEGRATION: any CSS colour, including var(--token). */
  color?: string;
  /** INTEGRATION: any CSS colour, including var(--token). */
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: "left" | "right";
  delay?: number;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 2,
  className = "",
  color = "#b5b5b5",
  shineColor = "#ffffff",
  spread = 120,
  yoyo = false,
  pauseOnHover = false,
  direction = "left",
  delay = 0,
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const directionRef = useRef(direction === "left" ? 1 : -1);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame((time) => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;

    if (yoyo) {
      const cycleDuration = animationDuration + delayDuration;
      const fullCycle = cycleDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      if (cycleTime < animationDuration) {
        const p = (cycleTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? p : 100 - p);
      } else if (cycleTime < cycleDuration) {
        progress.set(directionRef.current === 1 ? 100 : 0);
      } else if (cycleTime < cycleDuration + animationDuration) {
        const reverseTime = cycleTime - cycleDuration;
        const p = 100 - (reverseTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? p : 100 - p);
      } else {
        progress.set(directionRef.current === 1 ? 0 : 100);
      }
    } else {
      const cycleDuration = animationDuration + delayDuration;
      const cycleTime = elapsedRef.current % cycleDuration;
      if (cycleTime < animationDuration) {
        const p = (cycleTime / animationDuration) * 100;
        progress.set(directionRef.current === 1 ? p : 100 - p);
      } else {
        progress.set(directionRef.current === 1 ? 100 : 0);
      }
    }
  });

  useEffect(() => {
    directionRef.current = direction === "left" ? 1 : -1;
    elapsedRef.current = 0;
    progress.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  // p=0 -> 150% (shine off right), p=100 -> -50% (shine off left)
  const backgroundPosition = useTransform(progress, (p: number) => `${150 - p * 2}% center`);

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const gradientStyle: React.CSSProperties = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  return (
    <motion.span
      className={`inline-block ${className}`}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  );
};

export default ShinyText;
