import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./layout/Layout";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Funds from "./pages/Funds";
import Fraud from "./pages/Fraud";
import Settings from "./pages/Settings";
import LiveChat from "./pages/LiveChat";
import Reports from "./pages/Reports";
import ScheduledTxns from "./pages/ScheduledTxns";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/fraud" element={<Fraud />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/scheduled" element={<ScheduledTxns />} />
          <Route path="/live-chat" element={<LiveChat />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
