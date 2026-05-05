import NetInfo from '@react-native-community/netinfo';

let isConnected = true;
let unsubscribe = null;

export const checkConnection = async () => {
  const state = await NetInfo.fetch();
  isConnected = state.isConnected && state.isInternetReachable !== false;
  return isConnected;
};

export const getConnectionStatus = () => isConnected;

export const subscribeToConnectionChanges = (callback) => {
  unsubscribe = NetInfo.addEventListener(state => {
    const wasConnected = isConnected;
    isConnected = state.isConnected && state.isInternetReachable !== false;
    
    if (!wasConnected && isConnected && callback) {
      callback(true);
    } else if (wasConnected && !isConnected && callback) {
      callback(false);
    }
  });
  
  checkConnection();
  
  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
};