import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import LineChart from "../components/LineChart";
import DonutChart from "../components/DonutChart";

import {
  getDashboardStats,
  getTransactionChart,
  getCreditDebitStats
} from "../api/dashboard.api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [donutData, setDonutData] = useState(null);



  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [statsRes, chartRes, donutRes] = await Promise.all([
        getDashboardStats(),
        getTransactionChart(),
        getCreditDebitStats()
      ]);

      setStats(statsRes.data);
      setChartData(chartRes.data);
      setDonutData(donutRes.data);
    } catch (err) {
      console.error("Dashboard load failed", err);
    }
  };

  if (!stats) return <div>Loading dashboard...</div>;

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-muted mb-6">Welcome back, Admin</p>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          percent={12.5}
          type="users"
        />

        <StatCard
          title="Total Balance"
          value={`₹${stats.totalBalance}`}
          percent={8.2}
          type="balance"
        />

        <StatCard
          title="Today's Transactions"
          value={stats.todayTransactions}
          percent={23.1}
          type="transactions"
        />

        <StatCard
          title="Fraud Alerts"
          value={stats.fraudAlerts}
          percent={5.4}
          negative
          type="fraud"
        />
      </div>


      {/* CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-card dark:bg-darkcard p-6 rounded-xl border">
          <LineChart data={chartData} />
        </div>

        <div className="bg-card dark:bg-darkcard p-6 rounded-xl border">
          <DonutChart data={donutData} />
        </div>
      </div>
    </>
  );
}
