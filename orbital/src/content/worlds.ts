/**
 * Os quatro mundos. Conteúdo factual mínimo: nome, URL verificada (HTTP 200 em 17/10/2026), tese do brief.
 * Mídia: capturas e gravações REAIS dos sites públicos, feitas nesta sessão como material de referência interno.
 * `status: 'reference'` = autorização de publicação pendente · `'restricted'` = divulgação pública restrita (MM Editorial).
 * Nada aqui é placeholder apresentado como trabalho real.
 */
export type Bi = { pt: string; en: string };
/** `w`,`h`: tamanho natural do poster · `focal`: ponto (0..1) que a composição mantém no centro da janela */
/** `focal`: ponto mantido no centro quando a superfície está à frente · `detail`: ponto mostrado nas frestas (recorte estreito, mesma escala) */
export interface WorldMedia { poster: string; video?: string; w: number; h: number; focal: [number, number]; detail: [number, number] }
export interface World {
  id: string;
  index: number;
  name: string;
  url: string;
  category: Bi;
  thesis: Bi;
  /** cor própria do mundo (vem do próprio site) */
  tint: string;
  media: { desktop: WorldMedia; mobile: WorldMedia };
  status: 'reference' | 'restricted';
}

const M = '/orbital/media/';

export const worlds: readonly World[] = [
  {
    id: 'chiarella', index: 1, name: 'Chiarella Chuteiras', url: 'https://chiarellachuteira.com.br/',
    category: { pt: 'Produto e interatividade', en: 'Product and interactivity' },
    thesis: {
      pt: 'Ateliê de chuteiras artesanais. Um site de produto que conduz da ideia ao pedido: modalidade, partes, cores e o caminho até a encomenda.',
      en: 'A handmade football-boot atelier. A product site that leads from idea to order: discipline, parts, colours and the path to the commission.',
    },
    tint: '#d9c9a3',
    media: { desktop: { poster: M + 'chiarella-desktop-poster.jpg', video: M + 'chiarella-desktop.mp4', w: 2880, h: 1800, focal: [0.72, 0.52], detail: [0.78, 0.52] }, mobile: { poster: M + 'chiarella-mobile-poster.jpg', video: M + 'chiarella-mobile.mp4', w: 780, h: 1688, focal: [0.5, 0.22], detail: [0.5, 0.3] } },
    status: 'reference',
  },
  {
    id: 'jony', index: 2, name: 'Jony Vision', url: 'https://jony-vision-the-artful-eye.zadigdebem.workers.dev/',
    category: { pt: 'Expressão artística · foto e vídeo', en: 'Artistic expression · photo and film' },
    thesis: {
      pt: 'Portfólio de fotógrafo e videomaker com linguagem de set: metadados de câmera, duotone e tipografia expressiva.',
      en: 'A photographer and filmmaker portfolio with the grammar of a film set: camera metadata, duotone and expressive type.',
    },
    tint: '#d9f24b',
    media: { desktop: { poster: M + 'jony-desktop-poster.jpg', video: M + 'jony-desktop.mp4', w: 2880, h: 1800, focal: [0.78, 0.52], detail: [0.72, 0.55] }, mobile: { poster: M + 'jony-mobile-poster.jpg', video: M + 'jony-mobile.mp4', w: 780, h: 1688, focal: [0.5, 0.86], detail: [0.5, 0.62] } },
    status: 'reference',
  },
  {
    id: 'rlg', index: 3, name: 'RLG Connect', url: 'https://rlgconnect.com/',
    category: { pt: 'Identidade e narrativa digital', en: 'Identity and digital narrative' },
    thesis: {
      pt: 'Um conceito de marca traduzido em interface: elementos dispersos convergem durante a rolagem e viram narrativa comercial.',
      en: 'A brand concept translated into interface: scattered elements converge as you scroll and become a commercial narrative.',
    },
    tint: '#f04e1a',
    media: { desktop: { poster: M + 'rlg-desktop-poster.jpg', video: M + 'rlg-desktop.mp4', w: 2880, h: 1800, focal: [0.42, 0.42], detail: [0.3, 0.42] }, mobile: { poster: M + 'rlg-mobile-poster.jpg', video: M + 'rlg-mobile.mp4', w: 780, h: 1688, focal: [0.5, 0.3], detail: [0.5, 0.32] } },
    status: 'reference',
  },
  {
    id: 'mm', index: 4, name: 'MM Editorial', url: 'https://mm-editorial.zadigdebem.workers.dev/',
    category: { pt: 'Engenharia e plataforma editorial', en: 'Engineering and editorial platform' },
    thesis: {
      pt: 'Arquitetura editorial com camadas de aplicação: rotas públicas, edição, mídia e regras de publicação. Divulgação pública pendente.',
      en: 'Editorial architecture with application layers: public routes, editing, media and publishing rules. Public disclosure pending.',
    },
    tint: '#f28c1a',
    media: { desktop: { poster: M + 'mm-desktop-poster.jpg', w: 2880, h: 1800, focal: [0.76, 0.55], detail: [0.8, 0.5] }, mobile: { poster: M + 'mm-mobile-poster.jpg', w: 780, h: 1688, focal: [0.5, 0.3], detail: [0.5, 0.3] } },
    status: 'restricted',
  },
];

export const worldById = (id: string): World | undefined => worlds.find((w) => w.id === id);
export const pad = (n: number): string => String(n).padStart(2, '0');
