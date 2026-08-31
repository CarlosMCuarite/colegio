'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { useSchoolTheme } from '../layout/SchoolThemeContext';

export type OwlMood = 'welcome' | 'celebrating' | 'concerned' | 'proud' | 'studying' | 'thinking';

interface SigeOwlProps {
  mood?: OwlMood;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  priority?: boolean;
  label?: string;
}

export default function SigeOwl({ mood = 'welcome', size = 'md', className, priority = false, label }: SigeOwlProps) {
  const reduceMotion = useReducedMotion();
  const schoolTheme = useSchoolTheme();

  return (
    <motion.figure
      className={clsx('sige-owl', `sige-owl--${size}`, `sige-owl--${mood}`, className)}
      initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(10px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: .44, ease: [0.16, 1, 0.3, 1] }}
      aria-label={label ?? `Búho SIGE ${mood}`}
    >
      <span className="sige-owl__aura" aria-hidden="true" />
      <span className="sige-owl__character">
        <Image src={`/brand/owl/${schoolTheme.key}/${mood}.png`} alt="" fill priority={priority} sizes="(max-width: 768px) 180px, 420px" />
        <span className="sige-owl__chest-light" aria-hidden="true" />
      </span>
      <span className="sige-owl__shadow" aria-hidden="true" />
    </motion.figure>
  );
}
