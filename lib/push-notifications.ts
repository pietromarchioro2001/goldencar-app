import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

type PushPayload = { title: string; body: string; url: string; tag?: string };

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configurazione server Supabase mancante.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function configurePush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@goldencar.app", publicKey, privateKey);
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export async function sendPushNotification(payload: PushPayload) {
  if (!configurePush()) {
    console.warn("Push notifications non configurate: mancano VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.");
    return { sent: 0, skipped: true };
  }
  const client = db();
  const { data, error } = await client.from("push_subscriptions").select("id,endpoint,p256dh,auth");
  if (error) throw error;
  let sent = 0;
  for (const row of data || []) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 12 }
      );
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await client.from("push_subscriptions").delete().eq("id", row.id);
      } else {
        console.error("Invio push non riuscito:", error?.statusCode || error);
      }
    }
  }
  return { sent, skipped: false };
}

export async function sendPushOnce(eventKey: string, payload: PushPayload) {
  const client = db();
  const { data: existing, error: readError } = await client.from("push_notification_events").select("event_key").eq("event_key", eventKey).maybeSingle();
  if (readError) throw readError;
  if (existing) return { sent: 0, duplicate: true };
  const result = await sendPushNotification(payload);
  if (!result.skipped) {
    const { error } = await client.from("push_notification_events").insert({ event_key: eventKey });
    if (error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
  }
  return result;
}
