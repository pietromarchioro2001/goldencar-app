import { S3Client } from "@aws-sdk/client-s3";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Config() {
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

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
  };
}

function getClient() {
  const config = getR2Config();

  return {
    config,
    client: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

function normalizeKey(key: string) {
  return key.trim().replace(/^\/+/, "");
}

function validateKey(key: string) {
  const normalized = normalizeKey(key);

  if (!normalized) {
    throw new Error("Chiave R2 mancante.");
  }

  // Keep the accepted namespace narrow and reject malformed path components.
  // Do not rewrite internal separators: a malformed key must fail closed.
  if (
    normalized.length > 1024 ||
    normalized.includes("\\") ||
    /[\u0000-\u001f\u007f?#]/.test(normalized)
  ) {
    throw new Error("Percorso R2 non valido.");
  }

  const allowedPrefixes = ["veicoli/", "annunci/"];
  if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error("Percorso R2 non consentito.");
  }

  const segments = normalized.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !segments.every((segment) => /^[a-zA-Z0-9._ -]+$/.test(segment))
  ) {
    throw new Error("Percorso R2 non valido.");
  }

  return normalized;
}

export async function createUploadUrl(
  key: string,
  contentType: string
) {
  const { config, client } = getClient();
  const normalizedKey = validateKey(key);

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: normalizedKey,
    ContentType: contentType || "application/octet-stream",
  });

  return getSignedUrl(client, command, {
    expiresIn: 300,
  });
}

export async function createDownloadUrl(key: string) {
  const { config, client } = getClient();
  const normalizedKey = validateKey(key);

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: normalizedKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: 300,
  });
}

export async function deleteR2Object(key: string) {
  const { config, client } = getClient();
  const normalizedKey = validateKey(key);

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: normalizedKey,
  });

  await client.send(command);
}