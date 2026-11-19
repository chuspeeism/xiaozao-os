// Slides for 「大师的 AI 小灶」vision deck
// Style system: Safenet-style (acid green + black, bracketed titles, hex-code texture)

// ---- Tweaks: shared global + subscription hook ----------------------------
const TWEAK_DEFAULTS = { bg: '#16F08B', font: 'sans', density: 'standard' };
window.__tweaks = window.__tweaks || { ...TWEAK_DEFAULTS };
function useTweaksSubscribe() {
  const [t, setT] = React.useState(window.__tweaks);
  React.useEffect(() => {
    const h = () => setT({ ...window.__tweaks });
    window.addEventListener('tweakschange', h);
    return () => window.removeEventListener('tweakschange', h);
  }, []);
  return t;
}
// (Do NOT assign to window.useTweaks — that's the starter hook used by the panel.)

const COLORS = {
  bg: '#16F08B',      // acid green
  bg2: '#0FE07C',
  ink: '#000000',
  inkSoft: 'rgba(0,0,0,0.55)',
  inkMuted: 'rgba(0,0,0,0.30)',
  paper: '#FFFFFF',
};

const TYPE_SCALE = {
  mega: 220,
  hero: 128,
  title: 84,
  subtitle: 52,
  body: 34,
  small: 26,
  tag: 22,
  mono: 18,
};

const SPACING = {
  padX: 100,
  padY: 90,
  titleGap: 48,
  itemGap: 28,
};

// ---- Hex/keyword code texture background ----------------------------------
// Generates a fixed block of hex-like characters with AI-term "sticker" tags
// scattered over it, echoing the Safenet reference.

const HEX_CHARS = '0123456789ABCDEF';
function seededHex(seed, len) {
  // simple LCG so rendering is stable across renders
  let s = seed;
  let out = '';
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    out += HEX_CHARS[Math.floor((s / 233280) * 16)];
  }
  return out;
}

function HexTexture({ seed = 7, rows = 18, cols = 120, opacity = 0.55, tags = [] }) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const CELL_W = 11.2;  // matches 16px JetBrains Mono ~0.7em advance
    const CELL_H = 24.8;  // line-height 1.55 * 16px
    const PAD_X = 40;
    const PAD_Y = 20;

    // Pre-build a grid of base chars (static so layout matches old HexTexture).
    const grid = new Array(rows);
    for (let r = 0; r < rows; r++) {
      grid[r] = seededHex(seed + r * 1337, cols);
    }

    // Per-cell random phase offsets (stable across frames).
    const phase = new Float32Array(rows * cols);
    for (let i = 0; i < phase.length; i++) {
      phase[i] = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const ctx = canvas.getContext('2d');
    const startT = performance.now();
    let raf = 0;

    const draw = (nowMs) => {
      const t = (nowMs - startT) / 1000;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.font = '500 16px "JetBrains Mono", ui-monospace, Menlo, monospace';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#000';

      for (let r = 0; r < rows; r++) {
        const line = grid[r];
        for (let c = 0; c < cols; c++) {
          // Diagonal scanline wave: value moves from top-left to bottom-right.
          const wave = Math.sin((c * 0.18 + r * 0.35) - t * 1.6);
          // Soft per-cell flicker seeded by phase.
          const flick = Math.sin(t * 3.2 + phase[r * cols + c] * 6.283) * 0.5 + 0.5;
          // Pulse band sweeping right: a narrow bright stripe.
          const bandPos = ((t * 60) % (cols + 60)) - 30;
          const bandDist = Math.abs(c - bandPos - r * 0.4);
          const band = Math.max(0, 1 - bandDist / 8);

          let alpha = 0.22 + 0.45 * (wave * 0.5 + 0.5) + 0.2 * flick;
          alpha = Math.min(1, alpha + band * 0.9);

          // Occasional character mutation — a small chance per frame to show
          // a different hex char, stable-ish by bucketing time.
          const tBucket = Math.floor(t * 4 + phase[r * cols + c] * 10);
          let ch = line[c];
          const mutate = Math.sin(tBucket * 2.1 + phase[r * cols + c] * 100);
          if (mutate > 0.92) {
            ch = HEX_CHARS[(tBucket + c + r) & 15];
          }

          ctx.globalAlpha = alpha;
          // Bright cells in the band shift to a lighter tone.
          ctx.fillStyle = band > 0.6 ? '#0a4f2b' : '#000';
          ctx.fillText(ch, PAD_X + c * CELL_W, PAD_Y + r * CELL_H);
        }
      }

      // Horizontal scanline overlay (slow scroll).
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#000';
      const scanY = ((t * 40) % (rows * CELL_H + 200)) - 100;
      for (let y = -40; y < 40; y += 3) {
        ctx.fillRect(0, scanY + y, canvas.width / dpr, 1);
      }

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [seed, rows, cols]);

  return (
    <div ref={wrapRef} style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      opacity,
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {/* scattered tags (unchanged) */}
      {tags.map((t, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: t.x,
          top: t.y,
          background: t.invert ? COLORS.ink : COLORS.paper,
          color: t.invert ? COLORS.paper : COLORS.ink,
          border: `2px solid ${COLORS.ink}`,
          padding: '6px 14px',
          fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
          fontSize: TYPE_SCALE.tag,
          fontWeight: 700,
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
          transform: t.rotate ? `rotate(${t.rotate}deg)` : 'none',
        }}>
          {t.label}
        </div>
      ))}
    </div>
  );
}

