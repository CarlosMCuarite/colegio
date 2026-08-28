'use client';
// Ruta única y neutral (no depende del rol del que la abre) para el editor de
// plantilla del carnet — así el enlace "Editar plantilla" dentro del carnet
// funciona igual sin importar si lo abrió Admin o Secretaría.
export { default } from '../../../../components/CarnetPlantillaEditor';
