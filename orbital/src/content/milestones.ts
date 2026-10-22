import type { Bi } from './worlds';

/**
 * The Origin — os marcos da trajetória (2020 → 2026) sobre o corpo real de Escorpião.
 * `stars`: índices em STARS (scorpius.ts) da(s) estrela(s) do marco; o enquadramento mira o ponto médio.
 * A associação estrela ↔ acontecimento é SIMBÓLICA; as posições são as do catálogo.
 * Os textos apoiam-se só nas experiências documentadas pelo próprio Zadig.
 */
export interface Milestone {
  id: string;
  years: string;
  stars: readonly number[];
  /** nome da estrela para o olho da coluna (letra de Bayer em `bayer`) */
  star: string;
  bayer: string;
  title: Bi;
  subtitle: Bi;
  thesis: Bi;
  /** lado da coluna na paisagem; no retrato a coluna fica sempre na base */
  side: 'left' | 'right';
  /** onde a estrela fica no quadro (frações do palco), paisagem e retrato */
  frame: [number, number];
  framePortrait: [number, number];
  /** zoom sobre a carta inteira, paisagem e retrato */
  zoom: number;
  zoomPortrait: number;
}

export const milestones: readonly Milestone[] = [
  {
    id: '2020', years: '2020', stars: [0], star: 'Antares', bayer: 'α',
    title: { pt: 'A história da internet', en: 'The Story of the Internet' },
    subtitle: { pt: 'O trabalho escolar que despertou o interesse pela tecnologia', en: 'The school assignment that sparked an interest in technology' },
    thesis: { pt: 'Antes de qualquer site, um TCC na escola Waldorf sobre como a rede nasceu. Foi ali que a tecnologia deixou de ser ferramenta e virou caminho.', en: 'Before any website, a final school project at a Waldorf school on how the network was born. That was where technology stopped being a tool and became a path.' },
    side: 'left', frame: [0.5, 0.5], framePortrait: [0.5, 0.5], zoom: 1, zoomPortrait: 1,
  },
  {
    id: '2021', years: '2021', stars: [7], star: 'Larawag', bayer: 'ε',
    title: { pt: 'A primeira linha', en: 'The First Line' },
    subtitle: { pt: 'Ciência da Computação, Barão de Mauá · estágio na ConstruConnect', en: 'Computer Science, Barão de Mauá · internship at ConstruConnect' },
    thesis: { pt: 'O primeiro estágio, com Angular e Java: o código deixa de ser estudo e vira trabalho.', en: 'The first internship, with Angular and Java: code stops being study and becomes work.' },
    side: 'left', frame: [0.66, 0.45], framePortrait: [0.6, 0.3], zoom: 2.0, zoomPortrait: 1.7,
  },
  {
    id: '2022', years: '2022–2023', stars: [31, 53], star: 'Xamidimura · Pipirima', bayer: 'μ¹ μ²',
    title: { pt: 'Além do código', en: 'Beyond the Code' },
    subtitle: { pt: 'Estágio em TI, Universidade de São Paulo', en: 'IT internship, University of São Paulo' },
    thesis: { pt: 'Suporte, infraestrutura, comunicação e resolução de problemas: a tecnologia vista de dentro de uma universidade.', en: 'Support, infrastructure, communication and problem-solving: technology seen from inside a university.' },
    side: 'right', frame: [0.36, 0.5], framePortrait: [0.4, 0.36], zoom: 2.1, zoomPortrait: 1.9,
  },
  {
    id: '2024', years: '2024', stars: [3], star: 'Sargas', bayer: 'θ',
    title: { pt: 'Construir do zero', en: 'Building from Scratch' },
    subtitle: { pt: 'Graduação em Ciência da Computação · cofundador da AB Técnica', en: 'Computer Science degree · co-founder of AB Técnica' },
    thesis: { pt: 'O diploma e a primeira empresa no mesmo ano: construir para os outros e para si.', en: 'The degree and the first company in the same year: building for others and for yourself.' },
    side: 'left', frame: [0.6, 0.66], framePortrait: [0.6, 0.4], zoom: 1.9, zoomPortrait: 1.7,
  },
  {
    id: '2025', years: '2025', stars: [10], star: 'κ Scorpii', bayer: 'κ',
    title: { pt: 'Outra escala', en: 'A New Scale' },
    subtitle: { pt: 'Studio Rx · IPG Health', en: 'Studio Rx · IPG Health' },
    thesis: { pt: 'E-mails e peças digitais para comunicação farmacêutica: rigor, escala e prazo.', en: 'Emails and digital pieces for pharmaceutical communication: rigour, scale and deadlines.' },
    side: 'right', frame: [0.34, 0.48], framePortrait: [0.4, 0.3], zoom: 2.1, zoomPortrait: 1.9,
  },
  {
    id: '2026', years: '2026', stars: [1, 18], star: 'Shaula · Lesath', bayer: 'λ υ',
    title: { pt: 'Em movimento', en: 'In Motion' },
    subtitle: { pt: 'MBA em Engenharia de Software · USP/Esalq', en: 'MBA in Software Engineering · USP/Esalq' },
    thesis: { pt: 'A formação continua, e os projetos independentes de desenvolvimento web também', en: 'The training continues, and so do the independent web development projects' },
    side: 'left', frame: [0.64, 0.42], framePortrait: [0.6, 0.3], zoom: 1.8, zoomPortrait: 1.6,
  },
];

/** O corpo do escorpião do coração ao ferrão (índices em STARS): α τ ε μ¹ ζ² η θ ι¹ κ λ. A câmera caminha por aqui. */
export const BODY_PATH: readonly number[] = [0, 22, 7, 31, 56, 42, 3, 30, 10, 1];

export const milestoneByYear = (y: string): number => milestones.findIndex((m) => m.id === y || m.years.split(/[–-]/).includes(y));
