# PoC Orbital — The Arrival (Contraluz) + The Orbital Atlas

Prova de conceito **Cinematic 2D-First** do portfólio de **Zadig de Bem**. Aplicação isolada em `/orbital/`:
não toca o site da raiz, não está publicada e não tem deploy configurado.

> **Conteúdo e direitos.** Chiarella Chuteiras, Jony Vision e RLG Connect aparecem com **capturas e gravações reais
> dos sites públicos**, feitas em 17/10/2026 como material de referência interno. **MM Editorial** está em divulgação
> pública restrita: esta versão usa um **cartão tipográfico substituto** (sem capturas nem vídeo), descrito a partir
> do brief. Nenhum placeholder é apresentado como trabalho real.

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
| `npm run verify` | verificações em navegador, 9 viewports (inclui MacBook com barra do navegador) → `evidence/report.json` *(requer Chromium)* |
| `npm run shots -- <pasta>` | quadros por progresso do scroll *(requer Chromium)* |
| `npm run video -- <saída.mp4> [desktop\|mac\|mobile]` | vídeo quadro a quadro *(requer Chromium e `ffmpeg`)* |
| `npm run media -- <pasta-origem>` | normaliza gravações manuais dos sites para `public/media/` *(requer `ffmpeg`)* — ver abaixo |

`verify`, `shots` e `video` procuram o Chromium em `/opt/pw-browsers/chromium` ou na variável `CHROMIUM_PATH`.
No seu computador, aponte para um Chrome/Chromium instalado, por exemplo:
- macOS: `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run verify`
- Windows (PowerShell): `$env:CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"; npm run verify`

Esses são ferramentas de evidência; **não são necessários para navegar pela experiência.**

### Na experiência
- Role para atravessar o nome e chegar ao Atlas. **Setas ← →** ou **teclas 1–4** trocam de mundo. **Clique/toque ou
  Enter** no quadro em foco **abre o site real em nova aba**; as frestas laterais trocam de mundo; "Visitar site" fica
  sempre visível na coluna.
- Parâmetros de URL: `?lang=en` · `?mode=static` (sem movimento) · `?mode=motion` · `#mundo-chiarella` /
  `#mundo-jony` / `#mundo-rlg` / `#mundo-mm` (link direto ao platô do mundo) · `?scenes=1` (liga a **cena expandida**
  antiga — "Entrar no mundo", diálogo em tela cheia — preservada atrás de flag para os case studies).
- Não há botão de modo: a versão estática entra sozinha com `prefers-reduced-motion` ou economia de dados do sistema.
- A barra de rolagem fica oculta; a rolagem continua nativa (roda, trackpad, teclado, âncoras).

### Se algo der errado
- `npm ci` reclama da versão do Node → atualize para 20.19+ ou 22+.
- Porta ocupada (`5180`/`4180`) → encerre o outro processo ou edite `server.port`/`preview.port` em `vite.config.ts`.
- Vídeos não tocam → eles só tocam no mundo em foco e em modo de movimento; com `prefers-reduced-motion` ativo
  a PoC mostra apenas os posters. Safari usa os `.mp4`; Chrome/Firefox usam os `.webm`.
- Tela em branco → confirme que a URL termina em **`/orbital/`** (o projeto é servido nesse caminho).

---

## Gravações manuais dos sites (vídeos dos mundos)

As gravações automatizadas (Playwright headless) saem travadas (5–12 fps efetivos). A PoC espera gravações
**manuais**, normalizadas por `npm run media`.

**Desktop (Chiarella, Jony Vision, RLG Connect)**
- Chrome com viewport **1440×900** px CSS, zoom 100 %, tela Retina. Esconda a barra do navegador (tela cheia,
  ⌃⌘F) e grave só a área da página.
- QuickTime (Arquivo → Nova gravação de tela → selecionar parte da tela) ou OBS, **60 fps**, sem áudio, sem cursor
  (cursor fora da área; "Mostrar cliques do mouse" desligado).
- "Não perturbe" ligado, página carregada antes de iniciar (sem tela branca), idioma pt-BR. Comece no topo, rolagem
  **lenta e contínua** pelo trackpad, pausas de 1–1,5 s nos momentos-chave, sem hover em menus. **14–20 s**.
  - Chiarella: hero → "Criar minha chuteira" → 2–3 etapas do configurador.
  - Jony Vision: hero → trabalhos/galeria → um projeto aberto.
  - RLG Connect: hero → manifesto → serviços/etapas.

**Mobile**
- iPhone, gravação nativa de tela (Central de Controle), retrato, Safari com barras recolhidas, **10–15 s**, roteiro
  resumido. Alternativa: Chrome desktop em modo dispositivo 390×844 @3x, gravando a região.

