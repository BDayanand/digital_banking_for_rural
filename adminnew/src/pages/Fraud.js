import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  Flag,
  Shield,
  Search,
  Info
} from "lucide-react";

import {
  getFraudStats,
  getFraudAlerts,
  freezeUser,
  unfreezeUser,
  escalateTransaction,
} from "../api/fraud.api";

export default function Fraud() {
  const [stats, setStats] = useState({ highRisk: 0, flaggedUsers: 0, suspiciousTransactions: 0 });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFraudData();
  }, []);

  const loadFraudData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, alertsRes] = await Promise.all([
        getFraudStats(),
        getFraudAlerts(),
      ]);
      setStats(statsRes.data || { highRisk: 0, flaggedUsers: 0, suspiciousTransactions: 0 });
      setAlerts(alertsRes.data || []);
    } catch (err) {
      console.error("Fraud load error", err);
      setError("Failed to load fraud data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = useMemo(() => {
    if (!search) return alerts;

    return alerts.filter(a =>
      [
        a.alert_id,
        a.user_id?.name,
        a.fraud_reason
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [alerts, search]);

  if (loading) return <div>Loading fraud data...</div>;

  if (error) return (
    <div className="text-red-500 p-4 rounded-lg bg-red-50 border border-red-200">
      {error}
      <button 
        onClick={loadFraudData}
        className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
      >
        Retry
      </button>
    </div>
  );

  return (
    <>
      {/* HEADER */}
      <h1 className="text-2xl font-semibold mb-1">Fraud Management</h1>
      <p className="text-muted mb-6">
        Monitor and manage fraud alerts
      </p>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Stat
          icon={AlertTriangle}
          title="High Risk"
          value={stats.highRisk}
          color="red"
        />
        <Stat
          icon={Flag}
          title="Flagged Users"
          value={stats.flaggedUsers}
          color="yellow"
        />
        <Stat
          icon={Shield}
          title="Suspicious Transactions"
          value={stats.suspiciousTransactions}
          color="gray"
        />
      </div>

      {/* SEARCH */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts, user, reason..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border
                       bg-transparent focus:outline-none
                       focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card dark:bg-darkcard rounded-xl border overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr>
              <th className="th">ALERT ID</th>
              <th className="th">USER</th>
              <th className="th">REASON</th>
              <th className="th">AMOUNT</th>
              <th className="th">RISK LEVEL</th>
              <th className="th">DATE & TIME</th>
              <th className="th text-right">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {filteredAlerts.map(alert => (
              <tr key={alert._id}>
                <td className="td">{alert.alert_id}</td>

                {/* USER */}
                <td className="td">
                  <div className="font-medium">
                    {alert.user_id?.name}
                  </div>
                  <div className="text-sm text-muted">
                    {alert.user_id?.userCode}
                  </div>
                </td>

                {/* REASON */}
                <td className="td">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-gray-400" />
                    {alert.fraud_reason}
                  </div>
                </td>

                {/* AMOUNT */}
                <td className="td font-semibold">
                  {alert.amount ? `₹${alert.amount}` : "N/A"}
                </td>

                {/* RISK */}
                <td className="td">
                  <span
                    className={`badge ${
                      alert.risk === "HIGH"
                        ? "badge-red"
                        : "badge-yellow"
                    }`}
                  >
                    {alert.risk === "HIGH"
                      ? "High Risk"
                      : "Medium Risk"}
                  </span>
                </td>

                {/* DATE */}
                <td className="td text-sm text-muted">
                  {new Date(alert.createdAt).toLocaleDateString()}
                  <br />
                  {new Date(alert.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </td>

                {/* ACTIONS */}
                <td className="td text-right space-x-2">
                  <button className="badge badge-green">
                    Review
                  </button>
                  <button
                    onClick={() => freezeUser(alert.user_id._id)}
                    className="badge badge-red"
                  >
                    Freeze
                  </button>
                  <button
                    onClick={() => escalateTransaction(alert.txn_id)}
                    className="badge badge-yellow"
                  >
                    Escalate
                  </button>
                </td>
              </tr>
            ))}

            {filteredAlerts.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="td text-center text-muted py-6"
                >
                  No fraud alerts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------- STAT CARD ---------- */
function Stat({ icon: Icon, title, value, color }) {
  const styles = {
    red: "bg-red-100 text-red-600",
    yellow: "bg-yellow-100 text-yellow-600",
    gray: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="bg-card dark:bg-darkcard border rounded-xl p-6 flex gap-4">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center ${styles[color]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-muted">{title}</p>
        <h2 className="text-3xl font-bold">{value}</h2>
      </div>
    </div>
  );
}
