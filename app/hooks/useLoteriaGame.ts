// Compat layer: varios archivos históricos importaban `@/app/hooks/useLoteriaGame`.
// La implementación real vive en `useLoteriaGame2.ts`.
export { useLoteriaGame } from './useLoteriaGame2';
export type { LoteriaRoomState, LoteriaPlayer } from './useLoteriaGame2';


