import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import open from "open";

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

const TOKEN_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".ga-mcp"
);
const TOKEN_PATH = path.join(TOKEN_DIR, "token.json");

interface ClientCredentials {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
}

function loadClientCredentials(clientSecretPath: string): ClientCredentials {
  const content = fs.readFileSync(clientSecretPath, "utf-8");
  const json = JSON.parse(content);

  // Google Cloud Console exports as { installed: {...} } or { web: {...} }
  const creds = json.installed || json.web;
  if (!creds) {
    throw new Error(
      "client_secret.json must contain 'installed' or 'web' credentials"
    );
  }
  return creds;
}

function loadSavedToken(): any | null {
  try {
    const content = fs.readFileSync(TOKEN_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function saveToken(token: any): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function authorizeViaLocalServer(
  oauth2Client: OAuth2Client
): Promise<void> {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url!, `http://localhost:3000`);
        const code = url.searchParams.get("code");

        if (!code) {
          res.writeHead(400);
          res.end("No authorization code received");
          return;
        }

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        saveToken(tokens);

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>인증 완료!</h1><p>이 창을 닫아도 됩니다.</p><script>window.close()</script>"
        );

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500);
        res.end("Authentication failed");
        server.close();
        reject(err);
      }
    });

    server.listen(3000, () => {
      open(authUrl).catch(() => {
        console.error(`Open this URL in your browser:\n${authUrl}`);
      });
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timed out"));
    }, 120000);
  });
}

export async function getAuthenticatedClient(
  clientSecretPath: string
): Promise<OAuth2Client> {
  const creds = loadClientCredentials(clientSecretPath);

  const oauth2Client = new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    "http://localhost:3000"
  );

  // Try to use saved token
  const savedToken = loadSavedToken();
  if (savedToken) {
    oauth2Client.setCredentials(savedToken);

    // Refresh if expired
    if (
      savedToken.expiry_date &&
      savedToken.expiry_date < Date.now()
    ) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        saveToken(credentials);
      } catch {
        // Token refresh failed, need to re-auth
        await authorizeViaLocalServer(oauth2Client);
      }
    }

    return oauth2Client;
  }

  // No saved token, start OAuth flow
  await authorizeViaLocalServer(oauth2Client);
  return oauth2Client;
}
