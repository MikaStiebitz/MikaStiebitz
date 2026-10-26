// Hand-rolled, animated SVG renderers. No external fonts or images: GitHub
// serves README images through camo, which blocks anything an <img> SVG
// would fetch. Animations are SMIL, which works inside <img>.

const MONO = `'JetBrains Mono','SFMono-Regular','SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;
const SANS = `'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif`;

const C = {
  bg: "#0B0B0D",
  border: "#232329",
  text: "#F2F2F2",
  soft: "#B3B3B8",
  muted: "#75757C",
  dim: "#3A3A40",
  faint: "#1A1A1F",
  accent: "#B8FF6B",
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const f = (n) => Number(n).toFixed(2);

export function ago(iso, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 90) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)}d`;
  if (s < 86400 * 60) return `${Math.round(s / 604800)}w`;
  if (s < 86400 * 365) return `${Math.round(s / 2629800)}mo`;
  return `${(s / 31557600).toFixed(1).replace(/\.0$/, "")}y`;
}

function wrap(text, maxChars, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length <= maxChars) cur = (cur + " " + w).trim();
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = clip(lines[maxLines - 1] + " …", maxChars).replace(/ …$/, "…");
  }
  return lines;
}

// <text> made of differently styled runs: [[text, fill, bold?], ...]
function runs(x, y, parts, { size = 13, font = MONO, extra = "" } = {}) {
  const t = parts
    .filter(([s]) => s)
    .map(([s, fill, bold]) => `<tspan fill="${fill}"${bold ? ' font-weight="700"' : ""}>${esc(s)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" xml:space="preserve"${extra}>${t}</text>`;
}

const blink = `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/>`;

// Fades + slides a group in.
const enter = (begin, dx = 0, dy = 8) =>
  `<animate attributeName="opacity" begin="${f(begin)}s" dur=".5s" to="1" fill="freeze"/>
  <animateTransform attributeName="transform" type="translate" begin="${f(begin)}s" dur=".5s" from="${dx} ${dy}" to="0 0" fill="freeze" additive="sum" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/>`;

// Reveals content left to right, like text being typed.
const wipe = (id, x, y, w, h, begin, dur) =>
  `<clipPath id="${id}"><rect x="${x}" y="${y}" width="0" height="${h}"><animate attributeName="width" begin="${f(begin)}s" dur="${dur}s" to="${w}" fill="freeze"/></rect></clipPath>`;

const grow = (to, begin, dur = 1.1) =>
  `<animate attributeName="width" begin="${f(begin)}s" dur="${dur}s" to="${f(to)}" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"/>`;

function pulseDot(cx, cy, r = 4) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.accent}" fill-opacity=".35"><animate attributeName="r" values="${r};${r * 2.6}" dur="1.6s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values=".45;0" dur="1.6s" repeatCount="indefinite"/></circle>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.accent}"/>`;
}

