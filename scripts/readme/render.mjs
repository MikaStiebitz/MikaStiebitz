// Hand-rolled SVG renderers. No external fonts or images: GitHub serves
// README images through camo, which blocks anything an <img> SVG would fetch.

const MONO = `'JetBrains Mono','Fira Code','SFMono-Regular',ui-monospace,Menlo,Consolas,monospace`;
const SANS = `'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif`;

const C = {
  bg: "#0A0C10",
  panel: "#0E1117",
  line: "#1C212C",
  text: "#E7EAF0",
  soft: "#B4BBC9",
  muted: "#7D8597",
  dim: "#454C5C",
  green: "#A3FF5C",
  cyan: "#5CE1FF",
  pink: "#FF4FA3",
  amber: "#FFC857",
};

const LANG_COLORS = {
  TypeScript: "#3178C6",
  JavaScript: "#F1E05A",
  Python: "#3572A5",
  Rust: "#DEA584",
  "C++": "#F34B7D",
  C: "#555555",
  HTML: "#E34C26",
  CSS: "#563D7C",
  PHP: "#4F5D95",
  Go: "#00ADD8",
  Java: "#B07219",
  Shell: "#89E051",
  Vue: "#41B883",
  Svelte: "#FF3E00",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

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

function svg(w, h, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img">
<defs>
  <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${C.green}"/><stop offset=".5" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.pink}"/>
  </linearGradient>
  <filter id="glow" x="-20%" y="-50%" width="140%" height="200%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  ${defs}
</defs>
${body}
</svg>
`;
}

// Terminal window chrome shared by the boot screen and the dashboard panels.
function terminal(w, h, title) {
  return `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="${C.bg}" stroke="${C.line}"/>
<path d="M14.5 .5h${w - 29}a14 14 0 0 1 14 14V38H.5V14.5a14 14 0 0 1 14-14z" fill="${C.panel}"/>
<line x1=".5" y1="38" x2="${w - 0.5}" y2="38" stroke="${C.line}"/>
<circle cx="22" cy="19" r="5.5" fill="#FF5F57"/><circle cx="40" cy="19" r="5.5" fill="#FEBC2E"/><circle cx="58" cy="19" r="5.5" fill="#28C840"/>
<text x="${w / 2}" y="23.5" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${C.muted}">${esc(title)}</text>`;
}

/* ───────────────────────────── boot screen ───────────────────────────── */

export function renderBoot(d) {
  const W = 880;
  const PAD = 30;
  const COL = 46;
  const now = d.now;
  const stamp = new Date(now).toISOString();

  const ok = (label, value, valueFill = C.text) => [
    { t: "[  OK  ] ", fill: C.green, weight: 700 },
    { t: label + " " + ".".repeat(Math.max(2, COL - label.length - 1)) + " ", fill: C.soft },
    { t: value, fill: valueFill, weight: 700 },
  ];
  const wait = (label) => [
    { t: "[ WAIT ] ", fill: C.amber, weight: 700 },
    { t: label + " " + ".".repeat(Math.max(2, COL - label.length - 1)) + " ", fill: C.soft },
    { t: "syncing", fill: C.amber },
  ];

  const lines = [];
  lines.push([{ t: `mika.os ${stamp.slice(2, 4)}.${stamp.slice(5, 7)} · kernel caffeine-${d.year} · tty/github · ${stamp.slice(0, 16).replace("T", " ")} UTC`, fill: C.muted }]);
  lines.push(null);
  lines.push(ok("Mounted /home/mika", d.location ? `${d.location}` : "ready"));
  lines.push(ok("Loaded public repositories", String(d.repoCount)));
  lines.push(ok("Collected stars across all repos", `${d.stars} ★`, C.amber));
  if (d.flagship) lines.push(ok(`Flagship online: ${d.flagship.name}`, `${d.flagship.stars} ★`, C.amber));
  lines.push(d.heartbeat == null ? wait("Detecting heartbeat") : ok("Heartbeat detected", `${d.heartbeat} contributions / 30d`, C.green));
  if (d.lastPush) lines.push(ok(`Last push → ${d.lastPush.name}`, `${ago(d.lastPush.at, now)} ago`, C.cyan));
  lines.push(ok("Uptime on GitHub", d.uptime, C.pink));
  lines.push(null);
  lines.push([{ t: "mika@github", fill: C.green, weight: 700 }, { t: ":", fill: C.muted }, { t: "~", fill: C.cyan, weight: 700 }, { t: "$ ", fill: C.muted }, { t: "whoami", fill: C.text }]);

  const LH = 24;
  let y = 72;
  let t = 0.25;
  const parts = [];
  const defs = [];
  lines.forEach((spans, i) => {
    if (spans) {
      const typed = i === lines.length - 1;
      const dur = typed ? 0.7 : 0.32;
      defs.push(`<clipPath id="l${i}"><rect x="${PAD}" y="${y - 17}" width="0" height="${LH}"><animate attributeName="width" begin="${t.toFixed(2)}s" dur="${dur}s" to="${W - PAD * 2}" fill="freeze"/></rect></clipPath>`);
      const tspans = spans
        .map((s) => `<tspan fill="${s.fill}"${s.weight ? ` font-weight="${s.weight}"` : ""}>${esc(s.t)}</tspan>`)
        .join("");
      parts.push(`<text clip-path="url(#l${i})" x="${PAD}" y="${y}" font-family="${MONO}" font-size="14" xml:space="preserve">${tspans}</text>`);
      t += typed ? 0.9 : 0.2;
    }
    y += LH;
  });

  // The reveal: the answer to `whoami`.
  const nameY = y + 30;
  const nameAt = t.toFixed(2);
  parts.push(`<g opacity="0">
  <animate attributeName="opacity" begin="${nameAt}s" dur=".6s" to="1" fill="freeze"/>
  <animateTransform attributeName="transform" type="translate" begin="${nameAt}s" dur=".6s" from="0 10" to="0 0" fill="freeze"/>
  <text x="${PAD - 2}" y="${nameY}" font-family="${SANS}" font-size="50" font-weight="800" letter-spacing="-1.5" fill="url(#aurora)">${esc(d.displayName)}</text>
  <text x="${PAD}" y="${nameY + 32}" font-family="${MONO}" font-size="14" fill="${C.soft}">${esc(d.tagline)}</text>
</g>`);
  t += 0.8;
  const promptY = nameY + 72;
  parts.push(`<g opacity="0"><animate attributeName="opacity" begin="${t.toFixed(2)}s" dur=".01s" to="1" fill="freeze"/>
  <text x="${PAD}" y="${promptY}" font-family="${MONO}" font-size="14" xml:space="preserve"><tspan fill="${C.green}" font-weight="700">mika@github</tspan><tspan fill="${C.muted}">:</tspan><tspan fill="${C.cyan}" font-weight="700">~</tspan><tspan fill="${C.muted}">$ </tspan></text>
  <rect x="${PAD + 15 * 8.4}" y="${promptY - 13}" width="9" height="17" fill="${C.green}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/></rect>
</g>`);

  const H = promptY + 30;
  const glow = `<radialGradient id="halo" cx="85%" cy="15%" r="60%"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".10"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>`;
  return svg(
    W,
    H,
    `${terminal(W, H, "mika@github — zsh — booting mika.os")}
<rect x="1" y="39" width="${W - 2}" height="${H - 40}" rx="13" fill="url(#halo)"/>
${parts.join("\n")}`,
    glow + defs.join("\n"),
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
  const H = 270;
  const x0 = 28;
  const x1 = W - 28;
  const base = 212;

  if (!days?.length) {
    return svg(
      W,
      H,
      `${terminal(W, H, "heartbeat — monitor")}
<line x1="${x0}" y1="${base}" x2="${x1}" y2="${base}" stroke="${C.dim}" stroke-width="2" stroke-dasharray="4 6"/>
<text x="${W / 2}" y="140" text-anchor="middle" font-family="${MONO}" font-size="15" fill="${C.amber}">waiting for the first pulse — the bot syncs every few hours</text>`,
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
    if (d.count === 0) {
      L(x + step, base);
      return;
    }
    const amp = 16 + 78 * (Math.log(d.count + 1) / Math.log(max + 1));
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
    { k: "last 30 days", v: sum(30), c: C.green },
    { k: "active days", v: `${days.filter((d) => d.count > 0).length}/${n}`, c: C.cyan },
    { k: "streak", v: `${streakOf(days)}d`, c: C.pink },
    { k: `peak · ${fmt(peak.date)}`, v: peak.count, c: C.amber },
  ];
  const statsSvg = stats
    .map(
      (s, i) => `<g transform="translate(${x0 + 190 + i * 165} 62)">
  <text font-family="${MONO}" font-size="11" fill="${C.muted}" letter-spacing="1">${esc(s.k.toUpperCase())}</text>
  <text y="30" font-family="${SANS}" font-size="26" font-weight="800" fill="${s.c}">${esc(s.v)}</text>
</g>`,
    )
    .join("\n");

  const grid = `<pattern id="ecg-s" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" stroke="${C.green}" stroke-opacity=".05"/></pattern>
<pattern id="ecg-l" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#ecg-s)"/><path d="M50 0H0V50" stroke="${C.green}" stroke-opacity=".11"/></pattern>
<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.green}" stop-opacity=".25"/><stop offset=".15" stop-color="${C.green}"/><stop offset="1" stop-color="${C.green}"/></linearGradient>`;

  return svg(
    W,
    H,
    `${terminal(W, H, `heartbeat — ${n} days of public contributions`)}
<rect x="1" y="100" width="${W - 2}" height="${H - 136}" fill="url(#ecg-l)"/>
<g transform="translate(${x0} 62)">
  <text font-family="${MONO}" font-size="11" fill="${C.muted}" letter-spacing="1">BPM*</text>
  <circle cx="10" cy="20" r="6" fill="${C.pink}"><animate attributeName="r" values="5;8;5;6;5" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.6;1" dur="1s" repeatCount="indefinite"/></circle>
  <text x="26" y="30" font-family="${SANS}" font-size="34" font-weight="800" fill="${C.text}">${sum(7)}</text>
</g>
${statsSvg}
<path d="${p}" pathLength="1000" stroke="url(#fade)" stroke-width="2" stroke-linejoin="round" stroke-dasharray="1000" stroke-dashoffset="1000" filter="url(#glow)">
  <animate attributeName="stroke-dashoffset" begin=".2s" dur="2.4s" to="0" fill="freeze"/>
</path>
<path d="${p}" pathLength="1000" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="0 1000" filter="url(#glow)">
  <animate attributeName="stroke-dasharray" begin="2.6s" dur=".01s" to="28 972" fill="freeze"/>
  <animate attributeName="stroke-dashoffset" begin="2.6s" dur="3.2s" from="28" to="-972" repeatCount="indefinite"/>
</path>
<text x="${x0}" y="${H - 14}" font-family="${MONO}" font-size="11" fill="${C.dim}">${fmt(days[0].date)}</text>
<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="${C.dim}">* bpm = contributions in the last 7 days</text>
<text x="${x1}" y="${H - 14}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}">today</text>`,
    grid,
  );
}

/* ───────────────────────────── activity log ───────────────────────────── */

const VERB_COLORS = { push: C.green, pr: C.cyan, merge: C.cyan, review: C.cyan, new: C.pink, release: C.pink, star: C.amber, fork: C.amber, issue: C.amber, comment: C.soft, branch: C.soft, tag: C.pink };

export function describeEvents(events, login) {
  const short = (full) => (full.startsWith(login + "/") ? full.slice(login.length + 1) : full);
  const out = [];
  for (const e of events ?? []) {
    const repo = short(e.repo.name);
    const pl = e.payload ?? {};
    let item = null;
    switch (e.type) {
      case "PushEvent":
        item = { verb: "push", target: repo, note: (pl.ref ?? "").replace("refs/heads/", "") };
        break;
      case "PullRequestEvent": {
        const merged = pl.action === "closed" && pl.pull_request?.merged;
        if (pl.action === "opened" || merged) item = { verb: merged ? "merge" : "pr", target: `${repo}#${pl.number ?? pl.pull_request?.number}` };
        break;
      }
      case "PullRequestReviewEvent":
        item = { verb: "review", target: `${repo}#${pl.pull_request?.number}` };
        break;
      case "CreateEvent":
        if (pl.ref_type === "repository") item = { verb: "new", target: repo };
        else if (pl.ref_type === "tag") item = { verb: "tag", target: repo, note: pl.ref };
        else item = { verb: "branch", target: repo, note: pl.ref };
        break;
      case "ReleaseEvent":
        item = { verb: "release", target: repo, note: pl.release?.tag_name };
        break;
      case "WatchEvent":
        item = { verb: "star", target: e.repo.name };
        break;
      case "ForkEvent":
        item = { verb: "fork", target: e.repo.name };
        break;
      case "IssuesEvent":
        if (pl.action === "opened" || pl.action === "closed") item = { verb: "issue", target: `${repo}#${pl.issue?.number}`, note: pl.action };
        break;
      case "IssueCommentEvent":
        item = { verb: "comment", target: `${repo}#${pl.issue?.number}` };
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
  const H = 280;
  const rows = (items ?? []).slice(0, 7);
  let body;
  if (!rows.length) {
    body = `<text x="22" y="74" font-family="${MONO}" font-size="12.5" fill="${C.amber}">$ waiting for public events…</text>`;
  } else {
    body = rows
      .map((r, i) => {
        const y = 70 + i * 26;
        const times = r.times > 1 ? ` ×${r.times}` : "";
        const target = clip(r.target + times, 29);
        return `<g opacity="0"><animate attributeName="opacity" begin="${(0.15 + i * 0.12).toFixed(2)}s" dur=".3s" to="1" fill="freeze"/>
  <text x="22" y="${y}" font-family="${MONO}" font-size="12.5" xml:space="preserve"><tspan fill="${C.dim}">${esc(ago(r.at, now).padStart(3))}</tspan>  <tspan fill="${VERB_COLORS[r.verb] ?? C.soft}" font-weight="700">${esc(r.verb.padEnd(7))}</tspan> <tspan fill="${C.text}">${esc(target)}</tspan></text>
</g>`;
      })
      .join("\n");
  }
  return svg(
    W,
    H,
    `${terminal(W, H, "tail -f ~/activity.log")}
${body}
<rect x="22" y="${H - 30}" width="8" height="14" fill="${C.green}"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`,
  );
}

/* ───────────────────────────── wakatime ───────────────────────────── */

export function renderWaka(w) {
  const W = 434;
  const H = 280;
  if (!w) {
    return svg(
      W,
      H,
      `${terminal(W, H, "wakatime --range 7d")}
<text x="22" y="74" font-family="${MONO}" font-size="12.5" fill="${C.amber}">$ wakatime is warming up…</text>
<text x="22" y="100" font-family="${MONO}" font-size="12" fill="${C.muted}">stats appear once the WakaTime profile</text>
<text x="22" y="118" font-family="${MONO}" font-size="12" fill="${C.muted}">is public or WAKATIME_API_KEY is set.</text>`,
    );
  }
  const top = Math.max(...w.languages.map((l) => l.percent), 1);
  const barX = 132;
  const barW = 214;
  const bars = w.languages
    .map((l, i) => {
      const y = 132 + i * 26;
      const width = Math.max(4, (l.percent / top) * barW);
      return `<text x="22" y="${y + 9}" font-family="${MONO}" font-size="12" fill="${C.soft}">${esc(clip(l.name, 13))}</text>
<rect x="${barX}" y="${y}" width="${barW}" height="10" rx="5" fill="${C.line}"/>
<rect x="${barX}" y="${y}" width="0" height="10" rx="5" fill="url(#aurora)"><animate attributeName="width" begin="${(0.2 + i * 0.1).toFixed(2)}s" dur=".9s" to="${width.toFixed(1)}" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/></rect>
<text x="${W - 22}" y="${y + 9}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.text}" font-weight="700">${l.percent.toFixed(1)}%</text>`;
    })
    .join("\n");
  const meta = [w.editor, w.os].filter(Boolean).join(" · ");
  return svg(
    W,
    H,
    `${terminal(W, H, "wakatime --range 7d")}
<text x="22" y="66" font-family="${MONO}" font-size="11" fill="${C.muted}" letter-spacing="1">CODED THIS WEEK</text>
<text x="22" y="98" font-family="${SANS}" font-size="28" font-weight="800" fill="url(#aurora)">${esc(w.total ?? "—")}</text>
<text x="${W - 22}" y="66" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.muted}" letter-spacing="1">DAILY AVG</text>
<text x="${W - 22}" y="98" text-anchor="end" font-family="${SANS}" font-size="20" font-weight="800" fill="${C.text}">${esc(w.dailyAverage ?? "—")}</text>
${bars}
${meta ? `<text x="22" y="${H - 14}" font-family="${MONO}" font-size="11" fill="${C.dim}">${esc(meta)}</text>` : ""}`,
  );
}

/* ───────────────────────────── repo cards ───────────────────────────── */

export function renderRepo(r, now) {
  const W = 434;
  const H = 172;
  const ageH = (now - new Date(r.pushed_at).getTime()) / 36e5;
  const live = ageH < 72;
  const status = live
    ? { label: "LIVE", fill: C.pink }
    : ageH < 24 * 30
      ? { label: "ACTIVE", fill: C.green }
      : { label: `${ago(r.pushed_at, now)} ago`.toUpperCase(), fill: C.muted };
  const pillW = status.label.length * 7.2 + (live ? 34 : 22);
  const freshness = Math.max(0.04, 1 - ageH / (24 * 180));
  const desc = wrap(r.description || "No description yet — the code speaks for itself.", 54, 2);
  const lang = r.language ?? "Markdown";
  const langColor = LANG_COLORS[lang] ?? C.soft;
  const home = r.homepage ? r.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";

  const pill = `<g transform="translate(${W - 20 - pillW} 20)">
  <rect width="${pillW}" height="22" rx="11" fill="${status.fill}" fill-opacity=".12" stroke="${status.fill}" stroke-opacity=".45"/>
  ${live ? `<circle cx="13" cy="11" r="3.5" fill="${C.pink}"><animate attributeName="opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite"/></circle>` : ""}
  <text x="${live ? 23 : 11}" y="15" font-family="${MONO}" font-size="11" font-weight="700" fill="${status.fill}" letter-spacing=".5">${esc(status.label)}</text>
</g>`;

  let footX = 22;
  const foot = [];
  foot.push(`<circle cx="${footX + 5}" cy="${H - 31}" r="5" fill="${langColor}"/>`);
  foot.push(`<text x="${footX + 16}" y="${H - 27}" font-family="${MONO}" font-size="12" fill="${C.soft}">${esc(lang)}</text>`);
  footX += 16 + lang.length * 7.3 + 18;
  foot.push(`<text x="${footX}" y="${H - 27}" font-family="${MONO}" font-size="12" fill="${C.amber}">★ <tspan fill="${C.soft}">${r.stargazers_count}</tspan></text>`);
  footX += 26 + String(r.stargazers_count).length * 7.3 + 14;
  if (r.forks_count) {
    foot.push(`<text x="${footX}" y="${H - 27}" font-family="${MONO}" font-size="12" fill="${C.cyan}">⑂ <tspan fill="${C.soft}">${r.forks_count}</tspan></text>`);
    footX += 26 + String(r.forks_count).length * 7.3 + 14;
  }
  if (home) {
    const room = Math.floor((W - 22 - footX) / 7.3) - 2;
    if (room > 6) foot.push(`<text x="${W - 22}" y="${H - 27}" text-anchor="end" font-family="${MONO}" font-size="12" fill="${C.cyan}">↗ ${esc(clip(home, room))}</text>`);
  }

  return svg(
    W,
    H,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${C.bg}" stroke="${live ? C.pink : C.line}" stroke-opacity="${live ? 0.5 : 1}"/>
<text x="22" y="40" font-family="${MONO}" font-size="19" font-weight="700" xml:space="preserve"><tspan fill="${C.dim}">~/</tspan><tspan fill="${C.text}">${esc(clip(r.name, Math.floor((W - 70 - pillW) / 11.4)))}</tspan></text>
${pill}
${desc.map((l, i) => `<text x="22" y="${76 + i * 21}" font-family="${SANS}" font-size="14" fill="${C.soft}">${esc(l)}</text>`).join("\n")}
${foot.join("\n")}
<rect x="22" y="${H - 12}" width="${W - 44}" height="3" rx="1.5" fill="${C.line}"/>
<rect x="22" y="${H - 12}" width="0" height="3" rx="1.5" fill="url(#aurora)"><animate attributeName="width" begin=".2s" dur="1.2s" to="${((W - 44) * freshness).toFixed(1)}" fill="freeze" calcMode="spline" keySplines=".2 .8 .2 1"/></rect>`,
  );
}
