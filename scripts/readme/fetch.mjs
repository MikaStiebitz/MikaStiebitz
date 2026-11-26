// Collects the live numbers the README shows. Every source is optional: if
// one fails, its value is null and the renderer leaves that number out.

const GH = "https://api.github.com";

export function ghHeaders(token) {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "readme-graph",
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
  const from = new Date(to.getTime() - days * 864e5);
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
    user(login:$login){contributionsCollection(from:$from,to:$to){
      contributionCalendar{totalContributions}}}}`;
  const res = await fetch(`${GH}/graphql`, {
    method: "POST",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? res.status));
  return json.data.user.contributionsCollection.contributionCalendar.totalContributions;
}

export async function collect(config, env) {
  const token = env.README_TOKEN || env.GITHUB_TOKEN;
  const { login } = config;

  const [user, repos, contributions30d] = await Promise.all([
    soft("user", () => getJson(`${GH}/users/${login}`, ghHeaders(token))),
    soft("repos", () => fetchRepos(login, token)),
    soft("contributions", () => fetchContributions(login, token, 30)),
  ]);

  return { user, repos, contributions30d };
}
