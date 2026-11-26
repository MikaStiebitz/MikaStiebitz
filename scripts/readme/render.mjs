// The README is one git graph that runs down the page, cut into full-width
// SVG strips so every station can be its own link. The strips share one
// timeline: on load the path grows from the top strip to the bottom one,
// then a commit dot keeps travelling down it.
//
// No external fonts or images: GitHub serves README images through camo,
// which blocks anything an <img> SVG would fetch. Photos are inlined as
// data URIs. Animations are SMIL, which works inside <img>.

const MONO = `'JetBrains Mono','SFMono-Regular','SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;
const SANS = `'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif`;

// Palette borrowed from Git-Mastery.
export const C = {
  bg: "#0C091F",
  border: "#2B2450",
  text: "#F5F4FD",
  soft: "#B9B4D6",
  muted: "#7C7699",
  dim: "#3B3460",
  main: "#9455EF",
  lime: "#B7F652",
  cyan: "#44DDFB",
  yellow: "#FDC94B",
  lavender: "#C4B5FD",
};

export const W = 840;
const MAIN = 44; // x of the main branch
const LANE = 100; // x of the side branch
const TEXT = 148; // x where content starts
const RIGHT = W - 36;

const GROW = 520; // px/s the path grows at on load
const FLOW = 230; // px/s of the looping commit dot

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const f = (n) => String(Math.round(n * 1000) / 1000);

function wrap(text, maxChars, maxLines) {
  const lines = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = clip(lines[maxLines - 1] + " …", maxChars);
  }
  return lines;
}

/* ───────────────────────────── shared timeline ───────────────────────────── */

// Every strip is drawn with a ctx: where it sits on the page (y0), where the
// path starts and ends (g0, g1, page coordinates) and how it is framed.
const growAt = (ctx, y) => Math.max(0, ctx.y0 + y - ctx.g0) / GROW + 0.3;
const flowStart = (ctx) => (ctx.g1 - ctx.g0) / GROW + 0.9;
const flowDur = (ctx) => (ctx.g1 - ctx.g0) / FLOW + 1.6;
const flowKey = (ctx, y) => Math.min(0.999, Math.max(0, (ctx.y0 + y - ctx.g0) / FLOW / flowDur(ctx)));

// keyTimes that switch something on only while the dot is inside [y1, y2].
function window_(ctx, y1, y2) {
  const a = flowKey(ctx, y1);
  const b = Math.max(a + 0.001, flowKey(ctx, y2));
  return { a, b, on: `0;${f(a)};${f(a + 0.0005)};${f(b)};${f(b + 0.0005)};1` };
}

const loop = (ctx) => `begin="${f(flowStart(ctx))}s" dur="${f(flowDur(ctx))}s" repeatCount="indefinite"`;

function mainRail(ctx, y1, y2) {
  const len = y2 - y1;
  const { a, b, on } = window_(ctx, y1, y2);
  return `<line x1="${MAIN}" y1="${y1}" x2="${MAIN}" y2="${y2}" stroke="${C.main}" stroke-opacity=".18" stroke-width="10" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"><animate attributeName="stroke-dashoffset" begin="${f(growAt(ctx, y1))}s" dur="${f(len / GROW)}s" to="0" fill="freeze"/></line>
<line x1="${MAIN}" y1="${y1}" x2="${MAIN}" y2="${y2}" stroke="${C.main}" stroke-width="3" stroke-dasharray="${len}" stroke-dashoffset="${len}"><animate attributeName="stroke-dashoffset" begin="${f(growAt(ctx, y1))}s" dur="${f(len / GROW)}s" to="0" fill="freeze"/></line>
<circle cx="${MAIN}" cy="${y1}" r="5" fill="#FFFFFF" filter="url(#glow)" opacity="0">
  <animate attributeName="cy" values="${y1};${y1};${y2};${y2}" keyTimes="0;${f(a)};${f(b)};1" ${loop(ctx)}/>
  <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${on}" ${loop(ctx)}/>
</circle>`;
}

