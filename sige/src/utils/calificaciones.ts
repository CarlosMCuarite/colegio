// src/utils/calificaciones.ts
// Escala oficial MINEDU (Currículo Nacional de Educación Básica, RVM
// 00094-2020-MINEDU): AD (logro destacado), A (logro esperado), B (en
// proceso), C (en inicio). Inicial usa solo A/B/C (no existe AD en
// inicial); Primaria usa AD/A/B/C; Secundaria usa la escala numérica 0-20,
// que MINEDU mapea a las mismas 4 bandas para fines de equivalencia:
//   AD = 18-20 · A = 14-17 · B = 11-13 · C = 0-10
// Se guarda SIEMPRE un valor numérico (real en secundaria, "equivalente" —
// el punto medio de la banda — en inicial/primaria) para poder promediar de
// forma consistente entre bimestres sin tener que promediar letras.
import { NivelEducativo, CalificacionLiteral } from '@prisma/client';

export const BANDAS: { literal: CalificacionLiteral; min: number; max: number; equivalente: number; label: string }[] = [
  { literal: 'AD', min: 18, max: 20, equivalente: 19,   label: 'Logro destacado' },
  { literal: 'A',  min: 14, max: 17, equivalente: 15.5, label: 'Logro esperado'  },
  { literal: 'B',  min: 11, max: 13, equivalente: 12,   label: 'En proceso'      },
  { literal: 'C',  min: 0,  max: 10, equivalente: 5,    label: 'En inicio'       },
];

/** Inicial no usa AD — el logro máximo ahí es A. */
export function literalesValidasParaNivel(nivel: NivelEducativo): CalificacionLiteral[] {
  return nivel === 'INICIAL' ? ['A', 'B', 'C'] : ['AD', 'A', 'B', 'C'];
}

/** ¿Este nivel se califica con número (secundaria) o con letra (inicial/primaria)? */
export function usaNumeroDirecto(nivel: NivelEducativo): boolean {
  return nivel === 'SECUNDARIA';
}

export function literalAEquivalenteNumerico(literal: CalificacionLiteral): number {
  return BANDAS.find(b => b.literal === literal)?.equivalente ?? 0;
}

export function numeroABanda(numero: number): { literal: CalificacionLiteral; label: string } {
  const banda = BANDAS.find(b => numero >= b.min && numero <= b.max) ?? BANDAS[BANDAS.length - 1];
  return { literal: banda.literal, label: banda.label };
}

/** Nota mínima aprobatoria — B en letras, 11 en números (MINEDU: "en
 * proceso" hacia abajo puede requerir recuperación según el reglamento del
 * colegio; se deja B/11 como el estándar más común). */
export const NOTA_APROBATORIA_NUMERICA = 11;
export const LITERAL_APROBATORIA: CalificacionLiteral[] = ['AD', 'A', 'B'];