**Entrega e normalização**
- Guarde os originais (.mov/.mp4 na qualidade máxima) numa pasta **fora do repositório**, com estes nomes:
  `chiarella-desktop.mov`, `chiarella-mobile.mov`, `jony-desktop.mov`, `jony-mobile.mov`, `rlg-desktop.mov`,
  `rlg-mobile.mov` (a extensão pode ser .mp4/.m4v/.webm/.mkv).
- Rode, por exemplo:
  ```bash
  npm run media -- ~/orbital-capturas            # gera em public/media/
  npm run media -- ~/orbital-capturas --dry      # só mostra o plano e a fluidez de cada origem
  npm run media -- ~/orbital-capturas --ids jony --start 0.8 --max 16
  ```
  O script mede a fluidez da origem (quadros únicos / totais; avisa abaixo de 80 %), descarta o início branco
  automaticamente (`--start auto`), e gera **30 fps constantes**: `<id>-desktop.mp4` (H.264 1920×1200) +
  `.webm` (VP9) + `<id>-desktop-poster.jpg` (2880×1800), e `<id>-mobile.*` (780×1688). Os nomes são os que
  `src/content/worlds.ts` já usa; depois `npm run build && npm run verify`.
- **MM Editorial não passa por este pipeline** (material restrito; o script recusa `--ids mm`).

---

## O que a PoC faz

1. **The Arrival · Contraluz.** O nome `ZADIG DE BEM` em SVG, cada linha enchendo a medida pelo **eixo de largura**
   da fonte variável (Archivo). O corpo é limitado pela largura **e pela altura útil** (entre o cabeçalho e a margem
   inferior): em telas largas e baixas (MacBook com a barra do navegador) o nome continua monumental sem cortes nem
   sobreposições; quando a altura manda, o eixo de largura e um tracking discreto completam a medida. A abertura é só
   o nome e a indicação de rolagem. Um único progresso (scroll nativo) conduz três momentos contínuos: chegada →
   **a luz passa para trás** (letras escuras, fio quente; dentro da contraforma do D de "DE" abre-se uma **janela em
   letterbox**) → **travessia**. A câmera mantém a janela **sempre no quadro**: a posição dela na tela caminha
   monotonicamente até o centro enquanto o zoom logarítmico fecha, e o quadro final nunca é mais largo que o D
   (a borda fica no quadro; o E nunca entra). A contraforma é **medida no raster do próprio glifo**.
2. **Revelação de escala (Arrival → Atlas).** O Atlas assume o último quadro da travessia (verificado por RMSE < 0,01)
   e continua o movimento, em sequência: a tinta das letras some, a borda do D avança pelas bordas da tela e dissolve;
   só então a janela recua para o seu lugar e os outros três mundos emergem de trás dela, enquanto a órbita se
   desenha. Nenhuma mancha da letra desliza sobre o mundo.
3. **The Orbital Atlas (aberturas, não miniaturas).** O mundo em foco é uma cena: ocupa o quadro principal com a
   **navegação real do site em vídeo**, a cor do próprio site tinge o palco e o seu numeral monumental ocupa o fundo.
   Os outros mundos são **frestas verticais nas bordas da tela, na mesma escala**; o quarto fica atrás do quadro.
   Zonas seguras: fresta esquerda | coluna de texto | quadro | fresta direita nunca se cruzam (`stageLayout.ts`).
   O quadro em foco é o **link do site real** (clique/toque/Enter abrem em nova aba; ao passar o ponteiro aparece
   "Abrir o site ↗"); as frestas trocam de mundo. Scroll por patamares; setas e teclas 1–4 vão direto; `#mundo-<id>`
   leva ao platô (histórico e retorno nativos).
4. **Cena expandida (atrás de flag, `?scenes=1`).** O mecanismo do Ciclo 3 (vídeo em tela cheia entre barras de
   letterbox, FLIP, wipe entre mundos, diálogo acessível) está preservado em `world/world.ts` para os case studies
   completos; desligado por padrão para encurtar o caminho até o projeto real.
5. **Retrato.** Direção própria: nome em três linhas, janela no D de "DE", quadro em foco no alto com frestas laterais,
   coluna abaixo.
6. **PT-BR/EN** (detecção, troca persistente), **modo estático** automático (reduced-motion, economia de dados ou
   `?mode=static`): os trilhos voltam ao fluxo normal, o conteúdo e a navegação continuam.

Sem WebGL, sem biblioteca de animação, sem scroll-jacking, sem loader, sem áudio. Build: ~37 kB de JS + ~19 kB de CSS
(gzip ~19 kB no total), três fontes variáveis (~150 kB), posters a 2× (~1 MB) e vídeos sob demanda (só o mundo em foco).

## Arquitetura