// A side branch: draws itself when the growing path reaches it, then carries its own dot.
function branch(ctx, d, color, yStart, yEnd) {
  const { a, b, on } = window_(ctx, yStart, yEnd);
  return `<path d="${d}" pathLength="1" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" begin="${f(growAt(ctx, yStart))}s" dur="${f(Math.max(0.5, (yEnd - yStart) / GROW))}s" to="0" fill="freeze"/></path>
<circle r="4.5" fill="${color}" filter="url(#glow)" opacity="0">
  <animateMotion path="${d}" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${f(a)};${f(b)};1" ${loop(ctx)}/>
  <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${on}" ${loop(ctx)}/>
</circle>`;
}

function node(ctx, x, y, color, { r = 7, hollow = false, pulse = false, dashed = false } = {}) {
  const t = f(growAt(ctx, y));
  const halo = pulse
    ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0"><animate attributeName="r" values="${r};${r * 2.8}" dur="1.8s" begin="${t}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".5;0" dur="1.8s" begin="${t}s" repeatCount="indefinite"/></circle>`
    : "";
  return `${halo}<circle cx="${x}" cy="${y}" r="0" fill="${hollow ? C.bg : color}" stroke="${color}" stroke-width="3"${dashed ? ' stroke-dasharray="3 3"' : ""}><animate attributeName="r" begin="${t}s" dur=".35s" values="0;${r * 1.35};${r}" fill="freeze"/></circle>`;
}

// Content fades and slides in as the growing path passes it.
function reveal(ctx, y, inner) {
  const t = f(growAt(ctx, y) + 0.05);
  return `<g opacity="0"><animate attributeName="opacity" begin="${t}s" dur=".5s" to="1" fill="freeze"/><animateTransform attributeName="transform" type="translate" begin="${t}s" dur=".5s" from="-10 0" to="0 0" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/>
${inner}
</g>`;
}

function pill(x, y, label, color) {
  const w = label.length * 7.6 + 22;
  return `<rect x="${x}" y="${y}" width="${f(w)}" height="24" rx="12" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".55"/>
<text x="${x + 11}" y="${y + 16.5}" font-family="${MONO}" font-size="12.5" font-weight="700" fill="${color}">${esc(label)}</text>`;
}

const text = (x, y, s, { size = 15, fill = C.soft, font = SANS, weight, anchor, extra = "" } = {}) =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${fill}"${weight ? ` font-weight="${weight}"` : ""}${anchor ? ` text-anchor="${anchor}"` : ""}${extra}>${s}</text>`;

function frame(ctx, h) {
  const r = 18;
  if (ctx.edge === "top")
    return `<path d="M.5 ${h}V${r}a${r - 0.5} ${r - 0.5} 0 0 1 ${r - 0.5}-${r - 0.5}h${W - 2 * r}a${r - 0.5} ${r - 0.5} 0 0 1 ${r - 0.5} ${r - 0.5}V${h}" fill="${C.bg}" stroke="${C.border}"/>`;
  if (ctx.edge === "bottom")
    return `<path d="M.5 0V${h - r}a${r - 0.5} ${r - 0.5} 0 0 0 ${r - 0.5} ${r - 0.5}h${W - 2 * r}a${r - 0.5} ${r - 0.5} 0 0 0 ${r - 0.5}-${r - 0.5}V0" fill="${C.bg}" stroke="${C.border}"/>`;
  return `<rect width="${W}" height="${h}" fill="${C.bg}"/><path d="M.5 0V${h}M${W - 0.5} 0V${h}" stroke="${C.border}"/>`;
}

function svg(ctx, h, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" fill="none" role="img">
<defs>
<filter id="glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
${defs}
</defs>
${frame(ctx, h)}
${body}
</svg>
`;
}

/* ───────────────────────────── strips ───────────────────────────── */
// Each strip is { name, h, railStart?, railEnd?, draw(ctx) }.

export function head(d) {
  const h = 232;
  const nodeY = 114;
  return {
    name: "head",
    h,
    railStart: nodeY,
    alt: `${d.displayName}. ${d.tagline} ${d.stats.join(", ")}.`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `<rect x="1" y="1" width="${W - 2}" height="${h - 1}" rx="17" fill="url(#halo)"/>
${text(TEXT, 40, `<tspan fill="${C.lime}">$</tspan> git log --graph --all`, { size: 13, font: MONO, fill: C.muted, extra: ' clip-path="url(#type)"' })}
${mainRail(ctx, nodeY, h)}
${node(ctx, MAIN, nodeY, C.main, { r: 9, pulse: true })}
${reveal(
  ctx,
  nodeY,
  `${pill(TEXT, 60, "HEAD → main", C.main)}
${text(TEXT - 3, 136, `${esc(d.displayName)}<tspan fill="${C.lime}">.</tspan>`, { size: 52, weight: 800, fill: C.text, extra: ' letter-spacing="-1.8"' })}
${text(TEXT, 168, esc(d.tagline), { size: 16.5 })}`,
)}
${reveal(ctx, nodeY + 80, text(TEXT, 204, esc(d.stats.join("   ·   ")), { size: 13, font: MONO, fill: C.muted, extra: ' xml:space="preserve"' }))}`,
        `<radialGradient id="halo" cx="88%" cy="0%" r="70%"><stop offset="0" stop-color="${C.main}" stop-opacity=".22"/><stop offset="1" stop-color="${C.main}" stop-opacity="0"/></radialGradient>
<clipPath id="type"><rect x="${TEXT}" y="24" width="0" height="24"><animate attributeName="width" begin=".1s" dur=".7s" to="260" fill="freeze"/></rect></clipPath>`,
      ),
  };
}

export function work(d) {
  const lines = [[d.role, d.since ? `since ${d.since}` : null].filter(Boolean).join("  ·  "), d.what].filter(Boolean);
  const stackY = 100 + lines.length * 22 + 6;
  const h = stackY + 34;
  const nodeY = 58;
  return {
    name: "work",
    h,
    alt: `Day job: ${d.role} at ${d.company}, ${d.group}. ${d.stack.join(", ")}.`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, h)}
${node(ctx, MAIN, nodeY, C.main)}
${reveal(
  ctx,
  nodeY,
  `${text(TEXT, 34, "main  ·  day job", { size: 12.5, font: MONO, fill: C.main, weight: 700, extra: ' xml:space="preserve"' })}
${text(TEXT, 68, `${esc(d.company)}<tspan fill="${C.soft}" font-weight="600">  ·  ${esc(d.group)}</tspan>`, { size: 26, weight: 800, fill: C.text, extra: ' letter-spacing="-.5" xml:space="preserve"' })}
${lines.map((l, i) => text(TEXT, 98 + i * 22, esc(l), { size: 15.5, extra: ' xml:space="preserve"' })).join("\n")}
${text(TEXT, stackY, esc(d.stack.join("  ·  ")), { size: 13, font: MONO, fill: C.muted, extra: ' xml:space="preserve"' })}`,
)}`,
      ),
  };
}

