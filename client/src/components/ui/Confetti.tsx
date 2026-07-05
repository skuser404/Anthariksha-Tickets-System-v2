import { motion } from 'framer-motion';

const COLORS = ['#3479ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

/**
 * Lightweight confetti burst (no dependency). Render conditionally; it animates
 * once and is purely decorative (pointer-events: none).
 */
export function Confetti({ count = 80 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => i);
  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden" aria-hidden>
      {pieces.map((i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const duration = 1.6 + Math.random() * 1.2;
        const size = 6 + Math.random() * 8;
        const rotate = Math.random() * 360;
        return (
          <motion.span
            key={i}
            initial={{ y: -40, x: 0, opacity: 1, rotate }}
            animate={{ y: '110vh', x: (Math.random() - 0.5) * 200, rotate: rotate + 360, opacity: [1, 1, 0] }}
            transition={{ duration, delay, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              top: 0,
              left: `${left}%`,
              width: size,
              height: size * 0.5,
              borderRadius: 2,
              background: COLORS[i % COLORS.length],
            }}
          />
        );
      })}
    </div>
  );
}
