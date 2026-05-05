import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Eye,
  Lock,
  Unlock,
  X
} from "lucide-react";
import {
  getAllUsers,
  getUserTransactions,
  freezeUser,
  unfreezeUser,
  addBalanceToUser
} from "../api/user.api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [allUsers, setAllUsers] = useState([]);
  const [userTransactions, setUserTransactions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAddBalance, setShowAddBalance] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (debouncedSearch) {
      setPage(1);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (selectedUser) {
      loadUserTransactions(selectedUser._id);
    }
  }, [selectedUser]);

  const loadUserTransactions = async (userId) => {
    try {
      const res = await getUserTransactions(userId);
      setUserTransactions(res.data.transactions);
    } catch (err) {
      console.error("Failed to load user transactions", err);
    } finally {
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        if (debouncedSearch) {
          const res = await getAllUsers(1, 500);
          setAllUsers(res.data.users);
        } else {
          const res = await getAllUsers(page, 10);
          setUsers(res.data.users);
          setTotalPages(res.data.totalPages);
        }
      } catch (err) {
        console.error("Failed to load users", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [page, debouncedSearch]);

  const handleFreeze = async (userId) => {
    try {
      await freezeUser(userId);
      if (debouncedSearch) {
        const res = await getAllUsers(1, 500);
        setAllUsers(res.data.users);
      } else {
        const res = await getAllUsers(page, 10);
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages);
      }
      setSelectedUser(null);
    } catch (err) {
      console.error("Freeze failed", err);
    }
  };

  const handleUnfreeze = async (userId) => {
    try {
      await unfreezeUser(userId);
      if (debouncedSearch) {
        const res = await getAllUsers(1, 500);
        setAllUsers(res.data.users);
      } else {
        const res = await getAllUsers(page, 10);
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages);
      }
      setSelectedUser(null);
    } catch (err) {
      console.error("Unfreeze failed", err);
    }
  };


  const filteredUsers = useMemo(() => {
    if (!debouncedSearch) return users;
    return allUsers.filter(user =>
      [
        user.name,
        user._id,
        user.phoneNumber,
        user.accountNumber
      ]
        .join(" ")
        .toLowerCase()
        .includes(debouncedSearch.toLowerCase())
    );
  }, [debouncedSearch, users, allUsers]);

  if (loading) return <div>Loading users...</div>;

  return (
    <>
      {/* HEADER */}
      <h1 className="text-2xl font-semibold mb-1">User Management</h1>
      <p className="text-muted mb-6">Manage and monitor user accounts</p>

      {/* SEARCH */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, account..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {debouncedSearch && (
        <p className="text-sm text-muted mb-4">
          Found {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* TABLE */}
      <div className="bg-card dark:bg-darkcard rounded-xl border overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th className="th">USER ID</th>
              <th className="th">NAME</th>
              <th className="th">CONTACT</th>
              <th className="th">BALANCE</th>
              <th className="th">STATUS</th>
              <th className="th text-right">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map(user => (
              <tr key={user._id}>
                <td className="td">{user._id.slice(-6)}</td>
                <td className="td font-medium">{user.name}</td>

                <td className="td text-sm text-muted">
                  {user.email}
                  <br />
                  {user.phoneNumber}
                </td>

                <td className="td font-semibold">₹{user.balance}</td>

                <td className="td">
                  <span className={`badge ${user.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>
                    {user.status === "ACTIVE" ? 'Active' : 'Frozen'}
                  </span>
                </td>

                {/* ACTIONS */}
                <td className="td">
                  <div className=" gap-9">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Eye size={18} />
                    </button>

                    {user.status === "ACTIVE" ? (
                      <button onClick={() => handleFreeze(user._id)} style={{ paddingLeft: 30 }} className="text-red-500 hover:text-red-600">
                        <Lock size={18} />
                      </button>
                    ) : (
                      <button onClick={() => handleUnfreeze(user._id)} style={{ marginLeft: 30 }} className="text-green-500 hover:text-green-600">
                        <Unlock size={18} />
                      </button>
                    )}
                  </div>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {!debouncedSearch && totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted">
            Showing page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-2 rounded-lg border ${
                  page === i + 1
                    ? "bg-green-600 text-white border-green-600"
                    : "hover:bg-gray-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showAddBalance && selectedUser && (
        <AddBalanceModal
          user={selectedUser}
          onClose={() => setShowAddBalance(false)}
          onSuccess={() => {
            if (debouncedSearch) {
              getAllUsers(1, 500).then(res => setAllUsers(res.data.users));
            } else {
              getAllUsers(page, 10).then(res => { setUsers(res.data.users); setTotalPages(res.data.totalPages); });
            }
          }}
        />
      )}

      {/* USER DETAILS DRAWER */}
      {selectedUser && (
        <UserDrawer openAddBalance={() => setShowAddBalance(true)} handleFreeze={handleFreeze} handleUnfreeze={handleUnfreeze} userTransactions={userTransactions} user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </>
  );
}

/* ================= USER DRAWER ================= */
function UserDrawer({ user, userTransactions, onClose, handleFreeze, handleUnfreeze, openAddBalance }) {
  return (
    <>
      {/* OVERLAY */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40"
      />

      {/* DRAWER */}
      <div className="fixed right-0 top-0 h-full w-[380px] bg-white z-50 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-semibold">User Details</h2>
            <p className="text-sm text-muted">{user._id.slice(-6)}</p>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <button
          onClick={openAddBalance}
          className="mt-3 w-full py-3 rounded-xl bg-green-600 text-white font-medium"
        >
          ➕ Add Balance
        </button>

        <Info label="Name" value={user.name} />
        <Info label="Phone" value={user.phoneNumber} />
        <Info label="Balance" value={`₹${user.balance}`} bold />
        <Info
          label="Status"
          value={
            <span className={`badge ${user.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>
              {user.status === "ACTIVE" ? 'Active' : 'Frozen'}
            </span>
          }
        />
        <Info label="Join Date" value={new Date(user.createdAt).toLocaleDateString()} />

        {/* RECENT TRANSACTIONS (static placeholder) */}
        <h3 className="mt-6 mb-2 font-semibold">Recent Transactions</h3>
        {userTransactions.length > 0 ? (
          userTransactions.map((item, index) => (
            <div key={index} className="border rounded-lg p-3 text-sm">
              {item.txn_id}
              <div className="text-muted">
                {new Date(item.createdAt).toLocaleDateString()}
              </div>
              <div
                className={`font-semibold ${item.type === "CREDIT" ? "text-green-600" : "text-red-600"
                  }`}
              >
                {item.type === "CREDIT" ? "+" : "-"}₹{item.amount}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">No transactions found.</p>
        )}



        {/* FREEZE/UNFREEZE BUTTON */}
        {user.status === "FROZEN" ? (
          <button onClick={() => handleUnfreeze(user._id)} className="mt-6 w-full py-3 rounded-xl bg-green-500 text-white font-medium">
            Unfreeze Account
          </button>
        ) : (
          <button onClick={() => handleFreeze(user._id)} className="mt-6 w-full py-3 rounded-xl bg-red-500 text-white font-medium">
            Freeze Account
          </button>
        )}
      </div>
    </>
  );
}
function AddBalanceModal({ user, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;

    try {
      setLoading(true);
      await addBalanceToUser({
        userId: user._id,
        amount: Number(amount),
        reason
      });

      onSuccess(); // refresh user list
      onClose();
    } catch (err) {
      console.error("Add balance failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl w-[360px] p-6">
          <h2 className="text-lg font-semibold mb-4">Add Balance</h2>

          <div className="mb-3">
            <label className="text-sm text-muted">Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full mt-1 px-4 py-2 border rounded-lg"
              placeholder="5000"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-muted">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full mt-1 px-4 py-2 border rounded-lg"
              placeholder="Salary / Adjustment"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 border rounded-lg"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-green-600 text-white"
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* INFO ROW */
function Info({ label, value, bold }) {
  return (
    <div className="mb-4">
      <p className="text-sm text-muted">{label}</p>
      <div className={bold ? "text-lg font-semibold" : ""}>{value}</div>
    </div>
  );
}
