import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        socket: {
            isConnected: false,
            message: '',
            reconnectError: false
        }
    },
    mutations: {
        SOCKET_ONOPEN (state, event) {
            //console.log('WS Connected')
            Vue.prototype.$socket = event.currentTarget;
            state.socket.isConnected = true;
        },
        SOCKET_ONCLOSE (state, event) {
            // console.log('WS Close')
            state.socket.isConnected = false;
            //state.socket.closeEvent = event
        },
        SOCKET_ONERROR (state, event) {
            // console.log('WS Error')
            console.error(state, event);
        },
        // default handler called for all methods
        SOCKET_ONMESSAGE (state, message) {
            state.socket.message = message;
        },
        // mutations for reconnect methods
        SOCKET_RECONNECT (state, count) {
            console.info('Websocket Reconnect');
            console.info(state, count);
        },
        SOCKET_RECONNECT_ERROR (state) {
            state.socket.reconnectError = true;
        }
    },
    actions: {
        send_object: function (context, message) {
            Vue.prototype.$socket.sendObj(message);
        }
    }
})

