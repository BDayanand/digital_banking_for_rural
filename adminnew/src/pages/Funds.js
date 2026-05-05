import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { getAllTransactions } from "../api/transaction.api";

export default function Funds() {
  const [txns, setTxns] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadTransactions();
  }, [page]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await getAllTransactions(page, 10);
      setTxns(res.data.transactions);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Failed to load transactions", err);
    } finally {
      setLoading(false);
    }
  };

  /* 🔍 SEARCH FUNCTIONALITY */
  const filteredTxns = useMemo(() => {
    if (!search) return txns;

    return txns.filter(txn =>
      [
        txn.txn_id,
        txn.user_id?.name,
        txn.user_id?.accountNumber
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search, txns]);

  if (loading) return <div>Loading transactions...</div>;

  return (
    <>
      {/* HEADER */}
      <h1 className="text-2xl font-semibold mb-1">Fund Management</h1>
      <p className="text-muted mb-6">
        Track and manage all transactions
      </p>

      {/* 🔍 SEARCH + FILTER */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative w-full max-w-md">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by ID, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl border 
                       bg-transparent focus:outline-none
                       focus:ring-2 focus:ring-green-500
                       dark:border-gray-700"
          />
        </div>

        <button
          className="flex items-center gap-2 px-4 py-3 rounded-xl border
                     hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Filter size={18} />
          Filters
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-card dark:bg-darkcard rounded-xl border overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr>
              <th className="th">TRANSACTION ID</th>
              <th className="th">FROM USER</th>
              <th className="th">TO USER</th>
              <th className="th">AMOUNT</th>
              <th className="th">TYPE</th>
              <th className="th">STATUS</th>
              <th className="th">DATE</th>
              <th className="th text-right">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {filteredTxns.map(txn => (
              <tr key={txn._id}>
                <td className="td">{txn.txn_id}</td>

                <td className="td">
                  {txn.from_user?.name || txn.user_id?.name || "—"}
                </td>

                <td className="td">
                  {txn.to_user?.name || "—"}
                </td>

                <td className="td font-semibold">
                  ₹{txn.amount}
                </td>

                {/* TYPE */}
                <td className="td">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      txn.type === "CREDIT"
                        ? "text-green-600"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {txn.type === "CREDIT" ? (
                      <ArrowUp size={16} />
                    ) : (
                      <ArrowDown size={16} />
                    )}
                    {txn.type === "CREDIT" ? "Credit" : "Debit"}
                  </span>
                </td>

                {/* STATUS */}
                <td className="td">
                  <span
                    className={`badge ${
                      txn.is_fraud
                        ? "badge-red"
                        : txn.status === "PENDING"
                        ? "badge-yellow"
                        : "badge-green"
                    }`}
                  >
                    {txn.is_fraud
                      ? "Flagged"
                      : txn.status || "Completed"}
                  </span>
                </td>

                {/* DATE */}
                <td className="td text-sm text-muted">
                  {new Date(txn.createdAt).toLocaleDateString()}
                  <br />
                  {new Date(txn.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </td>

                {/* ACTION */}
                <td className="td text-right">
                  <button className="text-green-600 hover:underline font-medium">
                    View Details
                  </button>
                </td>
              </tr>
            ))}

            {filteredTxns.length === 0 && (
              <tr>
                <td colSpan={8} className="td text-center text-muted py-6">
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="flex justify-end gap-3 mt-4">
        <button
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Prev
        </button>

        <span className="px-3 py-2 text-sm">
          Page {page} of {totalPages}
        </span>

        <button
          disabled={page === totalPages}
          onClick={() => setPage(p => p + 1)}
          className="px-4 py-2 border rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </>
  );
}
