export const CURRENCIES = ["USD", "GBP", "INR"];
export const PERIODS = [
  { value: "monthly", label: "monthly" },
  { value: "bi_monthly", label: "bi monthly" },
  { value: "annual", label: "annual" }
];

export function formatAmount(value, currency) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(isoDate) {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

export function downloadJson(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
