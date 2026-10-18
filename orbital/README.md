# PoC Orbital — The Arrival (Contraluz) + The Orbital Atlas

Prova de conceito **Cinematic 2D-First** do portfólio de **Zadig de Bem**. Aplicação isolada em `/orbital/`:
não toca o site da raiz, não está publicada e não tem deploy configurado.

> **Conteúdo e direitos.** Chiarella Chuteiras, Jony Vision e RLG Connect aparecem com **capturas e gravações reais
> dos sites públicos**, feitas em 17/10/2026 como material de referência interno, rotuladas na interface como
> "captura de referência · autorização de publicação pendente". **MM Editorial** está em divulgação pública
> restrita: esta versão usa um **cartão tipográfico substituto** (sem capturas nem vídeo), descrito a partir do brief.
> Nenhum placeholder é apresentado como trabalho real.

---

## Rodar no seu computador (macOS e Windows)

**Pré-requisito:** Node.js **20.19 ou superior** (recomendado: 22 LTS), que já traz o `npm`.
Confira no terminal com `node -v`. Se precisar instalar: https://nodejs.org (instalador LTS).

**1. Abra um terminal na pasta do projeto**
- macOS: Terminal → `cd` até a pasta `orbital` (arraste a pasta para a janela do Terminal depois de digitar `cd `).
- Windows: PowerShell → `cd` até a pasta `orbital`.

**2. Instale as dependências** (uma vez; usa o `package-lock.json`, ~55 pacotes, sem rede depois disso)
```bash
npm ci
```

**3. Rode em modo de desenvolvimento** (recarrega ao editar)
```bash
npm run dev
```
Abra no navegador: **http://127.0.0.1:5180/orbital/**

**4. Ou rode a versão de produção** (igual à que seria publicada)
```bash
npm run build
npm run preview
```
Abra no navegador: **http://127.0.0.1:4180/orbital/**

**Para encerrar o servidor:** volte ao terminal e pressione `Ctrl + C` (no macOS também `Ctrl + C`, não `Cmd`).

O servidor escuta **somente em `127.0.0.1` (localhost)**: nada é exposto na rede local nem na internet.

### Outros comandos (todos existem no `package.json`)

| comando | o que faz |
|---|---|
| `npm run typecheck` | verificação de tipos (TypeScript) |
| `npm test` | testes unitários (órbita, recorte) |
| `npm run verify` | 63 verificações em navegador → `evidence/report.json` *(requer Chromium, ver abaixo)* |
| `npm run shots -- <pasta>` | quadros por progresso do scroll *(requer Chromium)* |
| `npm run video -- <saída.mp4> [desktop\|mobile]` | vídeo quadro a quadro *(requer Chromium e `ffmpeg`)* |

`verify`, `shots` e `video` procuram o Chromium em `/opt/pw-browsers/chromium` ou na variável `CHROMIUM_PATH`.
No seu computador, aponte para um Chrome/Chromium instalado, por exemplo:
- macOS: `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify`
- Windows (PowerShell): `$env:CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run verify`

Esses três são ferramentas de evidência; **não são necessários para navegar pela experiência.**

### Atalhos na experiência
- Role para atravessar o nome e chegar ao Atlas. **Setas ← →** ou **teclas 1–4** trocam de mundo. **Enter/clique** no quadro em foco abre a cena; **Esc** ou o botão "Voltar ao atlas" fecham.
- Parâmetros de URL: `?lang=en` · `?mode=static` (sem movimento) · `?mode=motion` · `#mundo-chiarella` / `#mundo-jony` / `#mundo-rlg` / `#mundo-mm` (link direto para a cena).
- O botão **"Versão estática"** no cabeçalho desliga os trilhos de rolagem; `prefers-reduced-motion` do sistema também.

### Se algo der errado
- `npm ci` reclama da versão do Node → atualize para 20.19+ ou 22+.
- Porta ocupada (`5180`/`4180`) → encerre o outro processo ou edite `server.port`/`preview.port` em `vite.config.ts`.
- Vídeos não tocam → eles só tocam no mundo em foco e em modo de movimento; com `prefers-reduced-motion` ativo
  a PoC mostra apenas os posters. Safari usa os `.mp4`; Chrome/Firefox usam os `.webm`.
- Tela em branco → confirme que a URL termina em **`/orbital/`** (o projeto é servido nesse caminho).

---

## O que a PoC faz

1. **The Arrival · Contraluz.** O nome `ZADIG DE BEM` em SVG, cada linha enchendo a medida pelo **eixo de largura**
   da fonte variável (Archivo). Um único progresso (scroll nativo) conduz três momentos contínuos:
   chegada (nome em marfim) → **a luz passa para trás** (letras escuras, fio quente; dentro da contraforma do D de "DE"
   abre-se uma **janela em letterbox**, com a proporção da tela) → **travessia** (a `viewBox` mergulha na contraforma).
   A travessia termina com a **borda do D ainda no quadro**: a janela é uma passagem, não o destino.
   A contraforma é **medida no raster do próprio glifo**.
