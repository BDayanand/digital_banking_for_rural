import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { api_url } from "../config";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomToolbar from "./bottomToolBar";
import Ionicons from "react-native-vector-icons/Ionicons";

const MyReportsScreen = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await axios.get(`${api_url}/reports/my-reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(res.data.reports);
    } catch (err) {
      console.error("Load reports error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "PENDING": return "#F59E0B";
      case "UNDER_REVIEW": return "#3B82F6";
      case "RESOLVED": return "#16A34A";
      case "REJECTED": return "#DC2626";
      default: return "#6B7280";
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reports</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>No reports yet</Text>
            <Text style={styles.emptySubtext}>Your transaction reports will appear here</Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.report_id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
                  <Text style={styles.statusText}>{report.status_display}</Text>
                </View>
                <Text style={styles.dateText}>{formatDate(report.createdAt)}</Text>
              </View>

              <View style={styles.txnInfo}>
                <Text style={styles.txnIdLabel}>Transaction ID:</Text>
                <Text style={styles.txnIdValue}>{report.transaction_id}</Text>
              </View>

              <View style={styles.details}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Issue Type:</Text>
                  <Text style={styles.detailValue}>{report.report_type_display}</Text>
                </View>
                
                {report.amount && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text style={styles.detailValue}>₹{report.amount}</Text>
                  </View>
                )}

                {report.description && (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.detailLabel}>Description:</Text>
                    <Text style={styles.descriptionText}>{report.description}</Text>
                  </View>
                )}

                {report.resolution && (
                  <View style={styles.resolutionBox}>
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <Text style={styles.resolutionText}>{report.resolution}</Text>
                  </View>
                )}

                {report.resolved_at && (
                  <Text style={styles.resolvedText}>
                    Resolved on {formatDate(report.resolved_at)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomToolbar navigation={navigation} active="Home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FB" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    backgroundColor: "#1E3A8A",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyText: { color: "#6B7280", fontSize: 18, fontWeight: "600", marginTop: 12 },
  emptySubtext: { color: "#9CA3AF", fontSize: 14, marginTop: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  dateText: { color: "#9CA3AF", fontSize: 12 },
  txnInfo: { backgroundColor: "#F3F4F6", padding: 12, borderRadius: 8, marginBottom: 12 },
  txnIdLabel: { fontSize: 12, color: "#6B7280" },
  txnIdValue: { fontSize: 13, color: "#1F2937", fontWeight: "500", marginTop: 2 },
  details: {},
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailLabel: { color: "#6B7280", fontSize: 14 },
  detailValue: { color: "#1F2937", fontSize: 14, fontWeight: "500" },
  descriptionBox: { marginTop: 8, padding: 10, backgroundColor: "#FEF3C7", borderRadius: 8 },
  descriptionText: { color: "#92400E", fontSize: 13, marginTop: 4 },
  resolutionBox: { flexDirection: "row", alignItems: "center", marginTop: 12, padding: 12, backgroundColor: "#DCFCE7", borderRadius: 8 },
  resolutionText: { color: "#166534", fontSize: 14, marginLeft: 8, flex: 1 },
  resolvedText: { color: "#16A34A", fontSize: 12, marginTop: 8, textAlign: "right" },
});

export default MyReportsScreen;