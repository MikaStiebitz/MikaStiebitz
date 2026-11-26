# How this profile README builds itself

The README is one git graph that runs down the page: the day job is `main`, each project is a branch, and visitors can add a commit of their own. [`.github/workflows/readme.yml`](../../.github/workflows/readme.yml) rebuilds it every 6 hours and whenever a visitor leaves a commit. The scripts need no dependencies.

1. **`visitors.mjs collect`** turns every open issue titled `commit: <message>` into an entry in `data/visitors.json`.
2. **`generate.mjs`** fetches the live numbers (`fetch.mjs`), renders the graph (`render.mjs`) into `assets/path/` and writes `README.md` from `template.md`.
3. The workflow commits only if something changed, then **`visitors.mjs close`** thanks the visitors and closes their issues.

The graph is cut into full-width SVG strips so each station can be its own link. They share one timeline: on load the path grows from top to bottom, then a commit dot keeps travelling down it. The strips must stay on one line in `README.md` with `align="top"`, otherwise gaps appear between them.

| Want to change… | Edit |
| --- | --- |
| Name, tagline, the Tradebyte station (`since` and `what` are optional lines) | `readme.config.json` |
| Featured projects: order, branch name, colour, text, `shipped` or `wip` | `featured` in `readme.config.json` |
| Project photos | JPEGs in `images/`, named in `featured[].images` |
| How many other repos show up, and which never do | `more` in `readme.config.json` |
| The messages visitors can pick | `visitors.messages` in `readme.config.json` |
| Icons, badges and links under the graph | `template.md` (never `README.md`, which gets overwritten) |
| Look of the graph | `render.mjs` |

Visitors: only a GitHub login and one of the fixed messages ever reach the README, never free text from an issue. To remove someone, delete their entry from `data/visitors.json`.

Optional repository secret: `README_TOKEN`, a PAT with `read:user`, so contributions to private repos count too. Without it the default `GITHUB_TOKEN` is used.

Preview locally from a saved snapshot:

```sh
GITHUB_TOKEN=… node scripts/readme/generate.mjs --dump snapshot.json
node scripts/readme/generate.mjs --fixture snapshot.json
```
