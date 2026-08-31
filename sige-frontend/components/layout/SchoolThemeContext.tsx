'use client';

import { createContext, useContext } from 'react';

export type SchoolThemeKey = 'azul' | 'rojo' | 'verde' | 'amarillo';

export interface SchoolThemeValue {
  key: SchoolThemeKey;
  primary: string;
  secondary: string;
  hover: string;
  soft: string;
  strong: string;
  sidebar: string;
  contrast: string;
  action: string;
  actionHover: string;
  actionContrast: string;
}

export const BLUE_SCHOOL_THEME: SchoolThemeValue = {
  key: 'azul', primary: '#2563EB', secondary: '#16A8E4', hover: '#1D4ED8',
  soft: '#E8F0FF', strong: '#173A8F', sidebar: '#071A3D', contrast: '#FFFFFF',
  action: '#2563EB', actionHover: '#1D4ED8', actionContrast: '#FFFFFF',
};

export const SCHOOL_THEMES: Record<SchoolThemeKey, SchoolThemeValue> = {
  azul: BLUE_SCHOOL_THEME,
  rojo: {
    key: 'rojo', primary: '#D34242', secondary: '#F06A62', hover: '#B72F37',
    soft: '#FDEDEE', strong: '#7F1D1D', sidebar: '#3A0C12', contrast: '#FFFFFF',
    action: '#C9363F', actionHover: '#A92831', actionContrast: '#FFFFFF',
  },
  verde: {
    key: 'verde', primary: '#168A55', secondary: '#35B979', hover: '#0F7044',
    soft: '#E8F7EF', strong: '#0A5735', sidebar: '#062D20', contrast: '#FFFFFF',
    action: '#117447', actionHover: '#0B5C37', actionContrast: '#FFFFFF',
  },
  amarillo: {
    key: 'amarillo', primary: '#D99000', secondary: '#F2B72B', hover: '#B87700',
    soft: '#FFF5D9', strong: '#6B4300', sidebar: '#362500', contrast: '#172033',
    action: '#8A5700', actionHover: '#704600', actionContrast: '#FFFFFF',
  },
};

export function getSchoolTheme(primary?: string, secondary?: string): SchoolThemeValue {
  const normalized = (primary || '').trim().toLowerCase();
  const key: SchoolThemeKey = ['#d34242', '#dc2626', '#ef4444'].includes(normalized) ? 'rojo'
    : ['#168a55', '#16a34a', '#22c55e'].includes(normalized) ? 'verde'
    : ['#d99000', '#ca8a04', '#eab308'].includes(normalized) ? 'amarillo'
    : 'azul';
  const preset = SCHOOL_THEMES[key];
  return { ...preset, primary: primary || preset.primary, secondary: secondary || preset.secondary };
}

const SchoolThemeContext = createContext<SchoolThemeValue>(BLUE_SCHOOL_THEME);

export function SchoolThemeProvider({ value, children }: { value: SchoolThemeValue; children: React.ReactNode }) {
  return <SchoolThemeContext.Provider value={value}>{children}</SchoolThemeContext.Provider>;
}

export function useSchoolTheme() {
  return useContext(SchoolThemeContext);
}
