export type DeliveryEnv = { POLAR_ORG_ID?: string; TEMPLATES_REPO?: string; TEMPLATES_REPO_TOKEN?: string };
export type DeliveredFile = { path: string; base64: string };
type Fetch = typeof fetch;

const POLAR_VALIDATE = "https://api.polar.sh/v1/customer-portal/license-keys/validate";
const GITHUB = "https://api.github.com";
export const DEFAULT_REPO = "vawe-hq/vawe-templates-pro";
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_FILES = 400;

export class DeliveryError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function keyFrom(req: Request): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "")?.[1];
  return bearer ?? new URL(req.url).searchParams.get("key") ?? null;
}

// Polar answers 404 for a key it does not know and 422 for a malformed one; anything else is an outage, not a verdict.
export async function validateKey(key: string, orgId: string, doFetch: Fetch): Promise<boolean> {
  const res = await doFetch(POLAR_VALIDATE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, organization_id: orgId }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new DeliveryError(502, "Could not reach the license service.");
  if (res.status === 404 || res.status === 422) return false;
  if (res.status !== 200) throw new DeliveryError(502, "The license service did not answer.");
  const body = (await res.json().catch(() => null)) as { status?: string } | null;
  return body?.status === "granted";
}

type TreeEntry = { path: string; type: string; sha: string };

async function github(path: string, token: string, doFetch: Fetch) {
  const res = await doFetch(`${GITHUB}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "vawe-templates", "x-github-api-version": "2022-11-28" },
    cache: "no-store",
  }).catch(() => null);
  if (!res || !res.ok) throw new DeliveryError(502, "Could not read the template files.");
  return res.json() as Promise<unknown>;
}

export async function readTemplateFiles(id: string, repo: string, token: string, doFetch: Fetch): Promise<DeliveredFile[] | null> {
  const tree = (await github(`/repos/${repo}/git/trees/HEAD?recursive=1`, token, doFetch)) as { tree?: TreeEntry[]; truncated?: boolean };
  if (tree.truncated || !tree.tree) throw new DeliveryError(502, "Could not read the template files.");
  const prefix = `${id}/`;
  const entries = tree.tree.filter((e) => e.type === "blob" && e.path.startsWith(prefix));
  if (!entries.length) return null;
  if (entries.length > MAX_FILES) throw new DeliveryError(502, "The template has too many files.");
  return Promise.all(
    entries.map(async (e) => {
      const blob = (await github(`/repos/${repo}/git/blobs/${e.sha}`, token, doFetch)) as { content?: string; encoding?: string };
      if (blob.encoding !== "base64" || typeof blob.content !== "string") throw new DeliveryError(502, "Could not read the template files.");
      return { path: e.path.slice(prefix.length), base64: blob.content.replace(/\s/g, "") };
    }),
  );
}

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function deliverTemplate(req: Request, id: string, env: DeliveryEnv, doFetch: Fetch = fetch): Promise<Response> {
  const key = keyFrom(req);
  if (!key) return json(401, { error: "Send your license key as Authorization: Bearer <key>.", buy: `https://vawe.dev/templates/${id}` });
  if (!env.POLAR_ORG_ID || !env.TEMPLATES_REPO_TOKEN) return json(503, { error: "Pro delivery is not set up." });
  if (!ID.test(id)) return json(404, { error: "No such template." });
  try {
    if (!(await validateKey(key, env.POLAR_ORG_ID, doFetch))) return json(403, { error: "This license key is not valid.", buy: `https://vawe.dev/templates/${id}` });
    const files = await readTemplateFiles(id, env.TEMPLATES_REPO || DEFAULT_REPO, env.TEMPLATES_REPO_TOKEN, doFetch);
    return files ? json(200, { files }) : json(404, { error: "No such template." });
  } catch (e) {
    if (e instanceof DeliveryError) return json(e.status, { error: e.message });
    throw e;
  }
}
