import * as https from "https";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GITHUB_OWNER = process.env.GITHUB_OWNER ?? "";
const GITHUB_REPO = process.env.GITHUB_REPO ?? "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? "data";

function request<T>(
  method: string,
  contentPath: string,
  body?: object
): Promise<{ status: number; data: T }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const urlPath = `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${contentPath}`;

    const options: https.RequestOptions = {
      hostname: "api.github.com",
      path: method === "GET" ? `${urlPath}?ref=${GITHUB_BRANCH}` : urlPath,
      method,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "tee-time-notifier",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(payload
          ? {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload),
            }
          : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, data: JSON.parse(raw) as T });
        } catch {
          reject(new Error(`Failed to parse GitHub response: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** List file names in a GitHub directory. Returns [] if the directory doesn't exist yet. */
export async function listDir(dirPath: string): Promise<string[]> {
  const { status, data } = await request<Array<{ name: string; type: string }>>(
    "GET",
    dirPath
  );
  if (status === 404) return [];
  if (status >= 400) throw new Error(`GitHub API error ${status} listing ${dirPath}`);
  return data.filter((i) => i.type === "file").map((i) => i.name);
}

/** Read a file from GitHub. Returns null if it doesn't exist. */
export async function readFile(filePath: string): Promise<string | null> {
  const { status, data } = await request<{ content: string }>("GET", filePath);
  if (status === 404) return null;
  if (status >= 400) throw new Error(`GitHub API error ${status} reading ${filePath}`);
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/** Create or update a file on GitHub. */
export async function writeFile(
  filePath: string,
  content: string,
  message: string
): Promise<void> {
  // Fetch current SHA if the file already exists (required for updates)
  let sha: string | undefined;
  const { status, data } = await request<{ sha: string }>("GET", filePath);
  if (status === 200) sha = data.sha;

  const { status: writeStatus } = await request("PUT", filePath, {
    message,
    content: Buffer.from(content).toString("base64"),
    branch: GITHUB_BRANCH,
    ...(sha ? { sha } : {}),
  });

  if (writeStatus >= 400) {
    throw new Error(`GitHub API error ${writeStatus} writing ${filePath}`);
  }
}