// Where a side branch leaves main at the top of a strip.
const fork = (h) => `M${MAIN} 8C${MAIN} 38 ${LANE} 30 ${LANE} 60V${h}`;

export function project(p) {
  const color = C[p.color] ?? C.lime;
  const desc = wrap(p.description, 88, 2);
  const metaY = 112 + desc.length * 22 + 8;
  const h = metaY + 26;
  const meta = [`★ ${p.stars}`, p.forks ? `⑂ ${p.forks}` : null, p.language, p.link ? `${p.link} ↗` : null].filter(Boolean);
  return {
    name: p.slug,
    h,
    href: p.url,
    alt: `${p.name}: ${p.description}`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, h)}
${branch(ctx, fork(h), color, 8, h)}
${node(ctx, LANE, 70, color, { pulse: true })}
${reveal(
  ctx,
  60,
  `${pill(TEXT, 22, p.branch, color)}
${text(TEXT - 1, 84, esc(p.name), { size: 30, weight: 800, fill: C.text, extra: ' letter-spacing="-.8"' })}
${desc.map((l, i) => text(TEXT, 112 + i * 22, esc(l), { size: 15.5 })).join("\n")}
${text(TEXT, metaY, esc(meta.join("    ")), { size: 13, font: MONO, fill: C.muted, extra: ' xml:space="preserve"' })}`,
)}`,
      ),
  };
}

// Photos of a project. Holds no live data, so the file only changes when the images do.
export function shots(p) {
  const color = C[p.color] ?? C.lime;
  const gap = 14;
  const n = p.images.length;
  const iw = (RIGHT - TEXT - gap * (n - 1)) / n;
  const ih = Math.round(Math.min(...p.images.map((im) => (iw * im.height) / im.width)));
  const top = 4;
  const h = top + ih + 54;
  const shipped = p.state === "shipped";
  const endY = h - 24;
  const d = shipped
    ? `M${LANE} 0V${endY - 52}C${LANE} ${endY - 22} ${MAIN} ${endY - 30} ${MAIN} ${endY}`
    : `M${LANE} 0V${endY}`;
  return {
    name: `${p.slug}-shot`,
    h,
    href: p.url,
    alt: `${p.name}: ${p.images.map((im) => im.alt).join("; ")}`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, h)}
${branch(ctx, d, color, 0, endY)}
${shipped ? node(ctx, MAIN, endY, C.main, { r: 6 }) : node(ctx, LANE, endY, color, { r: 6, hollow: true, pulse: true })}
${reveal(
  ctx,
  top + 20,
  p.images
    .map((im, i) => {
      const x = TEXT + i * (iw + gap);
      return `<image href="data:${im.mime};base64,${im.base64}" x="${f(x)}" y="${top}" width="${f(iw)}" height="${ih}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>
