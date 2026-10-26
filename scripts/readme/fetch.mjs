// Collects everything the README shows. Every source is optional: if one
// fails, its value is null and the renderer falls back to a "syncing" state.

const GH = "https://api.github.com";

function ghHeaders(token) {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "readme-pulse",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function soft(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[readme] ${label} unavailable: ${err.message}`);
    return null;
  }
}

async function fetchUser(login, token) {
  return getJson(`${GH}/users/${login}`, ghHeaders(token));
}

async function fetchRepos(login, token) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await getJson(
      `${GH}/users/${login}/repos?type=owner&sort=pushed&per_page=100&page=${page}`,
      ghHeaders(token),
    );
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function fetchContributions(login, token, days) {
  if (!token) throw new Error("no token for GraphQL");
  const to = new Date();
  const from = new Date(to.getTime() - (days + 7) * 864e5);
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
    user(login:$login){contributionsCollection(from:$from,to:$to){
      contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch(`${GH}/graphql`, {
    method: "POST",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? res.status));
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const flat = weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount }));
  return flat.slice(-days);
}

async function fetchEvents(login, token) {
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await getJson(`${GH}/users/${login}/events/public?per_page=100&page=${page}`, ghHeaders(token));
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

// Daily counts derived from public events, used when GraphQL is unavailable.
function contributionsFromEvents(events, days) {
  const counts = new Map();
  for (const e of events) {
    const day = e.created_at.slice(0, 10);
    const n = e.type === "PushEvent" ? e.payload?.size || 1 : 1;
    counts.set(day, (counts.get(day) ?? 0) + n);
  }
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    out.push({ date, count: counts.get(date) ?? 0 });
  }
  return out;
}

async function fetchWakatime(user, apiKey) {
  const attempts = [];
  if (apiKey) {
    attempts.push({
      url: "https://wakatime.com/api/v1/users/current/stats/last_7_days",
      headers: { Authorization: `Basic ${Buffer.from(apiKey).toString("base64")}` },
    });
  }
  if (user) attempts.push({ url: `https://wakatime.com/api/v1/users/${user}/stats/last_7_days`, headers: {} });

  let lastErr = new Error("no WakaTime user or key configured");
  for (const { url, headers } of attempts) {
    try {
      const { data } = await getJson(url, headers);
      if (!data?.languages?.length) throw new Error(`no language data yet (status: ${data?.status})`);
      return {
        total: data.human_readable_total_including_other_language ?? data.human_readable_total,
        dailyAverage: data.human_readable_daily_average_including_other_language ?? data.human_readable_daily_average,
        languages: data.languages.slice(0, 5).map((l) => ({ name: l.name, percent: l.percent, text: l.text })),
        editor: data.editors?.[0]?.name ?? null,
        os: data.operating_systems?.[0]?.name ?? null,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function collect(config, env) {
  const token = env.README_TOKEN || env.GITHUB_TOKEN;
  const { login } = config;

  const [user, repos, events, calendar, waka] = await Promise.all([
    soft("user", () => fetchUser(login, token)),
    soft("repos", () => fetchRepos(login, token)),
    soft("events", () => fetchEvents(login, token)),
    soft("contributions", () => fetchContributions(login, token, config.heartbeatDays)),
    soft("wakatime", () => fetchWakatime(config.wakatimeUser, env.WAKATIME_API_KEY)),
  ]);

  return {
    user,
    repos,
    events,
    contributions: calendar ?? (events ? contributionsFromEvents(events, config.heartbeatDays) : null),
    waka,
  };
}
