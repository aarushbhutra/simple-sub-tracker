import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkSession,
  createSubscription,
  deleteSubscription,
  listSubscriptions,
  login,
  logout,
  updateSubscription
} from "./lib/api";
import {
  CURRENCIES,
  PERIODS,
  downloadJson,
  formatAmount,
  formatDate
} from "./lib/format";

const EMPTY_FORM = {
  name: "",
  amount: "",
  currency: "USD",
  billing_period: "monthly",
  start_date: "",
  remarks: ""
};

function normalizeForm(form) {
  return {
    ...form,
    amount: Number(form.amount)
  };
}

export default function App() {
  const [authState, setAuthState] = useState("checking");
  const [loginValue, setLoginValue] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState({
    items: [],
    summary: null,
    fx: null
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const fileInputRef = useRef(null);

  const itemCountLabel = useMemo(() => {
    const total = payload.items.length;
    return `${total} subscription${total === 1 ? "" : "s"}`;
  }, [payload.items.length]);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoading(true);
    try {
      const session = await checkSession();
      if (session?.authenticated) {
        setAuthState("open");
        await refresh();
      } else {
        setAuthState("locked");
      }
    } catch {
      setAuthState("locked");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listSubscriptions();
      setPayload(data);
    } catch (requestError) {
      setError(requestError.message || "unable to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    setAuthError("");
    try {
      await login(loginValue);
      setLoginValue("");
      setAuthState("open");
      await refresh();
    } catch (requestError) {
      setAuthError(requestError.message || "login failed");
    }
  }

  async function onLogout() {
    await logout();
    setAuthState("locked");
    setPayload({ items: [], summary: null, fx: null });
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      amount: String(item.amount),
      currency: item.currency,
      billing_period: item.billing_period,
      start_date: item.start_date,
      remarks: item.remarks || ""
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submitForm(event) {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await updateSubscription(editingId, normalizeForm(form));
      } else {
        await createSubscription(normalizeForm(form));
      }
      resetForm();
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "unable to save subscription");
    }
  }

  async function removeItem(id) {
    setError("");
    try {
      await deleteSubscription(id);
      if (editingId === id) {
        resetForm();
      }
      await refresh();
    } catch (requestError) {
      setError(requestError.message || "unable to delete subscription");
    }
  }

  function duplicateItem(item) {
    setEditingId(null);
    setForm({
      name: `${item.name} copy`,
      amount: String(item.amount),
      currency: item.currency,
      billing_period: item.billing_period,
      start_date: item.start_date,
      remarks: item.remarks || ""
    });
  }

  function exportData() {
    downloadJson("simple-sub-tracker-export.json", {
      exported_at: new Date().toISOString(),
      subscriptions: payload.items
    });
  }

  function triggerImport() {
    fileInputRef.current?.click();
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    event.target.value = "";

    try {
      const parsed = JSON.parse(text);
      const subscriptions = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.subscriptions)
          ? parsed.subscriptions
          : null;

      if (!subscriptions) {
        throw new Error("import file must contain a subscriptions array");
      }

      for (const item of subscriptions) {
        await createSubscription({
          name: item.name,
          amount: Number(item.amount),
          currency: item.currency,
          billing_period: item.billing_period,
          start_date: item.start_date,
          remarks: item.remarks || ""
        });
      }

      await refresh();
    } catch (requestError) {
      setError(requestError.message || "unable to import data");
    }
  }

  if (authState === "checking") {
    return <main className="page"><p className="status">checking access...</p></main>;
  }

  if (authState === "locked") {
    return (
      <main className="page">
        <section className="auth-card">
          <h1>simple sub tracker</h1>
          <p>private vault. enter app password.</p>
          <form onSubmit={onLogin} className="auth-form">
            <input
              type="password"
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
              placeholder="app password"
              autoComplete="current-password"
              required
            />
            <button type="submit">unlock</button>
          </form>
          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <h1>simple sub tracker</h1>
          <p>{itemCountLabel}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={exportData}>export</button>
          <button type="button" onClick={triggerImport}>import</button>
          <button type="button" onClick={onLogout}>lock</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={importData}
            hidden
          />
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="status">syncing...</p> : null}

      <section className="grid grid-summary">
        <article className="card">
          <h2>monthly equivalent</h2>
          <p className="metric">{formatAmount(payload.summary?.monthlyInr || 0, "INR")}</p>
          <small>converted summary in inr</small>
        </article>
        <article className="card">
          <h2>annual estimate</h2>
          <p className="metric">{formatAmount(payload.summary?.annualInr || 0, "INR")}</p>
          <small>12 month projection</small>
        </article>
        <article className="card">
          <h2>next charge</h2>
          <p className="metric-sm">{payload.summary?.upcoming?.name || "none"}</p>
          <small>
            {payload.summary?.upcoming
              ? `${formatDate(payload.summary.upcoming.date)} • ${formatAmount(payload.summary.upcoming.amount, payload.summary.upcoming.currency)}`
              : "no subscriptions yet"}
          </small>
        </article>
      </section>

      <section className="grid grid-main">
        <article className="card">
          <h2>{editingId ? "edit subscription" : "add subscription"}</h2>
          <form className="editor" onSubmit={submitForm}>
            <label>
              name
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                maxLength={80}
              />
            </label>

            <div className="form-row">
              <label>
                amount
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                />
              </label>
              <label>
                currency
                <select
                  value={form.currency}
                  onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="form-row">
              <label>
                period
                <select
                  value={form.billing_period}
                  onChange={(event) => setForm((prev) => ({ ...prev, billing_period: event.target.value }))}
                >
                  {PERIODS.map((period) => (
                    <option key={period.value} value={period.value}>{period.label}</option>
                  ))}
                </select>
              </label>
              <label>
                start date
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label>
              remarks
              <textarea
                rows="3"
                maxLength={240}
                value={form.remarks}
                onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
                placeholder="optional notes"
              />
            </label>

            <div className="editor-actions">
              <button type="submit">{editingId ? "update" : "save"}</button>
              {editingId ? (
                <button type="button" className="ghost" onClick={resetForm}>cancel</button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="card">
          <h2>subscriptions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>name</th>
                  <th>amount</th>
                  <th>period</th>
                  <th>start</th>
                  <th>next</th>
                  <th>actions</th>
                </tr>
              </thead>
              <tbody>
                {payload.items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty">no subscriptions added</td>
                  </tr>
                ) : (
                  payload.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.remarks ? <small>{item.remarks}</small> : null}
                      </td>
                      <td>{formatAmount(item.amount, item.currency)}</td>
                      <td>{item.billing_period.replace("_", " ")}</td>
                      <td>{formatDate(item.start_date)}</td>
                      <td>{formatDate(item.next_charge_date)}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="link" onClick={() => startEdit(item)}>edit</button>
                          <button type="button" className="link" onClick={() => duplicateItem(item)}>duplicate</button>
                          <button type="button" className="link danger" onClick={() => removeItem(item.id)}>delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {payload.summary?.nativeMonthly?.length ? (
            <div className="native-breakdown">
              <h3>native monthly by currency</h3>
              <ul>
                {payload.summary.nativeMonthly.map((entry) => (
                  <li key={entry.currency}>
                    <span>{entry.currency}</span>
                    <span>{formatAmount(entry.monthly, entry.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
