# How this profile README builds itself

Every 4 hours, [`.github/workflows/readme.yml`](../../.github/workflows/readme.yml) runs `generate.mjs`. The script needs no dependencies and does three things:

1. **Collects data** (`fetch.mjs`): profile, public repos, public events, the contribution calendar (GraphQL) and WakaTime's last 7 days. If one source fails, the bot keeps going and shows that panel as "syncing".
2. **Renders SVGs** (`render.mjs`) into `assets/`: the `mika.os` boot screen, the ECG heartbeat, the activity timeline, WakaTime stats and one card per active repo. The SVGs are hand-written, animated with SMIL and use no external fonts or images, so GitHub's image proxy shows them as they are, animations included.
3. **Writes `README.md`** from `template.md` and commits only if something changed.

| Want to change… | Edit |
| --- | --- |
| Text, layout, sections, toolbox icons | `template.md` (never `README.md`, which gets overwritten) |
| Repo cards (count, what counts as "active", exclusions), tagline, rotating "currently" roles | `readme.config.json` |
| Look of a panel | `render.mjs` |

Optional repository secrets:

- `WAKATIME_API_KEY`: needed unless your WakaTime stats are public.
- `README_TOKEN`: a PAT with `read:user`, so contributions to private repos count toward the pulse. Without it, the default `GITHUB_TOKEN` is used.

Preview locally from a saved snapshot:

```sh
GITHUB_TOKEN=… node scripts/readme/generate.mjs --dump snapshot.json
node scripts/readme/generate.mjs --fixture snapshot.json
```
