import { createHash, createHmac } from "node:crypto";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
};

function checkAscii(name: string, value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    if (code > 255) {
      throw new Error(
        `${name} contiene un carattere non valido all'indice ${i} (code ${code}).`
      );
    }
  }
}

function getConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();

  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    (accountId
      ? `https://${accountId}.r2.cloudflarestorage.com`
      : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    throw new Error(
      "Configurazione R2 incompleta nelle variabili d'ambiente."
    );
  }

  // Controlliamo i valori senza MAI stamparli.
  checkAscii("R2_ACCOUNT_ID", accountId);
  checkAscii("R2_ACCESS_KEY_ID", accessKeyId);
  checkAscii("R2_BUCKET", bucket);
  checkAscii("R2_ENDPOINT", endpoint);

  try {
    new URL(endpoint);
  } catch {
    throw new Error("R2_ENDPOINT non è un URL valido.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
  };
}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(path: string) {
  return path
    .split("/")
    .filter(Boolean)
    .map(encodePathSegment)
    .join("/");
}

function getHost(endpoint: string) {
  return new URL(endpoint).host;
}

function getSigningKey(secret: string, date: string) {
  const dateKey = hmac(`AWS4${secret}`, date);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  return hmac(serviceKey, "aws4_request");
}

export async function r2Request(
  method: "GET" | "HEAD" | "PUT" | "DELETE",
  key = "",
  body?: Buffer,
  contentType?: string
) {
  const config = getConfig();

  const endpoint = config.endpoint.replace(/\/+$/, "");
  const normalizedKey = key.replace(/^\/+/, "");

  const path = normalizedKey
    ? `/${encodePath(config.bucket)}/${encodePath(normalizedKey)}`
    : `/${encodePath(config.bucket)}`;

  const url = `${endpoint}${path}`;

  const now = new Date();

  const amzDate =
    now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "") + "Z";

  const shortDate = amzDate.slice(0, 8);

  const payloadHash = body ? sha256(body) : sha256("");
  const host = getHost(endpoint);

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${shortDate}/auto/s3/aws4_request`;

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    getSigningKey(config.secretAccessKey, shortDate)
  )
    .update(stringToSign)
    .digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // Controllo finale anche sull'header che verrà realmente inviato.
  checkAscii("Authorization", authorization);
  checkAscii("host", host);

  const headers: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    Authorization: authorization,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return fetch(url, {
    method,
    headers,
    body:
      body && method !== "GET" && method !== "HEAD"
        ? new Uint8Array(body)
        : undefined,
    cache: "no-store",
  });
}

export async function r2PutObject(
  key: string,
  body: Buffer,
  contentType = "application/octet-stream"
) {
  return r2Request("PUT", key, body, contentType);
}

export async function r2GetObject(key: string) {
  return r2Request("GET", key);
}

export async function r2DeleteObject(key: string) {
  return r2Request("DELETE", key);
}