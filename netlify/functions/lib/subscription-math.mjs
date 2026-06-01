const PERIOD_TO_MONTHS = {
  monthly: 1,
  bi_monthly: 2,
  annual: 12
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function daysInMonthUtc(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addMonthsClamped(startDate, months) {
  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();
  const day = startDate.getUTCDate();

  const totalMonths = month + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInMonthUtc(targetYear, targetMonth));

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

export function monthlyEquivalent(amount, billingPeriod) {
  const months = PERIOD_TO_MONTHS[billingPeriod] ?? 1;
  return amount / months;
}

export function computeNextChargeDate(startDateValue, billingPeriod, now = new Date()) {
  const startDate = parseIsoDate(startDateValue);
  if (!startDate) {
    return null;
  }

  const months = PERIOD_TO_MONTHS[billingPeriod] ?? 1;
  const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  let cursor = startDate;
  let safetyCounter = 0;

  while (cursor < nowUtc && safetyCounter < 600) {
    cursor = addMonthsClamped(cursor, months);
    safetyCounter += 1;
  }

  return toIsoDate(cursor);
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function summarizeSubscriptions(items, ratesToInr, now = new Date()) {
  const safeRates = {
    USD: Number(ratesToInr?.USD) || 83,
    GBP: Number(ratesToInr?.GBP) || 104,
    INR: 1
  };

  const enriched = items.map((item) => {
    const monthly = monthlyEquivalent(Number(item.amount), item.billing_period);
    const nextCharge = computeNextChargeDate(item.start_date, item.billing_period, now);

    return {
      ...item,
      amount: roundMoney(Number(item.amount)),
      monthly_equivalent: roundMoney(monthly),
      next_charge_date: nextCharge
    };
  });

  const nativeMap = new Map();
  let monthlyInr = 0;

  for (const item of enriched) {
    const currency = item.currency;
    const monthly = item.monthly_equivalent;
    const existing = nativeMap.get(currency) || 0;
    nativeMap.set(currency, existing + monthly);

    const conversion = safeRates[currency] || 1;
    monthlyInr += monthly * conversion;
  }

  const nativeMonthly = Array.from(nativeMap.entries())
    .map(([currency, monthly]) => ({
      currency,
      monthly: roundMoney(monthly)
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const upcoming = enriched
    .filter((item) => item.next_charge_date)
    .sort((a, b) => a.next_charge_date.localeCompare(b.next_charge_date))[0];

  return {
    items: enriched.sort((a, b) => a.name.localeCompare(b.name)),
    summary: {
      monthlyInr: roundMoney(monthlyInr),
      annualInr: roundMoney(monthlyInr * 12),
      nativeMonthly,
      upcoming: upcoming
        ? {
            id: upcoming.id,
            name: upcoming.name,
            date: upcoming.next_charge_date,
            amount: upcoming.amount,
            currency: upcoming.currency
          }
        : null
    }
  };
}