function svg(w, h, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img">
<defs>
  <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  ${defs}
</defs>
${body}
</svg>
`;
}

// Window chrome: rounded panel, muted dots, a label, optional live marker.
function windowFrame(w, h, label, { live = false } = {}) {
  return `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" fill="${C.bg}" stroke="${C.border}"/>
<circle cx="24" cy="22" r="5" fill="${C.dim}"/><circle cx="41" cy="22" r="5" fill="${C.dim}"/><circle cx="58" cy="22" r="5" fill="${C.dim}"/>
<text x="76" y="26" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.muted}">${esc(label.toUpperCase())}</text>
${live ? `${pulseDot(w - 64, 22, 3.5)}<text x="${w - 22}" y="26" text-anchor="end" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${C.accent}">LIVE</text>` : ""}
<line x1="1" y1="44.5" x2="${w - 1}" y2="44.5" stroke="${C.border}"/>`;
}

/* ───────────────────────────── boot screen ───────────────────────────── */

export function renderBoot(d) {
  const W = 880;
  const X = 36;
  const COL = 44;
  const stamp = new Date(d.now).toISOString();
  const dots = (label) => " " + ".".repeat(Math.max(2, COL - label.length - 1)) + " ";

  const ok = (label, value) => [["[ ", C.dim], ["OK", C.accent, true], [" ]  ", C.dim], [label, C.soft], [dots(label), C.dim], [value, C.text, true]];
  const wait = (label) => [["[ .. ]  ", C.muted], [label, C.muted], [dots(label), C.dim], ["syncing", C.muted]];
  const prompt = [["mika@github", C.text, true], [" ~ ", C.muted], ["❯ ", C.accent, true]];

  const lines = [
    [[`mika.os ${stamp.slice(2, 4)}.${stamp.slice(5, 7)} · ${stamp.slice(0, 16).replace("T", " ")} UTC`, C.muted]],
    null,
    ok("mounting /home/mika", d.location ?? "ready"),
    ok("loading public repositories", String(d.repoCount)),
    ok("counting stars", `${d.stars} ★`),
    d.flagship ? ok(`flagship: ${d.flagship.name}`, `${d.flagship.stars} ★`) : null,
    d.heartbeat == null ? wait("detecting heartbeat") : ok("detecting heartbeat", `${d.heartbeat} contributions / 30d`),
    d.lastPush ? ok(`last push → ${d.lastPush.name}`, `${ago(d.lastPush.at, d.now)} ago`) : null,
    ok("uptime", d.uptime),
    null,
    [...prompt, ["whoami", C.text]],
  ].filter((l, i, a) => l !== null || a[i - 1] !== null);

  const LH = 23;
  let y = 82;
  let t = 0.2;
  const defs = [];
  const body = [];
  lines.forEach((parts, i) => {
    if (parts) {
      const last = i === lines.length - 1;
      defs.push(wipe(`l${i}`, X, y - 16, W - X * 2, LH, t, last ? 0.5 : 0.25));
      body.push(runs(X, y, parts, { size: 13.5, extra: ` clip-path="url(#l${i})"` }));
      t += last ? 0.7 : 0.17;
    }
    y += LH;
  });

  // The answer to `whoami`, with a light sweeping across it.
  const nameY = y + 44;
  defs.push(`<linearGradient id="shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="420" y2="0">
  <stop offset="0" stop-color="${C.text}"/><stop offset=".42" stop-color="${C.text}"/><stop offset=".5" stop-color="${C.accent}"/><stop offset=".58" stop-color="${C.text}"/><stop offset="1" stop-color="${C.text}"/>
  <animateTransform attributeName="gradientTransform" type="translate" values="-420 0;900 0;900 0" keyTimes="0;.55;1" dur="5s" begin="${f(t + 0.8)}s" repeatCount="indefinite"/>
</linearGradient>`);
  body.push(`<g opacity="0">${enter(t, 0, 14)}
  <text x="${X - 3}" y="${nameY}" font-family="${SANS}" font-size="64" font-weight="800" letter-spacing="-2.5" fill="url(#shine)">${esc(d.displayName)}<tspan fill="${C.accent}">.</tspan></text>
