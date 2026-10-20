// Pipeline de mídia dos mundos: normaliza gravações MANUAIS (QuickTime/OBS/iPhone) para os arquivos que a PoC usa.
// Para cada `<id>-desktop.*` e `<id>-mobile.*` na pasta de origem gera:
//   <id>-desktop.mp4 (H.264 1920×1200 · 30 fps) · <id>-desktop.webm (VP9) · <id>-desktop-poster.jpg (2880×1800)
//   <id>-mobile.mp4  (H.264 780×1688  · 30 fps) · <id>-mobile.webm  (VP9) · <id>-mobile-poster.jpg  (780×1688)
// Antes de codificar mede a fluidez da gravação (quadros únicos / totais) e avisa quando a origem já vem travada.
// uso: node scripts/encode-media.mjs <pasta-origem> [--out public/media] [--ids chiarella,jony,rlg] [--start auto|<s>] [--max 20] [--dry]
// Requer ffmpeg/ffprobe. A pasta de origem fica FORA do repositório (p. ex. ~/orbital-capturas). Nunca inclua material restrito (MM Editorial).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const src = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const DRY = args.includes('--dry');
const out = resolve(root, opt('out', 'public/media'));
const ids = opt('ids', 'chiarella,jony,rlg').split(',').map((s) => s.trim()).filter(Boolean);
const startOpt = opt('start', 'auto');
const MAX = Number(opt('max', 20));
if (!src || !existsSync(src)) { console.error('uso: node scripts/encode-media.mjs <pasta-origem> [--out public/media] [--ids a,b] [--start auto|s] [--max 20] [--dry]'); process.exit(2); }
if (ids.includes('mm')) { console.error('MM Editorial é material restrito: não passa por este pipeline público.'); process.exit(2); }

const SPEC = {
  desktop: { w: 1920, h: 1200, posterW: 2880, posterH: 1800, crf: 22, vp9: 32, kbps: 'máx. ~3 Mbps' },
  mobile: { w: 780, h: 1688, posterW: 780, posterH: 1688, crf: 23, vp9: 33, kbps: 'máx. ~1,5 Mbps' },
};
const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** ffmpeg escreve os filtros de análise no stderr: captura tudo */
const runLog = (a) => { const r = spawnSync('ffmpeg', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); return `${r.stdout || ''}\n${r.stderr || ''}`; };
const probe = (f) => {
  const j = JSON.parse(run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', f]));
  const v = j.streams.find((s) => s.codec_type === 'video');
  const [a, b] = (v.avg_frame_rate || '0/1').split('/').map(Number);
  return { w: v.width, h: v.height, fps: b ? a / b : 0, dur: Number(j.format.duration), codec: v.codec_name, rotate: Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0) };
};
/** quadros únicos / totais (mpdecimate): 1 = fluido, < 0,8 = gravação travada */
const fluidity = (f, limit, fpsRef) => {
  const log = runLog(['-hide_banner', '-nostats', '-t', String(limit), '-i', f, '-vf', 'mpdecimate=hi=512:lo=256:frac=0.2,showinfo', '-an', '-f', 'null', '-']);
  const uniq = (log.match(/showinfo.*? n:\s*\d+/g) || []).length;
  const total = Math.round(limit * (fpsRef || probe(f).fps || 30));
  return { uniq, total: Math.max(total, 1), ratio: uniq / Math.max(total, 1) };
};
/** início automático: primeiro quadro que não é branco nem preto (telas de carregamento), + 0,1 s */
const autoStart = (f) => {
  const log = runLog(['-hide_banner', '-nostats', '-t', '4', '-i', f, '-vf', 'fps=10,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-']);
  const rows = [...log.matchAll(/pts_time:([\d.]+)[\s\S]*?YAVG=([\d.]+)/g)].map((m) => ({ t: Number(m[1]), y: Number(m[2]) }));
  const first = rows.find((r) => r.y > 10 && r.y < 232);
  return first ? Math.min(first.t + 0.1, 3) : 0.3;
};
const fmtMB = (f) => `${(statSync(f).size / 1e6).toFixed(2)} MB`;

mkdirSync(out, { recursive: true });
const files = readdirSync(src);
const rows = [];
for (const id of ids) for (const variant of ['desktop', 'mobile']) {
  const name = files.find((f) => new RegExp(`^${id}-${variant}\\.(mov|mp4|m4v|webm|mkv)$`, 'i').test(f));
  if (!name) { rows.push({ id, variant, status: 'ausente' }); continue; }
  const inF = join(src, name);
  const S = SPEC[variant];
  const P = probe(inF);
  const start = startOpt === 'auto' ? autoStart(inF) : Number(startOpt);
  const dur = Math.min(MAX, Math.max(0, P.dur - start));
  const fl = fluidity(inF, Math.min(P.dur, 12));
  const warn = fl.ratio < 0.8 ? ` ⚠ gravação travada (${(fl.ratio * 100).toFixed(0)} % de quadros únicos)` : '';
  const vf = `fps=30,scale=${S.w}:${S.h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${S.w}:${S.h},format=yuv420p`;
  const base = join(out, `${id}-${variant}`);
  const plan = [
    ['ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-t', String(dur), '-i', inF, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(S.crf), '-g', '60', '-movflags', '+faststart', `${base}.mp4`]],
    ['ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-t', String(dur), '-i', inF, '-vf', vf, '-an', '-c:v', 'libvpx-vp9', '-crf', String(S.vp9), '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', '60', `${base}.webm`]],
    ['ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(start), '-i', inF, '-frames:v', '1', '-vf', `scale=${S.posterW}:${S.posterH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${S.posterW}:${S.posterH}`, '-q:v', '3', `${base}-poster.jpg`]],
  ];
  console.log(`\n${id}-${variant} ← ${name}: ${P.w}×${P.h} ${P.codec} ${P.fps.toFixed(1)} fps ${P.dur.toFixed(1)} s · início ${start.toFixed(2)} s · ${dur.toFixed(1)} s${warn}`);
  if (DRY) { for (const [c, a] of plan) console.log('  ', c, a.join(' ')); rows.push({ id, variant, status: 'plano', fluidez: fl.ratio }); continue; }
  for (const [c, a] of plan) run(c, a);
  const outFl = fluidity(`${base}.mp4`, Math.min(dur, 12), Math.min(30, P.fps || 30)); // saída a 30 fps: compara com o que a origem podia dar
  rows.push({ id, variant, status: 'ok', origem: `${(fl.ratio * 100).toFixed(0)} %`, saída: `${(outFl.ratio * 100).toFixed(0)} %`, mp4: fmtMB(`${base}.mp4`), webm: fmtMB(`${base}.webm`), poster: fmtMB(`${base}-poster.jpg`), dur: `${dur.toFixed(1)} s` });
}
console.log('\nResumo (fluidez = quadros únicos / totais):');
console.table(rows);
console.log(`Saída: ${out}\nDepois: confira em src/content/worlds.ts que cada mundo aponta para <id>-desktop.mp4 / <id>-mobile.mp4 (o .webm é derivado do mesmo nome) e rode npm run build && npm run verify.`);