// ---- Reusable bits --------------------------------------------------------

function Bracket({ children, size = TYPE_SCALE.hero, weight = 900 }) {
  return (
    <div style={{
      fontFamily: "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif",
      fontWeight: weight,
      fontSize: size,
      lineHeight: 0.92,
      letterSpacing: '-0.03em',
      color: COLORS.ink,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.12em',
    }}>
      <span>[</span>
      <span style={{ textWrap: 'balance' }}>{children}</span>
      <span>]</span>
    </div>
  );
}

function CornerLabel({ children, position = 'top-left' }) {
  const pos = ({
    'top-left':     { top: 44, left: 44 },
    'top-right':    { top: 44, right: 44 },
    'bottom-left':  { bottom: 44, left: 44 },
    'bottom-right': { bottom: 44, right: 44 },
  })[position];
  return (
    <div data-deco="corner" style={{
      position: 'absolute',
      ...pos,
      fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
      fontSize: TYPE_SCALE.mono,
      fontWeight: 700,
      letterSpacing: '0.14em',
      color: COLORS.ink,
      textTransform: 'uppercase',
    }}>
      {children}
    </div>
  );
}

function Sticker({ children, invert = false, style = {} }) {
  return (
    <span style={{
      display: 'inline-block',
      background: invert ? COLORS.ink : COLORS.paper,
      color: invert ? COLORS.paper : COLORS.ink,
      border: `2px solid ${COLORS.ink}`,
      padding: '6px 14px',
      fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
      fontSize: TYPE_SCALE.tag,
      fontWeight: 700,
      letterSpacing: '0.08em',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </span>
  );
}

function CTA({ children, filled = true }) {
  return (
    <div style={{
      background: filled ? COLORS.ink : 'transparent',
      color: filled ? COLORS.paper : COLORS.ink,
      border: `2px solid ${COLORS.ink}`,
      padding: '18px 44px',
      fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
      fontSize: TYPE_SCALE.small,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      display: 'inline-block',
    }}>
      {children}
    </div>
  );
}

function LogoMark({ small = false }) {
  const s = small ? 0.7 : 1;
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'stretch',
      border: `${3 * s}px solid ${COLORS.ink}`,
      background: COLORS.paper,
      padding: 0,
      height: 72 * s,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10 * s,
        padding: `0 ${18 * s}px`,
      }}>
        {/* Mark: a stylized pot/flame in a square */}
        <svg width={30 * s} height={30 * s} viewBox="0 0 30 30">
          <rect x="3" y="11" width="24" height="16" fill={COLORS.ink}/>
          <rect x="6" y="14" width="18" height="2" fill={COLORS.bg}/>
          <path d="M15 2 Q11 6 15 10 Q19 6 15 2" fill={COLORS.ink}/>
          <path d="M10 4 Q8 7 10 9" stroke={COLORS.ink} strokeWidth="1.5" fill="none"/>
          <path d="M20 4 Q22 7 20 9" stroke={COLORS.ink} strokeWidth="1.5" fill="none"/>
        </svg>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 24 * s,
          letterSpacing: '-0.01em',
          color: COLORS.ink,
          lineHeight: 1,
        }}>
          大师的AI小灶
        </div>
      </div>
      {/* barcode-y stripes like the reference */}
      <div style={{
        width: 90 * s,
        borderLeft: `${2 * s}px solid ${COLORS.ink}`,
        backgroundImage: `repeating-linear-gradient(90deg, ${COLORS.ink} 0 2px, transparent 2px 4px, ${COLORS.ink} 4px 5px, transparent 5px 9px)`,
      }} />
      <div style={{
        borderLeft: `${2 * s}px solid ${COLORS.ink}`,
        padding: `0 ${14 * s}px`,
        display: 'flex',
        alignItems: 'center',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 16 * s,
        fontWeight: 700,
        letterSpacing: '0.14em',
        color: COLORS.ink,
      }}>
        V1.0
      </div>
    </div>
  );
}

