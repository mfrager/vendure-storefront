import Vue from 'vue';
import VueNativeSock from 'vue-native-websocket';
import socketStore from '@/atellix/socket-store';

export default ({ store }, inject) => {
  Vue.use(VueNativeSock, '', {
    store: socketStore,
    connectManually: true,
    format: 'json',
    reconnection: true,
    reconnectionAttempts: 12,
    reconnectionDelay: 5000
  });
};
