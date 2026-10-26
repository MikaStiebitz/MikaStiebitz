#!/usr/bin/env node
// Rebuilds README.md and assets/*.svg from live GitHub + WakaTime data.
//
//   node scripts/readme/generate.mjs                  # live (needs GITHUB_TOKEN)
//   node scripts/readme/generate.mjs --fixture f.json # render from a saved snapshot
//   node scripts/readme/generate.mjs --dump f.json    # also save the snapshot

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./fetch.mjs";
import { renderBoot, renderPulse, renderActivity, renderWaka, renderRepo, describeEvents, esc } from "./render.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSETS = join(ROOT, "assets");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};

const config = JSON.parse(await readFile(join(ROOT, "readme.config.json"), "utf8"));
const fixture = arg("--fixture");
const data = fixture ? JSON.parse(await readFile(fixture, "utf8")) : await collect(config, process.env);
if (arg("--dump")) await writeFile(arg("--dump"), JSON.stringify(data, null, 1));

const now = data.now ? new Date(data.now).getTime() : Date.now();

if (!data.repos) {
  // Without the repo list there is nothing meaningful to publish; keep the last good build.
  console.error("[readme] could not load repositories — leaving README untouched");
  process.exit(0);
}

const publicRepos = data.repos.filter((r) => !r.private && !r.fork && !r.archived);
const shown = (() => {
  const { max, min, activeWithinDays, exclude = [] } = config.repos;
  const pool = publicRepos
    .filter((r) => !exclude.includes(r.name))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
  const active = pool.filter((r) => now - new Date(r.pushed_at).getTime() < activeWithinDays * 864e5);
  return (active.length >= min ? active : pool).slice(0, max);
})();

const stars = publicRepos.reduce((a, r) => a + r.stargazers_count, 0);
const flagship = [...publicRepos].sort((a, b) => b.stargazers_count - a.stargazers_count)[0];
const lastPush = shown[0];
const created = data.user?.created_at ? new Date(data.user.created_at).getTime() : null;
const uptime = (() => {
  if (!created) return "online";
  const months = Math.floor((now - created) / 2629800000);
  return `${Math.floor(months / 12)}y ${months % 12}m`;
})();
const heartbeat = data.contributions ? data.contributions.slice(-30).reduce((a, d) => a + d.count, 0) : null;

const files = {
  "boot.svg": renderBoot({
    now,
    displayName: config.displayName,
    tagline: config.tagline,
    roles: config.roles,
    location: data.user?.location,
    repoCount: data.user?.public_repos ?? publicRepos.length,
    stars,
    flagship: flagship && flagship.stargazers_count > 0 ? { name: flagship.name, stars: flagship.stargazers_count } : null,
    heartbeat,
    lastPush: lastPush ? { name: lastPush.name, at: lastPush.pushed_at } : null,
    uptime,
  }),
  "pulse.svg": renderPulse(data.contributions),
  "activity.svg": renderActivity(describeEvents(data.events, config.login), now),
  "wakatime.svg": renderWaka(data.waka),
};

await mkdir(join(ASSETS, "repos"), { recursive: true });
for (const f of await readdir(join(ASSETS, "repos"))) await rm(join(ASSETS, "repos", f));
shown.forEach((r) => (files[`repos/${r.name}.svg`] = renderRepo(r, now)));

// Keep the last real WakaTime card if this run couldn't reach WakaTime.
if (!data.waka && existsSync(join(ASSETS, "wakatime.svg"))) {
  const prev = await readFile(join(ASSETS, "wakatime.svg"), "utf8");
  if (!prev.includes("warming up")) delete files["wakatime.svg"];
}

for (const [name, content] of Object.entries(files)) await writeFile(join(ASSETS, name), content);

// Cache-buster so GitHub's image proxy picks up fresh renders.
const v = new Date(now).toISOString().slice(0, 13).replace(/\D/g, "");
const repoGrid = shown
  .map((r) => `<a href="${esc(r.html_url)}"><img src="assets/repos/${encodeURIComponent(r.name)}.svg?v=${v}" width="49%" alt="${esc(r.name)}: ${esc(r.description ?? "")}"></a>`)
  .join("\n");
const updated = new Date(now).toISOString().slice(0, 16).replace("T", " ") + " UTC";

const template = await readFile(join(ROOT, "scripts", "readme", "template.md"), "utf8");
const readme = template
  .replace(/^<!--[\s\S]*?-->\n/, "")
  .replaceAll("{{v}}", v)
  .replaceAll("{{login}}", config.login)
  .replaceAll("{{wakatime_user}}", config.wakatimeUser)
  .replaceAll("{{repo_grid}}", repoGrid)
  .replaceAll("{{updated}}", updated);
await writeFile(join(ROOT, "README.md"), readme);

console.log(`[readme] rendered ${Object.keys(files).length} assets · repos: ${shown.map((r) => r.name).join(", ")}`);
