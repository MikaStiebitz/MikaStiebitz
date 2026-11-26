#!/usr/bin/env node
// Rebuilds README.md and assets/path/*.svg from live GitHub data.
//
//   node scripts/readme/generate.mjs                  # live (needs GITHUB_TOKEN)
//   node scripts/readme/generate.mjs --fixture f.json # render from a saved snapshot
//   node scripts/readme/generate.mjs --dump f.json    # also save the snapshot

import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./fetch.mjs";
import { head, work, project, shots, moreHeader, moreRow, visitors, tail, layout, esc } from "./render.mjs";
import { readVisitors, issueUrl } from "./visitors.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "assets", "path");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
};

const config = JSON.parse(await readFile(join(ROOT, "readme.config.json"), "utf8"));
const fixture = arg("--fixture");
const data = fixture ? JSON.parse(await readFile(fixture, "utf8")) : await collect(config, process.env);
if (arg("--dump")) await writeFile(arg("--dump"), JSON.stringify(data, null, 1));

if (!data.repos) {
  // Without the repo list there is nothing meaningful to publish; keep the last good build.
  console.error("[readme] could not load repositories — leaving README untouched");
  process.exit(0);
}

const now = data.now ? new Date(data.now).getTime() : Date.now();
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const host = (url) => (url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "");

// Reads width and height from a JPEG's frame header, so config only has to name the file.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("not a JPEG with a frame header");
}

async function loadImage({ file, alt }) {
  const buf = await readFile(join(ROOT, "scripts", "readme", "images", file));
  return { ...jpegSize(buf), mime: "image/jpeg", base64: buf.toString("base64"), alt };
}

const publicRepos = data.repos.filter((r) => !r.private && !r.fork && !r.archived);
const byName = new Map(publicRepos.map((r) => [r.name.toLowerCase(), r]));

const featured = [];
for (const fc of config.featured) {
  const repo = byName.get(fc.repo.toLowerCase());
  if (!repo) {
    console.warn(`[readme] featured repo ${fc.repo} is not public (any more), skipping it`);
    continue;
  }
  featured.push({
    slug: slug(repo.name),
    name: repo.name,
    url: repo.html_url,
    branch: fc.branch,
    color: fc.color,
    state: fc.state,
    note: fc.note,
    description: fc.description ?? repo.description ?? "",
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language,
    link: host(fc.link ?? repo.homepage),
    images: await Promise.all((fc.images ?? []).map(loadImage)),
  });
}

const skip = new Set([...featured.map((p) => p.name), ...(config.more.exclude ?? [])].map((n) => n.toLowerCase()));
const more = publicRepos
  .filter((r) => !skip.has(r.name.toLowerCase()))
  .filter((r) => now - new Date(r.pushed_at).getTime() < config.more.activeWithinDays * 864e5)
  .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
  .slice(0, config.more.max)
  .map((r) => ({
    slug: slug(r.name),
    name: r.name,
    url: r.html_url,
    description: r.description ?? "",
    stars: r.stargazers_count,
    language: r.language,
  }));

const stars = publicRepos.reduce((a, r) => a + r.stargazers_count, 0);
const stats = [
  `${data.user?.public_repos ?? publicRepos.length} public repos`,
  `${stars} ★`,
  data.contributions30d != null ? `${data.contributions30d} contributions in the last 30 days` : null,
].filter(Boolean);

const guests = await readVisitors(ROOT);
const repoUrl = `https://github.com/${config.login}/${config.login}`;

const strips = layout([
  head({ displayName: config.displayName, tagline: config.tagline, stats }),
  work(config.work),
  ...featured.flatMap((p) => (p.images.length ? [project(p), shots(p)] : [project(p)])),
  ...(more.length ? [moreHeader(), ...more.map(moreRow)] : []),
  visitors({
    href: issueUrl(repoUrl, config.visitors.messages[0]),
    commits: guests.slice(0, config.visitors.show).map((g) => ({
      login: g.login,
      message: g.message,
      hash: createHash("sha1").update(`${g.login}${g.at}`).digest("hex").slice(0, 7),
      date: new Date(g.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    })),
  }),
  tail(),
]);

await mkdir(OUT, { recursive: true });
const keep = new Set(strips.map((s) => `${s.name}.svg`));
for (const file of await readdir(OUT)) if (!keep.has(file)) await rm(join(OUT, file));
for (const s of strips) await writeFile(join(OUT, `${s.name}.svg`), s.svg);

// The strips sit on one line with nothing between them, so they stack into one seamless graph.
// The version is a content hash: an image URL only changes when its picture does.
const stripHtml = strips
  .map((s) => {
    const v = createHash("sha1").update(s.svg).digest("hex").slice(0, 8);
    const img = `<img src="assets/path/${s.name}.svg?v=${v}" width="100%" align="top" alt="${esc(s.alt ?? "")}">`;
    return s.href ? `<a href="${esc(s.href)}">${img}</a>` : img;
  })
  .join("");

const commitLinks = config.visitors.messages
  .map((m) => `<a href="${esc(issueUrl(repoUrl, m))}"><code>git commit -m "${esc(m)}"</code></a>`)
  .join("&nbsp; ");

const template = await readFile(join(ROOT, "scripts", "readme", "template.md"), "utf8");
const readme = template
  .replace(/^<!--[\s\S]*?-->\n/, "")
  .replaceAll("{{strips}}", stripHtml)
  .replaceAll("{{commit_links}}", commitLinks)
  .replaceAll("{{login}}", config.login)
  .replaceAll("{{wakatime_user}}", config.wakatimeUser);
await writeFile(join(ROOT, "README.md"), readme);

console.log(`[readme] rendered ${strips.length} strips · featured: ${featured.map((p) => p.name).join(", ")} · more: ${more.map((r) => r.name).join(", ")} · visitors: ${guests.length}`);
