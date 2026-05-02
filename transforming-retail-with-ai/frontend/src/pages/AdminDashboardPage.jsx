import React, { useEffect, useState } from "react";
import { getAdminMetrics, getLoginTrend12h } from "../api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line
} from "recharts";

function metricCard(label, value, accent) {
  return (
    <div
      className="product-card"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4
      }}
    >
      <div
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6b7280"
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: accent || "#111827"
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AdminDashboardPage() {
  const [metrics, setMetrics] = useState(null);
  const [trend, setTrend] = useState([]);
  const [error, setError] = useState("");

  async function loadMetrics() {
    try {
      const data = await getAdminMetrics();
      setMetrics(data);
      setError("");
    } catch (err) {
      console.error("Admin metrics load error:", err);
      setError(
        err.response?.data?.message || "Unable to load admin metrics."
      );
    }
  }

  async function loadTrend() {
    try {
      const data = await getLoginTrend12h();
      const normalized = data.map((row) => {
        const d = new Date(row.label);
        const hour = d.getHours().toString().padStart(2, "0");
        const min = d.getMinutes().toString().padStart(2, "0");
        return {
          ...row,
          label: `${hour}:00`, // show hour only (e.g., 07:00)
          login_count: row.login_count
        };
      });
      setTrend(normalized);
    } catch (err) {
      console.error("Login trend load error:", err);
    }
  }

  useEffect(() => {
    // Initial load
    loadMetrics();
    loadTrend();

    // Refresh every 3 seconds
    const id = setInterval(() => {
      loadMetrics();
      loadTrend();
    }, 3000);

    return () => clearInterval(id);
  }, []);

  const loading = !metrics && !error;

  return (
    <div className="page">
      <h2 className="page-title">Admin Dashboard</h2>

      {error && <div className="error-text">{error}</div>}
      {loading && <p>Loading dashboard...</p>}

      {metrics && (
        <>
          {/* KPI CARDS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 24
            }}
          >
            {metricCard("Total Users", metrics.total_users ?? 0, "#2563eb")}
            {metricCard("Total Logins", metrics.total_logins ?? 0, "#4f46e5")}
            {metricCard(
              "Active Users (Realtime)",
              metrics.active_users_realtime ?? 0,
              "#16a34a"
            )}
            {metricCard(
              "Total Revenue",
              `₹${Number(metrics.total_revenue || 0).toFixed(2)}`,
              "#ea580c"
            )}
            {metricCard("Total Orders", metrics.total_orders ?? 0, "#0f766e")}
          </div>

          {/* LOGIN CHARTS ROW: A (line) + B (bar) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.2fr)",
              gap: 24,
              marginBottom: 24,
              alignItems: "stretch"
            }}
          >
            {/* Chart A: Line chart – login trend (last 12h) */}
            <div className="product-card" style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8
                }}
              >
                <h3
                  className="page-title"
                  style={{ margin: 0, fontSize: 18 }}
                >
                  Login Trend (Last 12 Hours)
                </h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Updated every 3 seconds
                </span>
              </div>

              {trend.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280" }}>
                  No login data yet.
                </p>
              ) : (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="login_count"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart B: Bar chart – hourly login counts (last 12h) */}
            <div className="product-card" style={{ padding: 16 }}>
              <h3
                className="page-title"
                style={{ margin: 0, marginBottom: 8, fontSize: 18 }}
              >
                Hourly Login Volume (Last 12 Hours)
              </h3>

              {trend.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280" }}>
                  No login data yet.
                </p>
              ) : (
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="login_count" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* TOP PRODUCTS TABLE */}
          <div className="product-card" style={{ padding: 16 }}>
            <h3
              className="page-title"
              style={{ margin: 0, marginBottom: 8, fontSize: 18 }}
            >
              Top Products (Units Sold)
            </h3>

            {(!metrics.top_products ||
              metrics.top_products.length === 0) && (
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                No products sold yet.
              </p>
            )}

            {metrics.top_products && metrics.top_products.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Units Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.top_products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.units_sold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboardPage;

