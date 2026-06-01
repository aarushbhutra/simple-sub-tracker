import { readFxCache, writeFxCache } from "./store.mjs";

const DEFAULT_RATES = {
  USD: 83,
  GBP: 104,
  INR: 1
};

function isFresh(timestamp) {
  if (!timestamp) {
    return false;
  }

  const now = Date.now();
  return now - Number(timestamp) < 24 * 60 * 60 * 1000;
}

export async function resolveRatesToInr() {
  const cached = await readFxCache();
  if (cached?.rates && isFresh(cached.timestamp)) {
    return cached.rates;
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) {
      throw new Error("rate fetch failed");
    }

    const payload = await response.json();
    const usdToInr = Number(payload?.rates?.INR);
    const usdToGbp = Number(payload?.rates?.GBP);

    if (!usdToInr || !usdToGbp) {
      throw new Error("incomplete rates");
    }

    const rates = {
      USD: usdToInr,
      GBP: usdToInr / usdToGbp,
      INR: 1
    };

    await writeFxCache({ timestamp: Date.now(), rates });
    return rates;
  } catch {
    if (cached?.rates) {
      return cached.rates;
    }
    return DEFAULT_RATES;
  }
}