</g>`);
  t += 0.6;

  y = nameY + 36;
  defs.push(wipe("tag", X, y - 17, W - X * 2, 24, t, 0.9));
  body.push(runs(X, y, [[d.tagline, C.soft]], { size: 15, font: SANS, extra: ' clip-path="url(#tag)"' }));
  t += 1;

  // Rotating "currently" line: each role fades in, holds, and hands over.
  y += 34;
  const roles = d.roles?.length ? d.roles : [d.tagline];
  const slot = 2.4;
  const cycle = roles.length * slot;
  const roleSvg = roles
    .map((r, i) => {
      const a = (i * slot) / cycle;
      const b = ((i + 1) * slot) / cycle;
      const e = 0.35 / cycle;
      const keys = [0, a, Math.min(a + e, b), Math.max(b - e, a + e), b, 1].map((k) => f(Math.min(1, k)));
      return `<text x="${X + 104}" y="${y}" font-family="${MONO}" font-size="13.5" fill="${C.text}" opacity="0">${esc(r)}<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${keys.join(";")}" dur="${cycle}s" begin="${f(t)}s" repeatCount="indefinite"/></text>`;
    })
    .join("\n");
  body.push(`<g opacity="0">${enter(t - 0.3, 0, 0)}
  ${runs(X, y, [["currently ", C.muted], ["→", C.accent]], { size: 13.5 })}
  ${roleSvg}
</g>`);

  y += 40;
  body.push(`<g opacity="0">${enter(t + 0.2, 0, 0)}
${runs(X, y, prompt, { size: 13.5 })}
<rect x="${X + 16 * 8.1}" y="${y - 13}" width="8.5" height="16" rx="1" fill="${C.accent}">${blink}</rect>
</g>`);

  const H = y + 34;
  defs.push(`<radialGradient id="halo" cx="82%" cy="18%" r="55%"><stop offset="0" stop-color="${C.accent}" stop-opacity=".09"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.text}" stop-opacity="0"/><stop offset=".5" stop-color="${C.text}" stop-opacity=".035"/><stop offset="1" stop-color="${C.text}" stop-opacity="0"/></linearGradient>
<clipPath id="win"><rect x="1" y="45" width="${W - 2}" height="${H - 46}" rx="15"/></clipPath>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${C.text}" fill-opacity=".05"/></pattern>`);

  return svg(
    W,
    H,
    `${windowFrame(W, H, "mika@github — zsh")}
<g clip-path="url(#win)">
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"><animate attributeName="opacity" values=".6;1;.6" dur="6s" repeatCount="indefinite"/></rect>
  <rect x="0" y="-120" width="${W}" height="120" fill="url(#scan)"><animate attributeName="y" from="-120" to="${H}" dur="7s" repeatCount="indefinite"/></rect>
</g>
${body.join("\n")}`,
    defs.join("\n"),
  );
}

/* ───────────────────────────── heartbeat ───────────────────────────── */

function streakOf(days) {
  let n = 0;
  // Today may not have a contribution yet; don't let that break the streak.
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) n++;
    else if (i === days.length - 1) continue;
    else break;
  }
  return n;
}

export function renderPulse(days) {
  const W = 880;
  const H = 280;
  const x0 = 36;
  const x1 = W - 36;
  const base = 216;

  if (!days?.length) {
    return svg(
      W,
      H,
      `${windowFrame(W, H, "heartbeat")}
<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${C.dim}" stroke-width="2" stroke-dasharray="4 6"><animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite"/></line>
<text x="${W / 2}" y="140" text-anchor="middle" font-family="${MONO}" font-size="14" fill="${C.muted}">waiting for the first pulse · the bot syncs every 4 hours</text>`,
    );
  }

  const n = days.length;
  const max = Math.max(1, ...days.map((d) => d.count));
  const sum = (k) => days.slice(-k).reduce((a, d) => a + d.count, 0);
  const peak = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  const step = (x1 - x0) / n;

  let p = `M${x0} ${base}`;
  const L = (x, y) => (p += ` L${x.toFixed(1)} ${y.toFixed(1)}`);
  days.forEach((d, i) => {
    const x = x0 + i * step;
    if (d.count === 0) return L(x + step, base);
    const amp = 16 + 80 * (Math.log(d.count + 1) / Math.log(max + 1));
    L(x + step * 0.14, base);
    L(x + step * 0.24, base - 4);
    L(x + step * 0.32, base);
    L(x + step * 0.42, base + amp * 0.16);
    L(x + step * 0.5, base - amp);
    L(x + step * 0.58, base + amp * 0.28);
    L(x + step * 0.66, base);
    L(x + step * 0.8, base - 6);
    L(x + step * 0.9, base);
    L(x + step, base);
  });

  const fmt = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const stats = [
    ["last 30 days", sum(30)],
    ["active days", `${days.filter((d) => d.count > 0).length}/${n}`],
    ["streak", `${streakOf(days)}d`],
    [`peak · ${fmt(peak.date)}`, peak.count],
  ];
  const statsSvg = stats
    .map(
      ([k, v], i) => `<g transform="translate(${x0 + 200 + i * 160} 70)" opacity="0">${enter(0.2 + i * 0.12, 0, 6)}
  <text font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.muted}">${esc(k.toUpperCase())}</text>
  <text y="30" font-family="${SANS}" font-size="26" font-weight="800" fill="${C.text}">${esc(v)}</text>
</g>`,
    )
    .join("\n");

  return svg(
    W,
    H,
    `${windowFrame(W, H, `heartbeat · ${n} days of public contributions`, { live: true })}
<rect x="1" y="110" width="${W - 2}" height="${H - 146}" fill="url(#grid)"/>
<g transform="translate(${x0} 70)">
  <text font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.muted}">BPM*</text>
  <g transform="translate(9 20)"><g>
    <animateTransform attributeName="transform" type="scale" values="1;1.28;1;1.14;1" keyTimes="0;.15;.3;.45;1" dur="1s" repeatCount="indefinite"/>
    <path d="M0 3.2C0-1 5.5-2.2 7 1.6 8.5-2.2 14-1 14 3.2 14 7.4 7 11.5 7 11.5S0 7.4 0 3.2z" transform="translate(-7 -5)" fill="${C.accent}"/>
  </g></g>
  <text x="28" y="31" font-family="${SANS}" font-size="34" font-weight="800" fill="${C.accent}">${sum(7)}</text>
</g>
${statsSvg}
<path d="${p}" pathLength="1000" stroke="${C.soft}" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="1000" stroke-dashoffset="1000">
  <animate attributeName="stroke-dashoffset" begin=".3s" dur="2.4s" to="0" fill="freeze"/>
</path>
<path d="${p}" pathLength="1000" stroke="${C.accent}" stroke-width="2.6" stroke-linejoin="round" stroke-dasharray="0 1000" filter="url(#glow)">
  <animate attributeName="stroke-dasharray" begin="2.7s" dur=".01s" to="34 966" fill="freeze"/>
  <animate attributeName="stroke-dashoffset" begin="2.7s" dur="3.6s" from="34" to="-966" repeatCount="indefinite"/>
</path>
<text x="${x0}" y="${H - 16}" font-family="${MONO}" font-size="11" fill="${C.muted}">${fmt(days[0].date)}</text>
<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${C.dim}">* bpm = contributions in the last 7 days</text>
<text x="${x1}" y="${H - 16}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.muted}">today</text>`,
    `<pattern id="grid-s" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" stroke="${C.text}" stroke-opacity=".025"/></pattern>
<pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="url(#grid-s)"/><path d="M60 0H0V60" stroke="${C.text}" stroke-opacity=".055"/></pattern>`,
  );
}