```
src/
  main.ts                 liga capítulos, idioma, âncoras no palco fixo, flag de cenas
  config.ts               SCENES (cena expandida) — `?scenes=1`
  core/   track.ts        trilho: palco sticky + progresso = f(scrollY), reversível
          raf.ts          valor amortecido com renderização sob demanda
          capabilities.ts reduced-motion, saveData, override, modo
          i18n.ts         dicionário tipado PT/EN, data-i18n
          math.ts         clamp/lerp/eases, coverRect/coverRectMin (recorte com ponto focal e escala mínima)
  arrival/ nameFit.ts     composição do nome por largura E altura (eixo de largura, tracking) + medição da contraforma
           arrival.ts     coreografia Contraluz (luz, fenda, mergulho com a janela sempre no quadro) + quadro final
  atlas/   orbit.ts       patamares e foco contínuo (testados)
           stageLayout.ts composição por aberturas e zonas seguras: quadro, frestas, coluna (testável)
           atlas.ts       superfícies-link com vídeo, trilho tipográfico, numeral, revelação sequenciada, navegação
  world/   world.ts       cena expandida (FLIP, vídeo, wipe entre mundos, foco, hash) — atrás da flag
  content/ worlds.ts      os quatro mundos (URLs verificadas, mídia, pontos focais, status)
           strings.ts     textos PT/EN
  styles/                 tokens, base, arrival, atlas, world, static
scripts/  verify.mjs · shots.mjs · capture-video.mjs · encode-media.mjs
tests/    orbit.test.ts
```

## Origem do que foi reaproveitado

Da PoC anterior (`/poc/`, 3D, preservada fora do repositório): o padrão de palco fixo com progresso derivado do
scroll nativo, a navegação por âncoras no palco, as capacidades, o dicionário de i18n e o harness de verificação,
portados de hooks React para módulos TypeScript puros.

## Ritmo do Atlas

O ritmo (assentamento, platô, transição, último platô, curva do foco e deriva no platô) é um preset em svh em
`src/atlas/orbit.ts`. O padrão é o `b` (≈ 405 svh de trajeto, curva seno, deriva de ±5 px): uma passada média de
trackpad ≈ um mundo, validado no MacBook Air M4. `?atlas=current` reproduz o ritmo original (620 svh, curva quart)
e `?atlas=a` o intermediário. Composições, frestas, órbita e mídias são as mesmas em qualquer preset; não há snapping
nem interceptação de roda. A suíte roda em qualquer preset com `ATLAS=current|a|b npm run verify`.

## Dados astronômicos (The Origin)

A carta de Escorpião usa posições reais: HYG Database v3.8 (David Nash, astronexus.com — derivada dos catálogos
Hipparcos, Yale BSC5 e Gliese), licença CC BY-SA 4.0. O módulo `src/content/scorpius.ts` guarda 512 estrelas da
região (magnitude ≤ 6,0, coordenadas J2000, magnitude e índice de cor B−V) e a figura clássica de 17 estrelas.
A projeção (`src/origin/sky.ts`) é estereográfica; a rotação da carta é a única escolha artística. As associações
entre estrelas e acontecimentos profissionais são simbólicas. Nenhuma legenda técnica aparece na composição: o
crédito fica aqui e no cabeçalho do módulo de dados.

## The Origin · Estudo 02 — a viagem pelo corpo de Escorpião

Depois do marco de 2020 (Antares), a câmera (translate + scale de um único grupo SVG da carta) caminha sobre a
polilinha real do corpo da constelação — α τ ε μ ζ η θ ι κ λ — e para em cinco estações: 2021 em ε Larawag,
2022–2023 no par μ¹ Xamidimura / μ² Pipirima, 2024 em θ Sargas, 2025 em κ Sco e 2026 no ferrão λ Shaula / υ Lesath.
Cada estação enquadra a estrela no terço oposto à coluna editorial (zoom 1,6–2,1); entre estações o ritmo é o do
Atlas (easeInOutQuart). Estrelas e nomes mantêm o tamanho em px de tela; o campo de estrelas fracas é uma camada
mais distante (paralaxe). No fim, recuo até a figura inteira, sem textos. Marcos em `src/content/milestones.ts`
(os textos apoiam-se só nas experiências documentadas pelo autor; a associação com as estrelas é simbólica);
geometria pura e testada em `src/origin/sky.ts`. Atalhos: `#origin-2021` … `#origin-2026`, setas e teclas 1–6.

## Limitações conhecidas

- Verificação em Chromium headless; Safari/Firefox e aparelhos físicos ainda não testados por aqui.
- Copy provisória; os textos dos mundos reproduzem a tese do brief, não resultados.
- Os vídeos atuais vêm de gravações automatizadas travadas; serão substituídos pelas gravações manuais
  (ver "Gravações manuais dos sites").
- MM Editorial: cartão substituto até autorização da cliente.
- The Origin, The Archive e The Connection ficam para os próximos ciclos.
