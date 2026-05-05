import api from "./axios";

export const getFraudStats = () => api.get("/fraud/stats");

export const getFraudAlerts = () => api.get("/fraud/alerts");

export const getFraudAccounts = () => api.get("/fraud/accounts");

export const freezeUser = (userId) => api.post("/fraud/freeze-user", { userId });

export const unfreezeUser = (userId) => api.post("/fraud/unfreeze-user", { userId });

export const escalateTransaction = (txnId) => api.post("/fraud/escalate", { txnId });

export const reportFraudAccount = ({ accountNumber, ifsc, reason }) =>
  api.post("/txns/report", { accountNumber, ifsc, reason });