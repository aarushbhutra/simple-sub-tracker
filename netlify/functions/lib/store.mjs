import { getStore } from "@netlify/blobs";

const DATA_KEY = "subscriptions_encrypted_v1";
const FX_KEY = "fx_cache_v1";

function store() {
  const name = process.env.NETLIFY_BLOB_STORE || "simple-sub-tracker-private";
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (siteID && token) {
    return getStore({ name, siteID, token });
  }

  return getStore({ name });
}

export async function readEncryptedSubscriptions() {
  return store().get(DATA_KEY, { type: "text" });
}

export async function writeEncryptedSubscriptions(payload) {
  await store().set(DATA_KEY, payload);
}

export async function readFxCache() {
  return store().get(FX_KEY, { type: "json" });
}

export async function writeFxCache(payload) {
  await store().setJSON(FX_KEY, payload);
}
