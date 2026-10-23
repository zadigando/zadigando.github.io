/**
 * Flags da PoC.
 * SCENES — cena expandida ("Entrar no mundo", diálogo em tela cheia com vídeo). Desligada no C4.1:
 * o quadro em foco do Atlas abre o site real. O módulo `world/world.ts` fica preservado para os
 * case studies completos; para comparar os dois comportamentos: `?scenes=1`.
 */
const q = new URLSearchParams(location.search);
export const SCENES: boolean = q.get('scenes') === '1';
/** Ritmo do Atlas (ver RHYTHMS em atlas/orbit.ts). Padrão: `b` (≈ −35 % de rolagem, validado no MacBook Air M4);
 *  `?atlas=current|a|b` compara os presets do estudo de ritmo. */
export const ATLAS_RHYTHM: string = q.get('atlas') ?? 'b';
