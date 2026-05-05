import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from "react-native";

export default function AlertsScreen() {

  const [alerts, setAlerts] = useState([
    {
      id: 1,
      title: "Balance Fetched Successfully",
      msg: "Your account balance was fetched securely.",
      time: "2 mins ago",
      unread: true,
      icon: "https://cdn-icons-png.flaticon.com/512/845/845646.png"
    },
    {
      id: 2,
      title: "Security Reminder",
      msg: "Never share your MPIN, OTP or password with anyone.",
      time: "1 hour ago",
      unread: false,
      icon: "https://cdn-icons-png.flaticon.com/512/61/61457.png"
    },
    {
      id: 3,
      title: "Transaction Successful",
      msg: "₹5000 sent successfully to Ramesh Kumar.",
      time: "Yesterday",
      unread: false,
      icon: "https://cdn-icons-png.flaticon.com/512/190/190411.png"
    }
  ]);

  const markAsRead = (id) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, unread: false } : a));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Alerts</Text>

      <FlatList
        data={alerts}
        keyExtractor={item => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card,
              item.unread ? styles.unreadCard : null
            ]}
            onPress={() => markAsRead(item.id)}
          >
            <View style={styles.row}>
              <Image source={{ uri: item.icon }} style={styles.icon} />

              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.msg}>{item.msg}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>

              {item.unread && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:"#0f0f12",
    paddingTop:50,
    paddingHorizontal:15
  },

  header:{
    color:"#fff",
    fontSize:24,
    fontWeight:"bold",
    marginBottom:10
  },

  card:{
    backgroundColor:"#1b1435",
    padding:15,
    borderRadius:12,
    marginVertical:6,
  },

  unreadCard:{
    borderWidth:1,
    borderColor:"#7C4DFF"
  },

  row:{
    flexDirection:"row",
    alignItems:"center",
  },

  icon:{
    width:38,
    height:38,
    marginRight:12
  },

  title:{
    color:"#fff",
    fontSize:16,
    fontWeight:"bold"
  },

  msg:{
    color:"#ccc",
    marginTop:3
  },

  time:{
    color:"#888",
    marginTop:4,
    fontSize:12
  },

  dot:{
    width:10,
    height:10,
    backgroundColor:"#7C4DFF",
    borderRadius:50
  }
});
