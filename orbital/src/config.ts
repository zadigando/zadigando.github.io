/**
 * Flags da PoC.
 * SCENES — cena expandida ("Entrar no mundo", diálogo em tela cheia com vídeo). Desligada no C4.1:
 * o quadro em foco do Atlas abre o site real. O módulo `world/world.ts` fica preservado para os
 * case studies completos; para comparar os dois comportamentos: `?scenes=1`.
 */
const q = new URLSearchParams(location.search);
export const SCENES: boolean = q.get('scenes') === '1';
/** Estudo de ritmo do Atlas: `?atlas=current|a|b` (ver RHYTHMS em atlas/orbit.ts). */
export const ATLAS_RHYTHM: string = q.get('atlas') ?? 'current';