<rect x="${f(x + 0.5)}" y="${top + 0.5}" width="${f(iw - 1)}" height="${ih - 1}" rx="12" stroke="${color}" stroke-opacity=".4"/>`;
    })
    .join("\n"),
)}
${reveal(ctx, endY, text(TEXT, endY + 4, esc(p.note), { size: 12.5, font: MONO, fill: shipped ? C.muted : color }))}`,
        p.images.map((_, i) => `<clipPath id="c${i}"><rect x="${f(TEXT + i * (iw + gap))}" y="${top}" width="${f(iw)}" height="${ih}" rx="12"/></clipPath>`).join("\n"),
      ),
  };
}

export function moreHeader() {
  const h = 46;
  return {
    name: "more",
    h,
    alt: "More branches, most recently pushed first:",
    draw: (ctx) =>
      svg(ctx, h, `${mainRail(ctx, 0, h)}\n${reveal(ctx, 20, text(TEXT, 30, `<tspan fill="${C.lime}">$</tspan> git branch --sort=-committerdate`, { size: 13, font: MONO, fill: C.muted }))}`),
  };
}

export function moreRow(r) {
  const h = 62;
  const y = 30;
  const d = `M${MAIN} 2C${MAIN} 22 ${LANE - 28} ${y} ${LANE} ${y}`;
  return {
    name: `more-${r.slug}`,
    h,
    href: r.url,
    alt: `${r.name}: ${r.description}`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, h)}