2. **Revelação de escala (Arrival → Atlas).** O Atlas assume o último quadro da travessia (verificado por RMSE < 0,01)
   e **continua o mesmo movimento para a frente**: a borda do D passa pelas bordas da tela e se dissolve, a janela recua
   para o seu lugar e os outros três mundos emergem de trás dela, enquanto a órbita se desenha e o núcleo
   "Zadig de Bem" aparece. O que parecia o destino era uma entre quatro superfícies.
3. **The Orbital Atlas (aberturas, não miniaturas).** O mundo em foco é uma cena: ocupa o quadro principal com a
   **navegação real do site em vídeo**, a cor do próprio site tinge o palco e o seu numeral monumental ocupa o fundo.
   Os outros mundos são **frestas verticais nas bordas da tela, na mesma escala** (recortes de mundos vizinhos), e o
   quarto fica atrás do quadro. A órbita passa por trás das frestas, maior que o quadro, com o trilho tipográfico dos
   nomes. Entre mundos, a fresta da direita abre até virar o quadro e o quadro fecha até virar a fresta da esquerda
   (`stageLayout.ts`). Scroll por patamares; clique/toque, setas e teclas 1–4 vão direto.
4. **Mundo expandido (cena).** O vídeo de navegação real ocupa o quadro inteiro entre barras de letterbox; título
   monumental e tese no terço inferior; a próxima cena espreita pela borda direita. Entre mundos, um wipe com direção.
   Diálogo acessível: hash (`#mundo-rlg`), Esc/voltar fecham, foco preso, `inert` no resto.
5. **Retrato.** Direção própria: nome em três linhas, janela no D de "DE", quadro em foco no alto com frestas laterais,
   coluna abaixo.
6. **PT-BR/EN** (detecção, troca persistente), **modo estático** (reduced-motion, economia de dados ou botão):
   os trilhos voltam ao fluxo normal, o conteúdo e a navegação continuam.

Sem WebGL, sem biblioteca de animação, sem scroll-jacking, sem loader, sem áudio. Build: ~33 kB de JS + ~17 kB de CSS
(gzip ~17 kB no total), três fontes variáveis (~150 kB), posters a 2× (~1 MB) e vídeos sob demanda (só o mundo em foco).

## Arquitetura

```
src/
  main.ts                 liga capítulos, idioma, modo, âncoras no palco fixo
  core/   track.ts        trilho: palco sticky + progresso = f(scrollY), reversível
          raf.ts          valor amortecido com renderização sob demanda
          capabilities.ts reduced-motion, saveData, override, modo
          i18n.ts         dicionário tipado PT/EN, data-i18n
          math.ts         clamp/lerp/eases, coverRect/coverRectMin (recorte com ponto focal e escala mínima)
  arrival/ nameFit.ts     composição do nome por eixo de largura + medição da contraforma
           arrival.ts     coreografia Contraluz (luz, fenda, mergulho) + quadro final herdado pelo Atlas
  atlas/   orbit.ts       patamares e foco contínuo (testados)
           stageLayout.ts composição por aberturas: quadro, frestas, lado de trás (testável)
           atlas.ts       superfícies com vídeo, trilho tipográfico, numeral, revelação, navegação
  world/   world.ts       cena expandida (FLIP, vídeo, wipe entre mundos, foco, hash)
  content/ worlds.ts      os quatro mundos (URLs verificadas, mídia, pontos focais, status)
           strings.ts     textos PT/EN
  styles/                 tokens, base, arrival, atlas, world, static
scripts/  verify.mjs · shots.mjs · capture-video.mjs
tests/    orbit.test.ts
```

## Origem do que foi reaproveitado

Da PoC anterior (`/poc/`, 3D, preservada fora do repositório): o padrão de palco fixo com progresso derivado do
scroll nativo, a navegação por âncoras no palco, as capacidades, o dicionário de i18n e o harness de verificação,
portados de hooks React para módulos TypeScript puros.

## Limitações conhecidas

- Verificação em Chromium headless; Safari/Firefox e aparelhos físicos ainda não testados por aqui.
- Copy provisória; os textos dos mundos reproduzem a tese do brief, não resultados.
- As gravações do configurador da Chiarella foram automatizadas e são curtas; uma gravação manual renderia um vídeo
  melhor para esse mundo.
- MM Editorial: cartão substituto até autorização da cliente.
- The Origin, The Archive e The Connection ficam para os próximos ciclos.
