// Hand-rolled SVG renderers in a monochrome TUI / ASCII style. No external
// fonts or images: GitHub serves README images through camo, which blocks
// anything an <img> SVG would fetch. Rows of ASCII art use textLength so
// columns line up even when the viewer's monospace font differs.

const MONO = `'JetBrains Mono','SFMono-Regular','SF Mono',Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace`;

const C = {
  bg: "#0B0B0C",
  line: "#2C2C31",
  text: "#EDEDED",
  soft: "#A6A6AB",
  muted: "#6C6C72",
  dim: "#3A3A40",
  accent: "#B8FF6B",
};

export const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const dots = (label, width) => label + " " + ".".repeat(Math.max(2, width - label.length - 1)) + " ";
const bar = (ratio, width) => {
  const full = Math.max(0, Math.min(width, Math.round(ratio * width)));
  return "█".repeat(full) + "░".repeat(width - full);
};

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

// <text> made of differently coloured runs: [[text, fill, bold?], ...]
function runs(x, y, parts, { size = 13, extra = "" } = {}) {
  const t = parts
    .filter(([s]) => s)
    .map(([s, fill, bold]) => `<tspan fill="${fill}"${bold ? ' font-weight="700"' : ""}>${esc(s)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" font-family="${MONO}" font-size="${size}" xml:space="preserve"${extra}>${t}</text>`;
}

const blink = `<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/>`;

// Wipes content in from left to right, like a line being printed.
function wipe(id, x, y, w, h, begin, dur) {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="0" height="${h}"><animate attributeName="width" begin="${begin}s" dur="${dur}s" to="${w}" fill="freeze"/></rect></clipPath>`;
}

function svg(w, h, body, defs = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img">
<defs>${defs}</defs>
${body}
</svg>
`;
}

// btop-style panel: dark window, inset border, title sitting on the border.
function panel(w, h, title, right = "", { rightFill = C.muted } = {}) {
  const cw = 7.5;
  const tw = (title.length + 4) * cw;
  const rw = (right.length + 4) * cw;
  return `<rect width="${w}" height="${h}" rx="8" fill="${C.bg}"/>
<rect x="10.5" y="14.5" width="${w - 21}" height="${h - 25}" rx="3" stroke="${C.line}"/>
<rect x="22" y="6" width="${tw}" height="18" fill="${C.bg}"/>
${runs(26, 19, [["┤ ", C.dim], [title, C.text, true], [" ├", C.dim]], { size: 12.5 })}
${right ? `<rect x="${w - 22 - rw}" y="6" width="${rw}" height="18" fill="${C.bg}"/>\n${runs(w - 18 - rw, 19, [["┤ ", C.dim], [right, rightFill], [" ├", C.dim]], { size: 12.5 })}` : ""}`;
}

/* ───────────────────────────── boot screen ───────────────────────────── */

export function renderBoot(d) {
  const W = 880;
  const X = 36;
  const COL = 44;
  const stamp = new Date(d.now).toISOString();

  const ok = (label, value) => [["[  OK  ] ", C.text, true], [dots(label, COL), C.muted], [value, C.text, true]];
  const wait = (label) => [["[ WAIT ] ", C.muted, true], [dots(label, COL), C.muted], ["syncing", C.muted]];
  const prompt = [["mika@github", C.soft, true], [":~$ ", C.muted]];

  const lines = [
    [[`mika.os ${stamp.slice(2, 4)}.${stamp.slice(5, 7)} (tty1) · ${stamp.slice(0, 16).replace("T", " ")} UTC`, C.muted]],
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
  let y = 58;
  let t = 0.2;
  const defs = [];
  const body = [];
  lines.forEach((parts, i) => {
    if (parts) {
      const last = i === lines.length - 1;
      defs.push(wipe(`l${i}`, X, y - 16, W - X * 2, LH, t.toFixed(2), last ? 0.5 : 0.25));
      body.push(runs(X, y, parts, { size: 13.5, extra: ` clip-path="url(#l${i})"` }));
      t += last ? 0.7 : 0.17;
    }
    y += LH;
  });

  // The answer to `whoami`: the ASCII banner prints row by row.
  const rowH = 16.5;
  const bannerW = W - X * 2;
  y += 6;
  d.banner.forEach((row, i) => {
    const by = y + i * rowH;
    defs.push(wipe(`b${i}`, X, by - 14, bannerW, rowH + 2, (t + i * 0.09).toFixed(2), 0.35));
    body.push(`<text x="${X}" y="${by}" textLength="${bannerW}" lengthAdjust="spacingAndGlyphs" font-family="${MONO}" font-size="14.5" fill="${C.text}" xml:space="preserve" clip-path="url(#b${i})">${esc(row)}</text>`);
  });
  t += d.banner.length * 0.09 + 0.4;
  y += d.banner.length * rowH + 16;

  defs.push(wipe("tag", X, y - 16, W - X * 2, LH, t.toFixed(2), 0.6));
  body.push(runs(X, y, [["# ", C.muted], [d.tagline, C.soft]], { size: 13.5, extra: ' clip-path="url(#tag)"' }));
  t += 0.8;
  y += LH * 1.6;

  body.push(`<g opacity="0"><animate attributeName="opacity" begin="${t.toFixed(2)}s" dur=".01s" to="1" fill="freeze"/>
${runs(X, y, prompt, { size: 13.5 })}
<rect x="${X + 15 * 8.1}" y="${y - 13}" width="8.5" height="16" fill="${C.accent}">${blink}</rect>
</g>`);

  const H = y + 32;
  return svg(W, H, `${panel(W, H, "tty1", "mika.os")}\n${body.join("\n")}`, defs.join("\n"));
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
  const X = 36;
  const GW = W - X * 2;

  if (!days?.length) {
    const H = 150;
    return svg(
      W,
      H,
      `${panel(W, H, "heartbeat", "monitor")}
${runs(X, 70, [["─".repeat(96), C.dim]], { size: 12, extra: ` textLength="${GW}" lengthAdjust="spacingAndGlyphs"` })}
${runs(X, 104, [["[ WAIT ] ", C.muted, true], ["no pulse yet. the bot syncs every 4 hours", C.muted]], { size: 13 })}`,
    );
  }

  const n = days.length;
  const max = Math.max(1, ...days.map((d) => d.count));
  const sum = (k) => days.slice(-k).reduce((a, d) => a + d.count, 0);
  const peak = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  const fmt = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toLowerCase();

  // Character grid: two columns per day, ROWS levels above a baseline.
  const ROWS = 7;
  const cols = n * 2;
  const grid = Array.from({ length: ROWS + 1 }, (_, r) => Array(cols).fill(r === ROWS ? "─" : " "));
  const fill = Array.from({ length: ROWS + 1 }, () => Array(cols).fill(null));
  days.forEach((d, i) => {
    if (!d.count) return;
    const h = Math.max(1, Math.round(ROWS * (Math.log(d.count + 1) / Math.log(max + 1))));
    const c = i * 2;
    const color = i >= n - 7 ? C.text : C.soft;
    for (let k = 1; k <= h; k++) {
      grid[ROWS - k][c] = k === h ? "╻" : "┃";
      fill[ROWS - k][c] = color;
    }
    grid[ROWS][c] = "┸";
    fill[ROWS][c] = color;
  });

  const rowH = 13;
  const top = 92;
  const rows = grid.map((chars, r) => {
    const parts = [];
    let cur = null;
    chars.forEach((ch, c) => {
      const f = fill[r][c] ?? (r === ROWS ? C.dim : C.muted);
      if (cur && cur[1] === f) cur[0] += ch;
      else parts.push((cur = [ch, f]));
    });
    return runs(X, top + r * rowH, parts, { size: 12, extra: ` textLength="${GW}" lengthAdjust="spacingAndGlyphs" clip-path="url(#scan)"` });
  });

  const stats = [
    ["bpm* ", sum(7)],
    ["30d ", sum(30)],
    ["active ", `${days.filter((d) => d.count > 0).length}/${n}`],
    ["streak ", `${streakOf(days)}d`],
    ["peak ", `${peak.count} (${fmt(peak.date)})`],
  ].flatMap(([k, v], i) => [[i ? "   " : "", C.dim], [k, C.muted], [String(v), C.text, true]]);

  const gridTop = top - 12;
  const gridH = (ROWS + 1) * rowH + 4;
  const axisY = top + (ROWS + 1) * rowH + 12;
  const H = axisY + 34;
  const cw = GW / cols;

  return svg(
    W,
    H,
    `${panel(W, H, "heartbeat", `${n}d · public contributions`)}
${runs(X, 58, stats, { size: 13 })}
${rows.join("\n")}
<rect x="${X}" y="${gridTop}" width="${cw * 2}" height="${gridH}" fill="${C.accent}" fill-opacity=".16" opacity="0">
  <animate attributeName="opacity" begin="2.2s" dur=".01s" to="1" fill="freeze"/>
  <animate attributeName="x" begin="2.2s" dur="4s" from="${X}" to="${X + GW - cw * 2}" repeatCount="indefinite"/>
</rect>
${runs(X, axisY, [["└ ", C.dim], [fmt(days[0].date), C.muted]], { size: 11.5 })}
<text x="${W / 2}" y="${axisY}" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="${C.muted}">* bpm = contributions in the last 7 days (bright)</text>
<text x="${W - X}" y="${axisY}" text-anchor="end" font-family="${MONO}" font-size="11.5" xml:space="preserve"><tspan fill="${C.muted}">today</tspan><tspan fill="${C.dim}"> ┘</tspan></text>`,
    wipe("scan", X, gridTop, GW, gridH, "0.2", "2"),
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
        if (pl.action === "opened" || merged) item = { verb: merged ? "merge" : "pr", target: `${repo}#${pl.number ?? pl.pull_request?.number}` };
        break;
      }
      case "PullRequestReviewEvent":
        item = { verb: "review", target: `${repo}#${pl.pull_request?.number}` };
        break;
      case "CreateEvent":
        if (pl.ref_type === "repository") item = { verb: "new", target: repo };
        else if (pl.ref_type === "tag") item = { verb: "tag", target: `${repo}@${pl.ref}` };
        else item = { verb: "branch", target: repo };
        break;
      case "ReleaseEvent":
        item = { verb: "release", target: `${repo}@${pl.release?.tag_name}` };
        break;
      case "WatchEvent":
        item = { verb: "star", target: e.repo.name };
        break;
      case "ForkEvent":
        item = { verb: "fork", target: e.repo.name };
        break;
      case "IssuesEvent":
        if (pl.action === "opened" || pl.action === "closed") item = { verb: "issue", target: `${repo}#${pl.issue?.number}` };
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
  const H = 272;
  const X = 30;
  const rows = (items ?? []).slice(0, 7);
  const defs = [];
  let body;
  if (!rows.length) {
    body = runs(X, 58, [["[ WAIT ] ", C.muted, true], ["no public events yet", C.muted]], { size: 12.5 });
  } else {
    body = rows
      .map((r, i) => {
        const y = 58 + i * 25;
        defs.push(wipe(`a${i}`, X, y - 15, W - X * 2, 22, (0.15 + i * 0.12).toFixed(2), 0.3));
        const target = clip(r.target + (r.times > 1 ? ` ×${r.times}` : ""), 30);
        return runs(X, y, [[ago(r.at, now).padStart(3) + "  ", C.muted], [r.verb.padEnd(8), C.text, true], [target, C.soft]], { size: 12.5, extra: ` clip-path="url(#a${i})"` });
      })
      .join("\n");
  }
  return svg(
    W,
    H,
    `${panel(W, H, "activity.log", "tail -f")}
${body}
${runs(X, H - 26, [["$ ", C.muted]], { size: 12.5 })}
<rect x="${X + 15}" y="${H - 38}" width="8" height="15" fill="${C.accent}">${blink}</rect>`,
    defs.join("\n"),
  );
}

/* ───────────────────────────── wakatime ───────────────────────────── */

export function renderWaka(w) {
  const W = 434;
  const H = 272;
  const X = 30;
  if (!w) {
    return svg(
      W,
      H,
      `${panel(W, H, "wakatime", "7d")}
${runs(X, 58, [["[ WAIT ] ", C.muted, true], ["wakatime is warming up", C.muted]], { size: 12.5 })}
${runs(X, 84, [["stats appear once the profile is public", C.dim]], { size: 12 })}
${runs(X, 102, [["or WAKATIME_API_KEY is set.", C.dim]], { size: 12 })}`,
    );
  }
  const top = Math.max(...w.languages.map((l) => l.percent), 1);
  const meta = [w.editor, w.os].filter(Boolean).join(" · ");
  const info = [
    ["coded", w.total ?? "—"],
    ["daily avg", w.dailyAverage ?? "—"],
    meta ? ["setup", meta] : null,
  ].filter(Boolean);
  const defs = [];
  const lines = info.map(([k, v], i) => runs(X, 58 + i * 22, [[dots(k, 14), C.muted], [v, C.text, true]], { size: 12.5 }));
  const barsTop = 58 + info.length * 22 + 20;
  w.languages.forEach((l, i) => {
    const y = barsTop + i * 22;
    defs.push(wipe(`w${i}`, X, y - 15, W - X * 2, 20, (0.2 + i * 0.1).toFixed(2), 0.7));
    lines.push(runs(X, y, [[clip(l.name, 11).padEnd(12), C.soft], [bar(l.percent / top, 22), C.text], [`${l.percent.toFixed(1)}%`.padStart(7), C.muted]], { size: 12.5, extra: ` clip-path="url(#w${i})"` }));
  });
  return svg(W, H, `${panel(W, H, "wakatime", "7d")}\n${lines.join("\n")}`, defs.join("\n"));
}

/* ───────────────────────────── repo cards ───────────────────────────── */

export function renderRepo(r, now) {
  const W = 434;
  const H = 164;
  const X = 30;
  const ageH = (now - new Date(r.pushed_at).getTime()) / 36e5;
  const live = ageH < 72;
  const status = live ? "● live" : ageH < 24 * 30 ? "active" : `${ago(r.pushed_at, now)} ago`;
  const freshness = Math.max(0, 1 - ageH / (24 * 180));
  const desc = wrap(r.description || "no description yet. the code speaks for itself.", 49, 2);
  const home = r.homepage ? r.homepage.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
  const meta = [r.language ?? "markdown", `★ ${r.stargazers_count}`, r.forks_count ? `⑂ ${r.forks_count}` : null, home ? `↗ ${home}` : null]
    .filter(Boolean)
    .join("  ·  ");
  const nameRoom = Math.floor((W - 90 - (status.length + 4) * 7.5) / 7.5);

  return svg(
    W,
    H,
    `${panel(W, H, `~/${clip(r.name, nameRoom)}`, status, { rightFill: live ? C.accent : C.muted })}
${desc.map((l, i) => runs(X, 52 + i * 20, [[l, C.soft]], { size: 12.5 })).join("\n")}
${runs(X, 108, [[clip(meta, 49), C.muted]], { size: 12 })}
${runs(X, 136, [["fresh ", C.dim], [bar(freshness, 30), C.soft], [`  ${ago(r.pushed_at, now)}`, C.muted]], { size: 12, extra: ' clip-path="url(#fresh)"' })}`,
    wipe("fresh", X, 120, W - X * 2, 22, "0.2", "0.9"),
  );
}

/* ───────────────────────────── toolbox ───────────────────────────── */

export function renderToolbox(groups) {
  const W = 880;
  const X = 36;
  const entries = Object.entries(groups);
  const H = 52 + entries.length * 24 + 12;
  const rows = entries.map(([k, items], i) =>
    runs(X, 52 + i * 24, [[dots(k, 12), C.muted], [items.join("  ·  "), C.text]], { size: 13 }),
  );
  return svg(W, H, `${panel(W, H, "~/.toolbox", "cat")}\n${rows.join("\n")}`);
}
