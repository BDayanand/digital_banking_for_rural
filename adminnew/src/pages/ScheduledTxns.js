import { useEffect, useState, useRef } from "react";
import { Clock, Check, X, AlertTriangle, Timer } from "lucide-react";
import { getScheduledTransactions, processScheduledTransaction } from "../api/transaction.api";

function useCountdown(autoProcessAt, enabled = false) {
  const [remaining, setRemaining] = useState(getRemaining(autoProcessAt));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !autoProcessAt) return;

    const update = () => setRemaining(getRemaining(autoProcessAt));
    intervalRef.current = setInterval(update, 1000);

    return () => clearInterval(intervalRef.current);
  }, [autoProcessAt, enabled]);

  return remaining;
}

function getRemaining(targetDate) {
  if (!targetDate) return { expired: true, ms: 0 };
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) return { expired: true, ms: 0, display: "00:00:00" };

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    expired: false,
    ms: diff,
    display: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}

function CountdownCell({ autoProcessAt }) {
  const remaining = useCountdown(autoProcessAt, !!autoProcessAt);

  if (remaining.expired) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-mono font-bold">
        <Timer size={12} /> Processing...
      </span>
    );
  }

  const isUrgent = remaining.ms < 1000 * 60 * 5;
  const isWarning = remaining.ms < 1000 * 60 * 15;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-mono text-xs font-bold ${
        isUrgent
          ? "bg-red-100 text-red-700 animate-pulse"
          : isWarning
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      <Timer size={12} /> {remaining.display}
    </span>
  );
}

export default function ScheduledTxns() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [stats, setStats] = useState({ PENDING: 0, PROCESSING: 0, COMPLETED: 0, CANCELLED: 0, FAILED: 0 });
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    loadScheduled();
  }, [filter]);

  const loadScheduled = async () => {
    try {
      setLoading(true);
      const res = await getScheduledTransactions(1, 200, filter || undefined);
      setTxns(res.data.transactions || []);
      
      const allTxns = res.data.transactions || [];
      const newStats = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, CANCELLED: 0, FAILED: 0 };
      allTxns.forEach(t => { if (newStats[t.status] !== undefined) newStats[t.status]++; });
      setStats(newStats);
    } catch (err) {
      console.error("Load scheduled error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (txnId, action) => {
    if (!window.confirm(
      action === "approve"
        ? "Approve and process this transaction? Funds will be transferred immediately."
        : "Reject this transaction? It will be cancelled."
    )) return;

    try {
      setProcessingId(txnId);
      await processScheduledTransaction(txnId, action);
      alert(
        action === "approve"
          ? `✅ Transaction approved and processed successfully`
          : `❌ Transaction rejected and cancelled`
      );
      loadScheduled();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to process transaction";
      alert(`Error: ${errorMsg}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div>Loading scheduled transactions...</div>;

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">Scheduled Transactions</h1>
      <p className="text-muted mb-6">Review delayed transactions pending approval</p>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["", "PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED"].map(status => (
          <button
            key={status || "all"}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm ${
              filter === status ? "bg-green-600 text-white" : "border"
            }`}
          >
            {status || "All"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-600" size={24} />
            <div>
              <div className="text-2xl font-bold">{stats.PENDING}</div>
              <div className="text-sm text-yellow-700">Pending</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-blue-600" size={24} />
            <div>
              <div className="text-2xl font-bold">{stats.PROCESSING}</div>
              <div className="text-sm text-blue-700">Processing</div>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Check className="text-green-600" size={24} />
            <div>
              <div className="text-2xl font-bold">{stats.COMPLETED}</div>
              <div className="text-sm text-green-700">Completed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card dark:bg-darkcard rounded-xl border overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr>
              <th className="th">Transaction ID</th>
              <th className="th">User</th>
              <th className="th">Amount</th>
              <th className="th">To Account/UPI</th>
              <th className="th">Delay Reason</th>
              <th className="th">Status</th>
              <th className="th">Countdown</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {txns.map((txn, index) => (
              <tr key={txn.txn_id || txn.id || `txn-${index}`}>
                <td className="td font-mono text-sm">{(txn.txn_id || "").substring(0, 15)}...</td>
                <td className="td">
                  {txn.user?.name || "Unknown"}
                  <div className="text-xs text-muted">{txn.user?.account}</div>
                </td>
                <td className="td font-semibold">₹{txn.amount}</td>
                <td className="td text-sm">
                  {txn.to_account || txn.to_upi || "-"}
                </td>
                <td className="td text-sm text-red-600">
                  {txn.delay_reason ? txn.delay_reason.substring(0, 30) : "-"}
                </td>
                <td className="td">
                  <span className={`badge ${
                    txn.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                    txn.status === "COMPLETED" ? "bg-green-100 text-green-800" :
                    txn.status === "CANCELLED" || txn.status === "FAILED" ? "bg-red-100 text-red-800" :
                    "bg-blue-100 text-blue-800"
                  }`}>
                    {txn.status}
                  </span>
                </td>
                <td className="td">
                  {txn.status === "PENDING" && txn.auto_process_at ? (
                    <CountdownCell autoProcessAt={txn.auto_process_at} />
                  ) : (
                    <span className="text-muted text-sm">-</span>
                  )}
                </td>
                <td className="td text-right">
                  {txn.status === "PENDING" && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleProcess(txn.id, "approve")}
                        disabled={processingId === txn.id}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check size={14} /> {processingId === txn.id ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleProcess(txn.id, "reject")}
                        disabled={processingId === txn.id}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
                      >
                        <X size={14} /> {processingId === txn.id ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {txns.length === 0 && (
              <tr>
                <td colSpan={8} className="td text-center text-muted py-6">
                  {filter ? `No ${filter.toLowerCase()} scheduled transactions` : "No scheduled transactions"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
