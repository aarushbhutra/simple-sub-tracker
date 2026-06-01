import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decryptJson, encryptJson } from "./lib/crypto.mjs";
import { resolveRatesToInr } from "./lib/fx.mjs";
import { errorResponse, getQueryValue, jsonResponse, parseJsonBody } from "./lib/http.mjs";
import { isAuthenticated } from "./lib/session.mjs";
import { readEncryptedSubscriptions, writeEncryptedSubscriptions } from "./lib/store.mjs";
import { summarizeSubscriptions } from "./lib/subscription-math.mjs";

const subscriptionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.number().finite().nonnegative(),
  currency: z.enum(["USD", "GBP", "INR"]),
  billing_period: z.enum(["monthly", "bi_monthly", "annual"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().trim().max(240).optional().default("")
});

const importSchema = z.array(
  subscriptionSchema.extend({
    id: z.string().optional()
  })
);

async function readRecords() {
  const encrypted = await readEncryptedSubscriptions();
  if (!encrypted) {
    return [];
  }

  const parsed = decryptJson(encrypted);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeRecords(records) {
  const encrypted = encryptJson(records);
  await writeEncryptedSubscriptions(encrypted);
}

async function buildResponse(records) {
  const rates = await resolveRatesToInr();
  const { items, summary } = summarizeSubscriptions(records, rates, new Date());
  return {
    items,
    summary,
    fx: {
      toInr: rates
    }
  };
}

function cleanRecord(record) {
  return {
    id: record.id,
    name: record.name,
    amount: Number(record.amount),
    currency: record.currency,
    billing_period: record.billing_period,
    start_date: record.start_date,
    remarks: record.remarks || "",
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export async function handler(event) {
  try {
    if (!isAuthenticated(event)) {
      return errorResponse(401, "unauthorized");
    }

    const records = await readRecords();

    if (event.httpMethod === "GET") {
      return jsonResponse(200, await buildResponse(records));
    }

    if (event.httpMethod === "POST") {
      const body = await parseJsonBody(event);
      const parsed = subscriptionSchema.parse(body);
      const nowIso = new Date().toISOString();

      records.push(
        cleanRecord({
          ...parsed,
          id: randomUUID(),
          created_at: nowIso,
          updated_at: nowIso
        })
      );

      await writeRecords(records);
      return jsonResponse(200, await buildResponse(records));
    }

    if (event.httpMethod === "PATCH") {
      const id = getQueryValue(event, "id");
      if (!id) {
        return errorResponse(400, "id query param required");
      }

      const body = await parseJsonBody(event);
      const parsed = subscriptionSchema.parse(body);
      const existingIndex = records.findIndex((record) => record.id === id);

      if (existingIndex < 0) {
        return errorResponse(404, "subscription not found");
      }

      records[existingIndex] = cleanRecord({
        ...records[existingIndex],
        ...parsed,
        updated_at: new Date().toISOString()
      });

      await writeRecords(records);
      return jsonResponse(200, await buildResponse(records));
    }

    if (event.httpMethod === "DELETE") {
      const id = getQueryValue(event, "id");
      if (!id) {
        return errorResponse(400, "id query param required");
      }

      const nextRecords = records.filter((record) => record.id !== id);
      if (nextRecords.length === records.length) {
        return errorResponse(404, "subscription not found");
      }

      await writeRecords(nextRecords);
      return jsonResponse(200, await buildResponse(nextRecords));
    }

    if (event.httpMethod === "PUT") {
      const body = await parseJsonBody(event, 300_000);
      const parsed = importSchema.parse(body.subscriptions || body);

      const nowIso = new Date().toISOString();
      const nextRecords = parsed.map((item) =>
        cleanRecord({
          ...item,
          id: item.id || randomUUID(),
          created_at: nowIso,
          updated_at: nowIso
        })
      );

      await writeRecords(nextRecords);
      return jsonResponse(200, await buildResponse(nextRecords));
    }

    return errorResponse(405, "method not allowed");
  } catch (error) {
    if (error?.issues) {
      return errorResponse(400, error.issues[0]?.message || "invalid request");
    }

    return errorResponse(500, error.message || "subscription handler failed");
  }
}