/* ───────────────────────────── activity log ───────────────────────────── */

export function describeEvents(events, login) {
  const short = (full) => (full.startsWith(login + "/") ? full.slice(login.length + 1) : full);
  const out = [];
  for (const e of events ?? []) {
    const repo = short(e.repo.name);
    const pl = e.payload ?? {};
    let item = null;
    switch (e.type) {
      case "PushEvent":
        item = { verb: "push", target: repo };
        break;
      case "PullRequestEvent": {
        const merged = pl.action === "closed" && pl.pull_request?.merged;
        if (pl.action === "opened" || merged) item = { verb: merged ? "merge" : "pr", target: `${repo} #${pl.number ?? pl.pull_request?.number}` };
        break;
      }
      case "PullRequestReviewEvent":
        item = { verb: "review", target: `${repo} #${pl.pull_request?.number}` };
        break;
      case "CreateEvent":
        if (pl.ref_type === "repository") item = { verb: "new", target: repo };
        else if (pl.ref_type === "tag") item = { verb: "tag", target: `${repo} ${pl.ref}` };
        else item = { verb: "branch", target: repo };
        break;
      case "ReleaseEvent":
        item = { verb: "release", target: `${repo} ${pl.release?.tag_name}` };
        break;
      case "WatchEvent":
        item = { verb: "star", target: e.repo.name };
        break;
      case "ForkEvent":
        item = { verb: "fork", target: e.repo.name };
        break;
      case "IssuesEvent":
        if (pl.action === "opened" || pl.action === "closed") item = { verb: "issue", target: `${repo} #${pl.issue?.number}` };
        break;
      case "IssueCommentEvent":
        item = { verb: "comment", target: `${repo} #${pl.issue?.number}` };
        break;
    }
    if (!item) continue;
    item.at = e.created_at;
    const prev = out[out.length - 1];
    if (prev && prev.verb === item.verb && prev.target === item.target) prev.times = (prev.times ?? 1) + 1;
    else out.push(item);
  }
  return out;
}