${branch(ctx, d, C.lavender, 2, y)}
${node(ctx, LANE, y, C.lavender, { r: 5, hollow: true })}
${reveal(
  ctx,
  y,
  `${text(TEXT, y - 2, esc(r.name), { size: 17, weight: 700, fill: C.text })}
${text(TEXT, y + 19, esc(clip(r.description, 84)), { size: 13.5, fill: C.muted })}
${text(RIGHT, y - 2, esc([r.language, `★ ${r.stars}`].filter(Boolean).join("   ")), { size: 12.5, font: MONO, fill: C.soft, anchor: "end", extra: ' xml:space="preserve"' })}`,
)}`,
      ),
  };
}

export function visitors(v) {
  const color = C.yellow;
  const rows = v.commits;
  const rowsY = 150;
  const step = 27;
  const slotY = rowsY + rows.length * step;
  const h = slotY + 34;
  const d = `M${MAIN} 8C${MAIN} 38 ${LANE} 30 ${LANE} 60V${slotY - 4}`;
  return {
    name: "visitors",
    h,
    href: v.href,
    alt: `Visitors branch: ${rows.length ? rows.map((r) => `@${r.login}`).join(", ") : "no commits yet"}. Click to leave your own commit.`,
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, h)}
${branch(ctx, d, color, 8, slotY - 4)}
${node(ctx, LANE, 70, color)}
${reveal(
  ctx,
  60,
  `${pill(TEXT, 22, "visitors", color)}
${text(TEXT - 1, 82, "Your turn: leave a commit.", { size: 24, weight: 800, fill: C.text, extra: ' letter-spacing="-.5"' })}
${text(TEXT, 108, "Pick a message under this graph. A bot commits your name to this branch.", { size: 14.5 })}`,
)}
${rows
  .map((r, i) => {
    const y = rowsY + i * step;
    return `${node(ctx, LANE, y - 4, color, { r: 4.5 })}
${reveal(
  ctx,
  y,
  `${text(TEXT, y, `<tspan fill="${C.muted}">${esc(r.hash)}</tspan>  <tspan fill="${C.text}" font-weight="700">@${esc(clip(r.login, 24))}</tspan>  <tspan fill="${C.soft}">"${esc(r.message)}"</tspan>`, { size: 13, font: MONO, extra: ' xml:space="preserve"' })}
${text(RIGHT, y, esc(r.date), { size: 12.5, font: MONO, fill: C.muted, anchor: "end" })}`,
)}`;
  })
  .join("\n")}
${node(ctx, LANE, slotY - 4, color, { r: 5.5, hollow: true, dashed: true, pulse: true })}
${reveal(ctx, slotY, text(TEXT, slotY, rows.length ? "← your commit goes here" : "← no commits yet. be the first.", { size: 13, font: MONO, fill: color }))}`,
      ),
  };
}

export function tail() {
  const h = 76;
  const nodeY = 32;
  return {
    name: "tail",
    h,
    railEnd: nodeY,
    alt: "To be continued.",
    draw: (ctx) =>
      svg(
        ctx,
        h,
        `${mainRail(ctx, 0, nodeY)}
${node(ctx, MAIN, nodeY, C.main, { r: 8, hollow: true, pulse: true })}
${reveal(
  ctx,
  nodeY,
  `${text(TEXT, nodeY + 5, "to be continued", { size: 13, font: MONO, fill: C.muted })}
<rect x="${TEXT + 126}" y="${nodeY - 8}" width="8" height="15" rx="1" fill="${C.lime}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`,
)}`,
      ),
  };
}

// Lays the strips out top to bottom and renders them on one shared timeline.
export function layout(strips) {
  let y = 0;
  const placed = strips.map((s) => {
    const at = { ...s, y0: y };
    y += s.h;
    return at;
  });
  const first = placed[0];
  const last = placed[placed.length - 1];
  const g0 = first.y0 + (first.railStart ?? 0);
  const g1 = last.y0 + (last.railEnd ?? last.h);
  return placed.map((s, i) => ({
    ...s,
    svg: s.draw({ y0: s.y0, g0, g1, edge: i === 0 ? "top" : i === placed.length - 1 ? "bottom" : "mid" }),
  }));
}
