import { useEffect, useState, useMemo } from "react";
import { Search, Check, X, AlertCircle } from "lucide-react";
import axios from "axios";

const adminApi = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" }
});

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/admin/reports");
      setReports(res.data.reports || []);
    } catch (err) {
      console.error("Load reports error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (reportId, status) => {
    try {
      await adminApi.post(`/admin/reports/${reportId}/resolve`, {
        status,
        resolution: status === "RESOLVED" ? "Resolved by admin" : "Rejected by admin"
      });
      loadReports();
    } catch (err) {
      console.error("Resolve error", err);
    }
  };

  const filteredReports = useMemo(() => {
    let result = reports;
    if (filter) result = result.filter(r => r.status === filter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        (r.transaction_id || "").toLowerCase().includes(s) ||
        (r.report_type || "").toLowerCase().includes(s) ||
        (r.reporter?.name || "").toLowerCase().includes(s)
      );
    }
    return result;
  }, [reports, filter, search]);

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      UNDER_REVIEW: "bg-blue-100 text-blue-800",
      RESOLVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800"
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  if (loading) return <div>Loading reports...</div>;

  return (
    <>
      <h1 className="text-2xl font-semibold mb-1">Transaction Reports</h1>
      <p className="text-muted mb-6">Review and resolve user transaction complaints</p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {["PENDING", "UNDER_REVIEW", "RESOLVED", "REJECTED"].map(status => (
          <div 
            key={status}
            onClick={() => setFilter(filter === status ? "" : status)}
            className={`p-4 rounded-xl border cursor-pointer transition ${
              filter === status ? "ring-2 ring-green-500" : ""
            }`}
          >
            <div className="text-2xl font-bold">
              {reports.filter(r => r.status === status).length}
            </div>
            <div className="text-sm text-muted">
              {status === "PENDING" ? "Pending" : 
               status === "UNDER_REVIEW" ? "Under Review" :
               status === "RESOLVED" ? "Resolved" : "Rejected"}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, type, or reporter..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card dark:bg-darkcard rounded-xl border overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th className="th">Transaction ID</th>
              <th className="th">Type</th>
              <th className="th">Amount</th>
              <th className="th">Reporter</th>
              <th className="th">Status</th>
              <th className="th">Date</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map(report => (
              <tr key={report.id}>
                <td className="td font-mono text-sm">
                  {(report.transaction_id || "").substring(0, 20)}...
                </td>
                <td className="td">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500" />
                    {report.report_type?.replace(/_/g, " ")}
                  </div>
                  {report.description && (
                    <div className="text-xs text-muted mt-1">{report.description}</div>
                  )}
                </td>
                <td className="td font-semibold">₹{report.amount || 0}</td>
                <td className="td">
                  {report.reporter?.name || "Unknown"}
                  <div className="text-xs text-muted">{report.reporter?.account}</div>
                </td>
                <td className="td">
                  <span className={`badge ${getStatusBadge(report.status)}`}>
                    {report.status}
                  </span>
                </td>
                <td className="td text-sm text-muted">
                  {report.created_at ? new Date(report.created_at).toLocaleDateString() : "-"}
                </td>
                <td className="td text-right">
                  {report.status === "PENDING" && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleResolve(report.id, "RESOLVED")}
                        className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1"
                      >
                        <Check size={14} /> Resolve
                      </button>
                      <button
                        onClick={() => handleResolve(report.id, "REJECTED")}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm flex items-center gap-1"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  )}
                  {report.status === "UNDER_REVIEW" && (
                    <button
                      onClick={() => handleResolve(report.id, "RESOLVED")}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={7} className="td text-center text-muted py-6">
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}