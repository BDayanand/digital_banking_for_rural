export default function Settings() {
  return (
    <>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>

      <div className="bg-card dark:bg-darkcard p-6 rounded-xl border mb-6">
        <h3 className="font-semibold mb-4">Admin Profile</h3>

        <div className="grid md:grid-cols-2 gap-6">
          <input className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800" value="Admin User" />
          <input className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800" value="admin@grambank.com" />
          <input className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800" value="+1 234 567 8900" />
          <input className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700" value="Super Admin" disabled />
        </div>

        <button className="mt-6 px-6 py-2 bg-primary text-white rounded-lg">
          Save Changes
        </button>
      </div>

      <div className="bg-card dark:bg-darkcard p-6 rounded-xl border">
        <h3 className="font-semibold mb-4">Session Management</h3>
        <button className="px-6 py-2 bg-red-500 text-white rounded-lg">
          Logout
        </button>
      </div>
    </>
  );
}