function SlideFrame({ children, withTexture = true, textureProps = {}, style = {} }) {
  const tweaks = useTweaksSubscribe();
  const densityOpacityMult = tweaks.density === 'low' ? 0 : tweaks.density === 'high' ? 1.4 : 1;
  const tProps = { ...textureProps, opacity: (textureProps.opacity ?? 0.4) * densityOpacityMult };
  const showTexture = withTexture && tweaks.density !== 'low';
  // Only override bg if caller didn't explicitly set one (e.g. Vision slide).
  const bg = style.background || style.backgroundColor || tweaks.bg;
  return (
    <div data-density={tweaks.density} style={{
      width: '100%',
      height: '100%',
      background: bg,
      position: 'relative',
      overflow: 'hidden',
      fontFamily: '"Helvetica Neue"',
      color: COLORS.ink,
      ...style,
      background: bg,
    }}>
      {showTexture && <HexTexture {...tProps} />}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}

// =========================================================================
// 01 — COVER
// =========================================================================
function SlideCover() {
  const tags = [
    { label: 'PROMPT INJECTION', x: 320, y: 70, invert: false },
    { label: 'CLAUDE CODE', x: 860, y: 140, invert: false },
    { label: 'MCP SERVER', x: 1500, y: 90, invert: false },
    { label: 'JAILBREAK', x: 120, y: 220, invert: false },
    { label: 'AGENT LOOP', x: 1200, y: 260, invert: false },
    { label: 'RAG', x: 1680, y: 220, invert: false },
    { label: 'TOKEN $$$', x: 540, y: 310, invert: false },
    { label: 'FINE-TUNE', x: 1420, y: 380, invert: false },
  ];
  return (
    <SlideFrame textureProps={{ seed: 11, rows: 24, cols: 150, opacity: 0.5, tags }}>
      <CornerLabel position="top-left">{'\n'}</CornerLabel>
      <CornerLabel position="top-right">{'EP. 001 — INTRO'}</CornerLabel>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        bottom: SPACING.padY,
        right: SPACING.padX,
      }}>
        <div style={{ marginBottom: 36 }}>
          <LogoMark />
        </div>

        <Bracket size={180}>
          大师的<br/>AI 小灶
        </Bracket>

        <div style={{
          marginTop: 38,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          lineHeight: 1.5,
          maxWidth: 1100,
        }}>
          I'M DASHI. I RUN A BACK-KITCHEN FOR AI —<br/>
          WHERE WE COOK TOOLS DOWN TO THEIR BONES<br/>
          SO YOU CAN ACTUALLY USE THEM.
        </div>

        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 50,
          alignItems: 'center',
        }}>
          <CTA filled>TASTE THE MENU</CTA>
          <CTA filled={false}>READ DOCS →</CTA>
          <div style={{
            marginLeft: 'auto',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: TYPE_SCALE.mono,
            fontWeight: 700,
            letterSpacing: '0.1em',
          }}>
            INTERNAL · STRATEGY DECK
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 01b — COVER VARIANT (oversized type, minimal tags)
// =========================================================================
function SlideCoverB() {
  const tags = [
    { label: '大师来了', x: 900, y: 60, invert: true },
    { label: 'SINGLE SERVING', x: 1480, y: 130, invert: false },
    { label: '不是教程 是小灶', x: 120, y: 160, invert: false },
  ];
  return (
    <SlideFrame textureProps={{ seed: 3, rows: 10, cols: 150, opacity: 0.35, tags }}>
      <CornerLabel position="top-left">{'// COVER · ALT'}</CornerLabel>
      <CornerLabel position="top-right">{'FILE: DASHI.INTRO.2026'}</CornerLabel>

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: `${SPACING.padY}px ${SPACING.padX}px`,
      }}>
        <div style={{ marginBottom: 40 }}>
          <LogoMark />
        </div>

        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 360,
          lineHeight: 0.55,
          letterSpacing: '-0.05em',
          color: COLORS.ink,
        }}>
          DASHI<br/>
          <span style={{ fontSize: 200, letterSpacing: '-0.04em' }}>'S AI 小灶</span>
        </div>

        <div style={{
          marginTop: 50,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 40,
        }}>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            fontSize: TYPE_SCALE.small,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            maxWidth: 780,
            lineHeight: 1.5,
          }}>
            ACCOUNT VISION & STRATEGY · 2026 →<br/>
            A SINGLE-SERVING DECK FOR THE TEAM.
          </div>
          <CTA filled>START COOKING ↗</CTA>
        </div>
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 02 — WHO IS DASHI
// =========================================================================
function SlideWho() {
  return (
    <SlideFrame textureProps={{ seed: 42, rows: 8, cols: 150, opacity: 0.22, tags: [
      { label: '4 YRS IN', x: 1450, y: 60, invert: false },
      { label: 'NOT A THEORIST', x: 140, y: 110, invert: false },
    ] }}>
      <CornerLabel position="top-left">{'// 02 · WHO IS DASHI'}</CornerLabel>
      <CornerLabel position="top-right">{'PROFILE.0x01'}</CornerLabel>

      <div style={{
        position: 'absolute',
        inset: 0,
        padding: `${SPACING.padY + 40}px ${SPACING.padX}px ${SPACING.padY}px`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 80,
        alignContent: 'center',
      }}>
        <div>
          <Bracket size={140}>
            WHO IS<br/>DASHI?
          </Bracket>
          <div style={{
            marginTop: 44,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: TYPE_SCALE.body,
            fontWeight: 600,
            lineHeight: 1.45,
            maxWidth: 700,
          }}>
            一个懂技术的说书人。<br/>
            不是教你 — 是聊给你听。
          </div>

          <div style={{
            marginTop: 50,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <Sticker>TECH BACKGROUND</Sticker>
            <Sticker>4 YRS IN AI</Sticker>
            <Sticker invert>HANDS-ON</Sticker>
            <Sticker>AGENT BUILDER</Sticker>
            <Sticker>PROMPT OPS</Sticker>
            <Sticker>DEV TOOLING</Sticker>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}>
          {[
            { k: '// 01', t: '自己写 skill、调配置、搭系统', s: 'BUILDS. DOESN\'T JUST POST.' },
            { k: '// 02', t: 'Agent 工作流 · 开发者工具链', s: 'DEEP IN THE STACK.' },
            { k: '// 03', t: '让普通人也能用好 AI 工具', s: 'TRANSLATES NERD → HUMAN.' },
            { k: '// 04', t: '朋友聊天式 · 有节奏 · 会自嘲', s: 'NO GURU ENERGY.' },
          ].map((row, i) => (
            <div key={i} style={{
              border: `3px solid ${COLORS.ink}`,
              background: 'rgba(255,255,255,0.55)',
              padding: '22px 28px',
              display: 'grid',
              gridTemplateColumns: '90px 1fr',
              gap: 24,
              alignItems: 'center',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: TYPE_SCALE.small,
                fontWeight: 800,
                letterSpacing: '0.1em',
              }}>{row.k}</div>
              <div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 36,
                  lineHeight: 1.15,
                  letterSpacing: '-0.01em',
                }}>{row.t}</div>
                <div style={{
                  marginTop: 6,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: TYPE_SCALE.mono,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  opacity: 0.7,
                }}>{row.s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div data-deco="footer" style={{
        position: 'absolute',
        bottom: 36,
        left: SPACING.padX,
        right: SPACING.padX,
        borderTop: `3px solid ${COLORS.ink}`,
        paddingTop: 18,
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: TYPE_SCALE.mono,
        fontWeight: 700,
        letterSpacing: '0.12em',
      }}>
        <div>{'> SIGNATURE: 我是大师，给你单独开小灶。'}</div>
        <div>02 / 08</div>
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 03 — THE MENU (positioning)
// =========================================================================
function SlideMenu() {
  return (
    <SlideFrame textureProps={{ seed: 66, rows: 6, cols: 150, opacity: 0.18, tags: [] }}>
      <CornerLabel position="top-left">{'// 03 · THE MENU'}</CornerLabel>
      <CornerLabel position="top-right">{'POSITIONING'}</CornerLabel>

      <div style={{
        position: 'absolute',
        top: SPACING.padY + 20,
        left: SPACING.padX,
        right: SPACING.padX,
      }}>
        <Bracket size={120}>THE MENU</Bracket>
        <div data-deco="subtitle" style={{
          marginTop: 24,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          WHAT WE COOK · 内容矩阵
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 24,
      }}>
        {[
          {
            n: '01',
            title: '工具测评',
            en: 'TOOL TEARDOWNS',
            body: '不是 "AI 应用"。是真打开设置面板，把参数调到骨头里。',
            tags: ['CLAUDE', 'CURSOR', 'GEMINI'],
          },
          {
            n: '02',
            title: '实战教程',
            en: 'HANDS-ON RECIPES',
            body: '跟着做，三十分钟之内有产出。失败案例也讲。',
            tags: ['AGENT', 'RAG', 'WORKFLOW'],
          },
          {
            n: '03',
            title: '工具链搭建',
            en: 'STACK BUILDING',
            body: '从 skill 到 MCP 到 pipeline，把点连成线。',
            tags: ['MCP', 'SKILLS', 'CHAIN'],
          },
        ].map((c, i) => (
          <div key={i} style={{
            border: `3px solid ${COLORS.ink}`,
            background: i === 1 ? COLORS.ink : COLORS.paper,
            color: i === 1 ? COLORS.paper : COLORS.ink,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            height: 520,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.small,
              fontWeight: 800,
              letterSpacing: '0.1em',
            }}>{`// ${c.n}`}</div>
            <div style={{
              marginTop: 20,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 68,
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
            }}>{c.title}</div>
            <div style={{
              marginTop: 10,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.mono,
              fontWeight: 700,
              letterSpacing: '0.14em',
              opacity: 0.7,
            }}>{c.en}</div>
            <div style={{
              marginTop: 32,
              fontSize: TYPE_SCALE.body - 4,
              fontWeight: 500,
              lineHeight: 1.4,
              fontFamily: "'Space Grotesk', sans-serif",
              flex: 1,
            }}>{c.body}</div>
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 20,
              paddingTop: 20,
              borderTop: `2px solid ${i === 1 ? 'rgba(255,255,255,0.3)' : COLORS.ink}`,
            }}>
              {c.tags.map((t, j) => (
                <span key={j} style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: TYPE_SCALE.mono,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  border: `2px solid ${i === 1 ? COLORS.paper : COLORS.ink}`,
                  padding: '4px 10px',
                }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 04 — BOX OFFICE (metrics)
// =========================================================================
function SlideMetrics() {
  return (
    <SlideFrame textureProps={{ seed: 99, rows: 6, cols: 150, opacity: 0.2, tags: [
      { label: 'GROWING', x: 1460, y: 80, invert: true },
    ] }}>
      <CornerLabel position="top-left">{'// 04 · BOX OFFICE'}</CornerLabel>
      <CornerLabel position="top-right">{'METRICS · YTD 2026'}</CornerLabel>

      <div style={{
        position: 'absolute',
        top: SPACING.padY + 20,
        left: SPACING.padX,
      }}>
        <Bracket size={120}>BOX OFFICE</Bracket>
        <div data-deco="subtitle" style={{
          marginTop: 22,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          粉丝成绩单 · 跨平台
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0,
        border: `4px solid ${COLORS.ink}`,
        background: COLORS.paper,
      }}>
        {[
          { plat: '抖音', enPlat: 'DOUYIN', num: '20', unit: 'W', note: '主阵地 · 日更节奏', w: '0.65' },
          { plat: '小红书', enPlat: 'RED', num: '8', unit: 'W', note: '深度图文 · 收藏率高', w: '0.26' },
          { plat: 'B 站', enPlat: 'BILIBILI', num: '5', unit: 'K', note: '长视频 · 技术深度播', w: '0.09' },
        ].map((m, i) => (
          <div key={i} style={{
            padding: '36px 32px 28px',
            borderLeft: i ? `4px solid ${COLORS.ink}` : 'none',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.mono,
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}>
              <span>{`PLATFORM 0${i+1}`}</span>
              <span>{m.enPlat}</span>
            </div>

            <div style={{
              marginTop: 18,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 42,
              letterSpacing: '-0.02em',
            }}>{m.plat}</div>

            <div style={{
              marginTop: 24,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
            }}>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: TYPE_SCALE.mega,
                lineHeight: 0.85,
                letterSpacing: '-0.05em',
              }}>{m.num}</div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: 90,
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
              }}>{m.unit}</div>
            </div>

            <div style={{
              marginTop: 8,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.mono,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.65,
            }}>
              FOLLOWERS
            </div>

            <div style={{
              marginTop: 28,
              paddingTop: 20,
              borderTop: `2px solid ${COLORS.ink}`,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: TYPE_SCALE.body - 4,
              fontWeight: 500,
            }}>{m.note}</div>

            {/* weight bar */}
            <div style={{
              marginTop: 18,
              height: 10,
              border: `2px solid ${COLORS.ink}`,
              position: 'relative',
              background: COLORS.paper,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                width: `${parseFloat(m.w) * 100}%`,
                background: COLORS.ink,
              }}/>
            </div>
          </div>
        ))}
      </div>

      {/* total strip */}
      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY + 480,
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'flex-end',
        gap: 20,
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>{'\n'}</div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 130,
          lineHeight: 0.85,
          letterSpacing: '-0.04em',
        }}>{'\n'}<span style={{ fontSize: 80 }}>W</span></div>
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 05 — HOUSE SPECIALS (hit content)
// =========================================================================
function SlideSpecials() {
  return (
    <SlideFrame textureProps={{ seed: 123, rows: 6, cols: 150, opacity: 0.18, tags: [] }}>
      <CornerLabel position="top-left">{'// 05 · HOUSE SPECIALS'}</CornerLabel>
      <CornerLabel position="top-right">{'TOP PERFORMERS'}</CornerLabel>

      <div style={{
        position: 'absolute',
        top: SPACING.padY + 10,
        left: SPACING.padX,
        right: SPACING.padX,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        <Bracket size={120}>HOUSE<br/>SPECIALS</Bracket>
        <div data-deco="subtitle" style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          textAlign: 'right',
          lineHeight: 1.4,
        }}>
          小灶里的招牌菜<br/>
          <span style={{ opacity: 0.55 }}>&gt; WHAT ACTUALLY HIT</span>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 20,
      }}>
        {[
          {
            rank: '#1',
            title: '三分钟把 Claude Code 调成你的形状',
            tag: 'CLAUDE CODE',
            plat: '抖音',
            metric: '142W',
            metricLabel: '播放',
          },
          {
            rank: '#2',
            title: '我把 MCP 当 USB-C 用了一周',
            tag: 'MCP',
            plat: '小红书',
            metric: '3.8W',
            metricLabel: '收藏',
          },
          {
            rank: '#3',
            title: '别再手写 prompt 了，写 skill 吧',
            tag: 'SKILLS',
            plat: '抖音',
            metric: '96W',
            metricLabel: '播放',
          },
          {
            rank: '#4',
            title: 'Agent 为什么总在第三步崩',
            tag: 'AGENT LOOP',
            plat: 'B站',
            metric: '22W',
            metricLabel: '播放',
          },
        ].map((c, i) => (
          <div key={i} style={{
            border: `3px solid ${COLORS.ink}`,
            background: COLORS.paper,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: 540,
          }}>
            {/* thumbnail placeholder */}
            <div style={{
              height: 220,
              background: COLORS.ink,
              color: COLORS.bg,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 18,
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `repeating-linear-gradient(-20deg, transparent 0 18px, rgba(22,240,139,0.09) 18px 19px)`,
              }}/>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 900,
                fontSize: 120,
                lineHeight: 0.85,
                letterSpacing: '-0.05em',
                color: COLORS.bg,
                position: 'relative',
              }}>{c.rank}</div>
              <div style={{
                position: 'absolute',
                top: 14,
                right: 14,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: COLORS.bg,
                opacity: 0.6,
              }}>[THUMB]</div>
            </div>

            <div style={{
              padding: 22,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  border: `2px solid ${COLORS.ink}`,
                  padding: '2px 8px',
                }}>{c.tag}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  background: COLORS.ink,
                  color: COLORS.paper,
                  padding: '2px 8px',
                }}>{c.plat}</span>
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                flex: 1,
              }}>{c.title}</div>
              <div style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: `2px solid ${COLORS.ink}`,
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
              }}>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 900,
                  fontSize: 54,
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                }}>{c.metric}</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  opacity: 0.6,
                }}>{c.metricLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 06 — THE VISION
// =========================================================================
function SlideVision() {
  return (
    <SlideFrame withTexture={false} style={{ background: COLORS.ink, color: COLORS.bg }}>
      {/* inverted color: black bg, green type */}
      <div style={{
        position: 'absolute', inset: 0,
        opacity: 0.35,
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 16,
        lineHeight: 1.55,
        letterSpacing: '0.02em',
        color: COLORS.bg,
        userSelect: 'none',
        pointerEvents: 'none',
        padding: '20px 40px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {Array.from({length: 22}, (_, r) => seededHex(200 + r*101, 150)).join('\n')}
      </div>

      {/* scattered stickers */}
      {[
        { label: '华语 AI 内容', x: 180, y: 70 },
        { label: 'THE DEFAULT STOP', x: 1400, y: 100 },
        { label: '第一站', x: 1680, y: 210 },
        { label: '\u4e2d\u6587 \u00b7 CN', x: 140, y: 200 },
      ].map((t, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: t.x, top: t.y,
          background: COLORS.bg,
          color: COLORS.ink,
          border: `2px solid ${COLORS.bg}`,
          padding: '6px 14px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.tag,
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}>{t.label}</div>
      ))}

      <div data-deco="corner" style={{ position: 'absolute', top: 44, left: 44,
        fontFamily: 'JetBrains Mono, monospace', fontSize: TYPE_SCALE.mono,
        fontWeight: 700, letterSpacing: '0.14em',
      }}>{'// 06 · THE VISION'}</div>
      <div data-deco="corner" style={{ position: 'absolute', top: 44, right: 44,
        fontFamily: 'JetBrains Mono, monospace', fontSize: TYPE_SCALE.mono,
        fontWeight: 700, letterSpacing: '0.14em',
      }}>MISSION STATEMENT</div>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY,
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginBottom: 28,
        }}>
          [ VISION · 三年后要在的位置 ]
        </div>

        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 168,
          lineHeight: 1.3,
          letterSpacing: '-7px',
          color: COLORS.bg,
        }}>
          [ 成为华语 AI 内容的<br/>
          <span style={{ background: COLORS.bg, color: COLORS.ink, padding: '0 20px' }}>第一站。</span> ]
        </div>

        <div style={{
          marginTop: 44,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
          borderTop: `3px solid ${COLORS.bg}`,
          paddingTop: 28,
        }}>
          {[
            { k: 'WHO', v: '讲中文的、想用好 AI 的所有人。不论是工程师还是 HR。' },
            { k: 'WHAT', v: '打开就能上手的实操内容 — 有温度、有节奏、有脾气。' },
            { k: 'HOW', v: '一个懂技术的说书人，守着这间小灶，天天开火。' },
          ].map((r, i) => (
            <div key={i}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 800,
                fontSize: TYPE_SCALE.mono,
                letterSpacing: '0.2em',
                opacity: 0.65,
                marginBottom: 10,
              }}>{`// ${r.k}`}</div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 28,
                lineHeight: 1.35,
                letterSpacing: '-0.005em',
              }}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 07 — ROADMAP