export function renderActivity(items, now) {
  const W = 434;
  const H = 284;
  const rows = (items ?? []).slice(0, 7);
  if (!rows.length) {
    return svg(
      W,
      H,
      `${windowFrame(W, H, "activity")}
<text x="28" y="80" font-family="${MONO}" font-size="12.5" fill="${C.muted}">no public events yet</text>`,
    );
  }
  const top = 74;
  const gap = 31;
  const lineEnd = top + (rows.length - 1) * gap;
  const body = rows
    .map((r, i) => {
      const y = top + i * gap;
      const label = r.verb.toUpperCase();
      const target = clip(r.target + (r.times > 1 ? ` ×${r.times}` : ""), 27);
      const dot = i === 0 ? pulseDot(32, y - 4, 4) : `<circle cx="32" cy="${y - 4}" r="3.5" fill="${C.bg}" stroke="${C.muted}" stroke-width="1.5"/>`;
      return `<g opacity="0">${enter(0.25 + i * 0.13, -10, 0)}
  ${dot}
  <rect x="48" y="${y - 14}" width="${label.length * 7 + 14}" height="19" rx="9.5" stroke="${i === 0 ? C.accent : C.dim}"/>
  <text x="${55}" y="${y}" font-family="${MONO}" font-size="10.5" font-weight="700" letter-spacing=".5" fill="${i === 0 ? C.accent : C.soft}">${esc(label)}</text>
  <text x="122" y="${y}" font-family="${SANS}" font-size="13.5" fill="${C.text}">${esc(target)}</text>
  <text x="${W - 24}" y="${y}" text-anchor="end" font-family="${MONO}" font-size="11.5" fill="${C.muted}">${esc(ago(r.at, now))}</text>
</g>`;
    })
    .join("\n");
  return svg(
    W,
    H,
    `${windowFrame(W, H, "activity", { live: true })}
<line x1="32" y1="${top - 4}" x2="32" y2="${top - 4}" stroke="${C.dim}" stroke-width="1.5"><animate attributeName="y2" begin=".2s" dur="1.2s" to="${lineEnd - 4}" fill="freeze"/></line>
${body}`,
  );
}

/* ───────────────────────────── wakatime ───────────────────────────── */

export function renderWaka(w) {
  const W = 434;
  const H = 284;
  const X = 28;
  if (!w) {
    return svg(
      W,
      H,
      `${windowFrame(W, H, "wakatime · 7 days")}
<text x="${X}" y="80" font-family="${MONO}" font-size="12.5" fill="${C.muted}">wakatime is warming up…</text>
<text x="${X}" y="104" font-family="${MONO}" font-size="12" fill="${C.dim}">stats appear once the profile is public</text>
<text x="${X}" y="122" font-family="${MONO}" font-size="12" fill="${C.dim}">or WAKATIME_API_KEY is set.</text>`,
    );
  }
  const top = Math.max(...w.languages.map((l) => l.percent), 1);
  const barX = 128;
  const barW = 210;
  const bars = w.languages
    .map((l, i) => {
      const y = 136 + i * 23;
      const width = Math.max(4, (l.percent / top) * barW);
      return `<g opacity="0">${enter(0.3 + i * 0.1, 0, 4)}
  <text x="${X}" y="${y + 9}" font-family="${MONO}" font-size="12" fill="${C.soft}">${esc(clip(l.name, 13))}</text>
  <text x="${W - X}" y="${y + 9}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.text}">${l.percent.toFixed(1)}%</text>
</g>
<rect x="${barX}" y="${y}" width="${barW}" height="8" rx="4" fill="${C.faint}"/>
<rect x="${barX}" y="${y}" width="0" height="8" rx="4" fill="${i === 0 ? C.accent : C.soft}">${grow(width, 0.4 + i * 0.1)}</rect>`;
    })
    .join("\n");
  const meta = [w.editor, w.os].filter(Boolean).join(" · ");
  return svg(
    W,
    H,
    `${windowFrame(W, H, "wakatime · 7 days")}
<g opacity="0">${enter(0.1)}
  <text x="${X}" y="76" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.muted}">CODED THIS WEEK</text>
  <text x="${X}" y="110" font-family="${SANS}" font-size="30" font-weight="800" fill="${C.text}">${esc(w.total ?? "—")}</text>
</g>
<g opacity="0">${enter(0.2)}
  <text x="${W - X}" y="76" text-anchor="end" font-family="${MONO}" font-size="10.5" letter-spacing="1.2" fill="${C.muted}">DAILY AVG</text>
  <text x="${W - X}" y="110" text-anchor="end" font-family="${SANS}" font-size="18" font-weight="700" fill="${C.soft}">${esc(w.dailyAverage ?? "—")}</text>
</g>
${bars}
${meta ? `<text x="${X}" y="${H - 16}" font-family="${MONO}" font-size="11" fill="${C.dim}">${esc(meta)}</text>` : ""}`,
  );
}

