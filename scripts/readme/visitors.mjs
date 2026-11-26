#!/usr/bin/env node
// The "visitors" branch of the README graph. A visitor opens an issue titled
// `commit: <message>`; this script turns every such open issue into an entry
// in data/visitors.json and, once the README is pushed, answers and closes it.
//
//   node scripts/readme/visitors.mjs collect   # issues -> data/visitors.json
//   node scripts/readme/visitors.mjs close     # comment on and close what collect took
//
// Only the visitor's login and one of the fixed messages from
// readme.config.json ever reach the README; free text from an issue does not.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ghHeaders } from "./fetch.mjs";

const PREFIX = "commit:";
const KEEP = 50;

const visitorsFile = (root) => join(root, "data", "visitors.json");

export async function readVisitors(root) {
  try {
    return JSON.parse(await readFile(visitorsFile(root), "utf8"));
  } catch {
    return [];
  }
}

export function issueUrl(repoUrl, message) {
  const body = "Just press the green button. A bot adds your name to the visitors branch of my profile README and closes this issue.";
  return `${repoUrl}/issues/new?title=${encodeURIComponent(`${PREFIX} ${message}`)}&body=${encodeURIComponent(body)}`;
}

// Maps an issue title to one of the allowed messages; anything else gets the first one.
export function pickMessage(title, allowed) {
  const wanted = title.slice(PREFIX.length).trim().toLowerCase();
  return allowed.find((m) => m.toLowerCase() === wanted) ?? allowed[0];
}

// Newest first, one entry per person.
export function addVisitor(list, entry) {
  const rest = list.filter((v) => v.login.toLowerCase() !== entry.login.toLowerCase());
  return [entry, ...rest].slice(0, KEEP);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    method,
    headers: { ...ghHeaders(process.env.GITHUB_TOKEN), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${method} ${path}`);
  return res.json();
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const config = JSON.parse(await readFile(join(root, "readme.config.json"), "utf8"));
  const taken = join(process.env.RUNNER_TEMP ?? root, "visitor-issues.json");
  const mode = process.argv[2];

  if (mode === "collect") {
    const issues = (await api("/issues?state=open&per_page=100&sort=created&direction=asc")).filter(
      (i) => !i.pull_request && i.title.toLowerCase().startsWith(PREFIX),
    );
    let list = await readVisitors(root);
    for (const issue of issues) {
      list = addVisitor(list, {
        login: issue.user.login,
        message: pickMessage(issue.title, config.visitors.messages),
        at: issue.created_at,
      });
    }
    if (issues.length) {
      await mkdir(dirname(visitorsFile(root)), { recursive: true });
      await writeFile(visitorsFile(root), JSON.stringify(list, null, 2) + "\n");
    }
    await writeFile(taken, JSON.stringify(issues.map((i) => ({ number: i.number, login: i.user.login }))));
    console.log(`[visitors] collected ${issues.length} commit issue(s)`);
  } else if (mode === "close") {
    const issues = JSON.parse(await readFile(taken, "utf8").catch(() => "[]"));
    for (const { number, login } of issues) {
      await api(`/issues/${number}/comments`, {
        method: "POST",
        body: { body: `Thanks @${login}! Your commit is on the \`visitors\` branch of [my profile](https://github.com/${config.login}). It can take a few minutes until GitHub shows the new image.` },
      });
      await api(`/issues/${number}`, { method: "PATCH", body: { state: "closed" } });
    }
    console.log(`[visitors] closed ${issues.length} issue(s)`);
  } else {
    console.error("usage: visitors.mjs collect|close");
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