// =========================================================================
function SlideRoadmap() {
  const phases = [
    {
      q: 'NOW',
      range: '2026 Q2',
      title: '巩固主阵地',
      pts: ['抖音日更稳 20W+', '小红书图文深耕', '选题库系统化'],
      status: 'IN PROGRESS',
    },
    {
      q: 'NEXT',
      range: '2026 H2',
      title: '跨平台破圈',
      pts: ['B 站长视频加码到 5W', '开播客 · 每周 1 期', '进驻 X / 小宇宙'],
      status: 'QUEUED',
    },
    {
      q: 'LATER',
      range: '2027',
      title: '产品化',
      pts: ['自研 Skill 模板库', '付费小课 / 陪练社群', '品牌合作精选盒子'],
      status: 'PLANNED',
    },
    {
      q: 'NORTH ★',
      range: '2028',
      title: '第一站',
      pts: ['华语 AI 内容默认入口', '100W+ 跨平台生态', '被引用 · 被模仿 · 被信赖'],
      status: 'NORTH STAR',
    },
  ];
  return (
    <SlideFrame textureProps={{ seed: 333, rows: 6, cols: 150, opacity: 0.15, tags: [] }}>
      <CornerLabel position="top-left">{'// 07 · ROADMAP'}</CornerLabel>
      <CornerLabel position="top-right">{'FORWARD LOOK'}</CornerLabel>

      <div style={{
        position: 'absolute',
        top: SPACING.padY + 10,
        left: SPACING.padX,
        right: SPACING.padX,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
      }}>
        <Bracket size={120}>ROADMAP</Bracket>
        <div data-deco="subtitle" style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          2026 → 2028 · 从内容到生态
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: SPACING.padX,
        right: SPACING.padX,
        bottom: SPACING.padY,
        border: `4px solid ${COLORS.ink}`,
        background: COLORS.paper,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
      }}>
        {phases.map((p, i) => (
          <div key={i} style={{
            borderLeft: i ? `3px solid ${COLORS.ink}` : 'none',
            padding: '28px 24px 24px',
            background: i === 3 ? COLORS.ink : COLORS.paper,
            color: i === 3 ? COLORS.paper : COLORS.ink,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 540,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.small,
              fontWeight: 800,
              letterSpacing: '0.14em',
            }}>{p.q}</div>
            <div style={{
              marginTop: 6,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: TYPE_SCALE.mono,
              fontWeight: 700,
              letterSpacing: '0.12em',
              opacity: 0.6,
            }}>{p.range}</div>

            <div style={{
              marginTop: 24,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 900,
              fontSize: 56,
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
            }}>{p.title}</div>

            <ul style={{
              marginTop: 26,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flex: 1,
            }}>
              {p.pts.map((pt, j) => (
                <li key={j} style={{
                  display: 'grid',
                  gridTemplateColumns: '22px 1fr',
                  gap: 10,
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 22,
                  fontWeight: 500,
                  lineHeight: 1.35,
                }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 800,
                  }}>→</span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>

            <div style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: `2px solid ${i === 3 ? 'rgba(255,255,255,0.3)' : COLORS.ink}`,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.14em',
            }}>
              [{p.status}]
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

// =========================================================================
// 08 — ONE MORE THING (sign off)
// =========================================================================
function SlideEnd() {
  const tags = [
    { label: "LET'S COOK", x: 260, y: 80, invert: true },
    { label: '开火', x: 1400, y: 120, invert: false },
    { label: 'SKILL ISSUE? NO.', x: 1560, y: 260, invert: false },
    { label: '小灶已上桌', x: 160, y: 250, invert: false },
  ];
  return (
    <SlideFrame textureProps={{ seed: 555, rows: 20, cols: 150, opacity: 0.35, tags }}>
      <CornerLabel position="top-left">{'// 08 · ONE MORE THING'}</CornerLabel>
      <CornerLabel position="top-right">{'END OF DECK · THX'}</CornerLabel>

      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: `${SPACING.padY}px ${SPACING.padX}px`,
      }}>
        <div data-deco="subtitle" style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: TYPE_SCALE.small,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>
          [ SIGNATURE · 片尾 ]
        </div>
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 900,
          fontSize: 200,
          lineHeight: 0.9,
          letterSpacing: '-0.05em',
        }}>
          我是大师，<br/>
          <span style={{
            background: COLORS.ink,
            color: COLORS.bg,
            padding: '0 28px',
            display: 'inline-block',
          }}>给你单独开小灶。</span>
        </div>

        <div style={{
          marginTop: 60,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 40,
          borderTop: `3px solid ${COLORS.ink}`,
          paddingTop: 28,
        }}>
          <div>
            <LogoMark small />
          </div>
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: TYPE_SCALE.small,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign: 'right',
            lineHeight: 1.6,
          }}>
            DOUYIN · RED · BILIBILI<br/>
            <span style={{ opacity: 0.6 }}>@大师的AI小灶</span>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

// Expose for the main HTML
Object.assign(window, {
  SlideCover,
  SlideCoverB,
  SlideWho,
  SlideMenu,
  SlideMetrics,
  SlideSpecials,
  SlideVision,
  SlideRoadmap,
  SlideEnd,
});