/* ───────────────────────────── repo cards ───────────────────────────── */

export function renderRepo(r, now) {
  const W = 434;
  const H = 168;
  const X = 26;
  const ageH = (now - new Date(r.pushed_at).getTime()) / 36e5;
  const live = ageH < 72;
  const active = ageH < 24 * 30;
  const freshness = Math.max(0.03, 1 - ageH / (24 * 180));
  const desc = wrap(r.description || "No description yet. The code speaks for itself.", 50, 2);
  const home = r.homepage ? r.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const meta = [r.language ?? "Markdown", `★ ${r.stargazers_count}`, r.forks_count ? `⑂ ${r.forks_count}` : null].filter(Boolean).join("   ");

  let status;
  if (live) status = `${pulseDot(W - 76, 30, 3.5)}<text x="${W - X}" y="34" text-anchor="end" font-family="${MONO}" font-size="11" font-weight="700" letter-spacing="1.2" fill="${C.accent}">LIVE</text>`;
  else {
    const label = active ? "ACTIVE" : `${ago(r.pushed_at, now)} AGO`.toUpperCase();
    const pw = label.length * 7.4 + 20;
    status = `<rect x="${W - X - pw}" y="19" width="${pw}" height="22" rx="11" stroke="${active ? C.soft : C.dim}"/>
<text x="${W - X - pw / 2}" y="34" text-anchor="middle" font-family="${MONO}" font-size="11" font-weight="700" letter-spacing="1" fill="${active ? C.text : C.muted}">${esc(label)}</text>`;
  }

  // A light that travels around the border of recently pushed repos.
  const orbit = live
    ? `<rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="16" pathLength="100" stroke="${C.accent}" stroke-width="1.5" stroke-dasharray="14 86" filter="url(#glow)"><animate attributeName="stroke-dashoffset" from="100" to="0" dur="4s" repeatCount="indefinite"/></rect>`
    : "";

  return svg(
    W,
    H,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" fill="${C.bg}" stroke="${C.border}"/>
${orbit}
<g opacity="0">${enter(0.1, 0, 6)}
  <text x="${X}" y="38" font-family="${SANS}" font-size="20" font-weight="800" letter-spacing="-.4" fill="${C.text}">${esc(clip(r.name, 26))}</text>
</g>
${status}
<g opacity="0">${enter(0.25, 0, 6)}
${desc.map((l, i) => `<text x="${X}" y="${70 + i * 20}" font-family="${SANS}" font-size="13.5" fill="${C.soft}">${esc(l)}</text>`).join("\n")}
</g>
<g opacity="0">${enter(0.4, 0, 6)}
  <text x="${X}" y="${H - 34}" font-family="${MONO}" font-size="12" fill="${C.muted}" xml:space="preserve">${esc(meta)}</text>
  ${home ? `<text x="${W - X}" y="${H - 34}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.soft}">${esc(clip(home, 26))} ↗</text>` : ""}
</g>
<rect x="${X}" y="${H - 18}" width="${W - X * 2}" height="3" rx="1.5" fill="${C.faint}"/>
<rect x="${X}" y="${H - 18}" width="0" height="3" rx="1.5" fill="url(#fresh)">${grow((W - X * 2) * freshness, 0.3, 1.4)}</rect>`,
    `<linearGradient id="fresh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.dim}"/><stop offset="1" stop-color="${live || active ? C.accent : C.soft}"/></linearGradient>`,
  );
}
