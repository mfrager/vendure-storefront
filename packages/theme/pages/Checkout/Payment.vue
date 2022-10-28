<template>
    <div>
        <SfHeading
            :level="3"
            :title="$t('Payment')"
            class="sf-heading--left sf-heading--no-underline title"
        />
        <SfTable class="sf-table--bordered table desktop-only">
            <SfTableHeading class="table__row">
                <SfTableHeader class="table__header table__image">{{ $t('Item') }}</SfTableHeader>
                <SfTableHeader
                    v-for="tableHeader in tableHeaders"
                    :key="tableHeader"
                    class="table__header"
                    :class="{ table__description: tableHeader === 'Description' }"
                >
                    {{ tableHeader }}
                </SfTableHeader>
            </SfTableHeading>
            <SfTableRow
                v-for="(product, index) in products"
                :key="index"
                class="table__row"
            >
                <SfTableData class="table__image">
                    <SfImage :src="cartGetters.getItemImage(product)" :alt="cartGetters.getItemName(product)" />
                </SfTableData>
                <SfTableData class="table__data table__description table__data">
                    <div class="product-title">{{ cartGetters.getItemName(product) }}</div>
                    <div class="product-sku">{{ cartGetters.getItemSku(product) }}</div>
                    <SfProperty
                        v-for="(attribute, key) in cartGetters.getItemOptions(product)"
                        :key="key"
                        :name="attribute.label"
                        :value="attribute.value"
                    />
                </SfTableData>
                <SfTableData class="table__data">{{ cartGetters.getItemQty(product) }}</SfTableData>
                <SfTableData class="table__data price">
                    <SfPrice
                        :regular="$n(cartGetters.getItemPrice(product).regular, 'currency')"
                        :special="cartGetters.getItemPrice(product).special && $n(cartGetters.getItemPrice(product).special, 'currency')"
                        class="product-price"
                    />
                </SfTableData>
            </SfTableRow>
        </SfTable>
        <div class="summary">
            <div class="summary__group">
                <div class="summary__total">
                    <SfProperty
                        :name="$t('Subtotal')"
                        :value="$n(totals.special > 0 ? totals.special : totals.subtotal, 'currency')"
                        class="sf-property--full-width property"
                    />
                </div>

                <SfDivider />

                <SfProperty
                    :name="$t('Total price with shipping')"
                    :value="$n(totals.total, 'currency')"
                    class="sf-property--full-width sf-property--large summary__property-total"
                />

                <SfProperty v-if="!tokenStablecoin"
                    :name="$t('Price in tokens')"
                    :value="tokenOrderTotal"
                    class="sf-property--full-width sf-property--large summary__property-total"
                />

                <VsfPaymentProvider
                    @paymentMethodSelected="updatePaymentMethod"
                    @tokenSelected="updateTokenSelected"
                    :walletConnected="walletConnected"
                    :walletIcon="walletIcon"
                    :walletProcessing="walletProcessing"
                    :walletPubkey="walletPubkey"
                    :tokenData="tokenData"
                    :tokenList="tokenList"
                    :tokenStablecoin="tokenStablecoin"
                    :tokenPrice="tokenPrice"
                    :orderTokens="tokenOrderTotal"
                />
                
                <SfCheckbox v-e2e="'terms'" v-model="terms" name="terms" class="summary__terms">
                    <template #label>
                        <div class="sf-checkbox__label">
                            {{ $t('I agree to') }} <SfLink href="#"> {{ $t('Terms and conditions') }}</SfLink>
                        </div>
                    </template>
                </SfCheckbox>

                <div class="summary__action">
                    <SfButton
                        type="button"
                        class="sf-button color-secondary summary__back-button"
                        @click="$router.push('/checkout/billing')"
                    >
                        {{ $t('Go back') }}
                    </SfButton>
                    <SfButton
                        v-e2e="'make-an-order'"
                        :disabled="!paymentMethod || !terms"
                        class="summary__action-button"
                        @click="processOrder"
                    >
                        {{ $t('Make an order') }}
                    </SfButton>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    SfHeading,
    SfTable,
    SfCheckbox,
    SfButton,
    SfDivider,
    SfImage,
    SfIcon,
    SfPrice,
    SfProperty,
    SfAccordion,
    SfLink
} from '@storefront-ui/vue';
import { onSSR } from '@vue-storefront/core';
import { ref, computed, onMounted } from '@vue/composition-api';
import { useMakeOrder, useCart, cartGetters, usePayment } from '@vue-storefront/vendure';
import $solana from '@/atellix/solana-client';
import socketStore from '@/atellix/socket-store'
import Emitter from 'tiny-emitter';
import axios from 'axios';
import Vue from 'vue';

export default {
    name: 'ReviewOrder',
    components: {
        SfHeading,
        SfTable,
        SfCheckbox,
        SfButton,
        SfDivider,
        SfImage,
        SfIcon,
        SfPrice,
        SfProperty,
        SfAccordion,
        SfLink,
        VsfPaymentProvider: () => import('~/components/Checkout/VsfPaymentProvider')
    },
    setup(props, context) {
        const { cart, load, setCart } = useCart();
        const { loading } = useMakeOrder();
        const { set } = usePayment();

        const terms = ref(false);
        const paymentMethod = ref(null);
        const eventbus = new Emitter();
        const walletConnected = ref(false);
        const walletProcessing = ref(false);
        const walletIcon = ref(false);
        const walletPubkey = ref(false);
        const orderTotal = ref(0);
        const tokenSelected = ref('');
        const tokenList = ref([]);
        const tokenData = ref({});
        const tokenSwapData = ref({});
        const tokenBalance = ref([]);
        const tokenStablecoin = ref(true);
        const tokenPrice = ref('');
        const tokenOrderTotal = ref(0);

        onSSR(async () => {
            await load();
        });

        const baseToken = 'USDV';
        const updatePaymentMethod = method => {
            paymentMethod.value = method;
        };
        const updateTokenSelected = token => {
            tokenSelected.value = token;
            if (tokenData.value[token]) {
                if (tokenData.value[token].stablecoin) {
                    tokenStablecoin.value = true;
                } else {
                    tokenStablecoin.value = false;
                }
            }
            if (tokenSwapData.value[baseToken + '-' + token]) {
                if (tokenSwapData.value[baseToken + '-' + token].oracleTrack) {
                    const oracle = tokenSwapData.value[baseToken + '-' + token].oracleTrack;
                    if ($solana.oracleQuote[oracle]) {
                        eventbus.emit('TokenPrice', $solana.oracleQuote[oracle]);
                    }
                }
            }
        };
        const orderAmount = cart.value.totalWithTax / 100;
        orderTotal.value = orderAmount.toFixed(2);

        eventbus.on('TokenPrice', async (val) => {
            tokenPrice.value = val;
            const fromToken = tokenData.value[tokenSelected.value];
            const toToken = tokenData.value[baseToken];
            const swapKey = baseToken + '-' + tokenSelected.value;
            const spec = await $solana.quoteAmount(toToken, fromToken, tokenSwapData.value[swapKey], orderTotal.value, swapKey, 'buy');
            tokenOrderTotal.value = spec.viewAmount;
        });
        eventbus.on('TransactionResult', async (val) => {
            if (val['status'] === 'complete') {
                const thankYouPath = { name: 'thank-you', query: { order: cart.value.code }};
                context.root.$router.push(context.root.localePath(thankYouPath));
                setCart(null);
            }
        });

        const urlPayment = 'https://atx2.atellix.net/api/payment_gateway/v1/order';
        const urlCheckout = 'https://atx2.atellix.net/api/checkout';
        const urlWebsocket = 'wss://atx2.atellix.net/ws';
        var trackOracle = {};

        onMounted(async () => {
            axios.post(urlCheckout, {
                'command': 'get_tokens',
            }).then((resCheckout) => {
                if (resCheckout.status === 200 && resCheckout.data.result === 'ok') {
                    var tokens = resCheckout.data['tokens'];
                    var swapData = resCheckout.data['swap_data'];
                    tokenData.value = tokens;
                    tokenSwapData.value = swapData;
                    var tokenKeys = [ ...Object.keys(tokens) ];
                    tokenKeys = tokenKeys.sort((a, b) => tokens[a].label.localeCompare(tokens[b].label));
                    var tkList = [];
                    var trackList = []
                    for (var item of tokenKeys) {
                        tokens[item]['id'] = item;
                        tkList.push(tokens[item]);
                    }
                    tokenList.value = tkList;
                    socketStore.registerModule('events', {});
                    socketStore.subscribe((mutation, state) => {
                        if (mutation.type === 'SOCKET_ONOPEN') {
                            //console.log('Atellix websocket subscribe');
                            for (var k in swapData) {
                                const swp = swapData[k];
                                if (swp.oracleTrack && !trackOracle[swp.oracleTrack]) {
                                    trackOracle[swp.oracleTrack] = k.substring(5);
                                    console.log('Track oracle: ' + swp.oracleTrack);
                                    socketStore.dispatch('send_object', { 'command': 'subscribe', 'data': { 'channel': 'event/oracle/' + swp.oracleTrack }});
                                }
                            }
                        } else if (mutation.type === 'SOCKET_ONCLOSE') {
                            console.log('Atellix websocket closed');
                        } else if (mutation.type === 'SOCKET_ONERROR') {
                            console.log('Atellix websocket error');
                            console.log(mutation.payload)
                        } else if (mutation.type === 'SOCKET_ONMESSAGE') {
                            const msg = state.socket.message;
                            if (msg['event'] === 'channel_msg') {
                                //console.log('Channel: ' + msg['channel'] + ' - ' + JSON.stringify(msg['data']));
                                if (msg['channel'].startsWith('event/sig/')) {
                                    eventbus.emit('TransactionResult', msg['data'])
                                } else if (msg['channel'].startsWith('event/oracle/')) {
                                    let oracle = msg['channel'].split('/')[2];
                                    $solana.oracleQuote[oracle] = msg['data']['quote'];
                                    console.log('Oracle quote: ' + oracle + ': ' + $solana.oracleQuote[oracle]);
                                    if (trackOracle[oracle] === tokenSelected.value) {
                                        eventbus.emit('TokenPrice', $solana.oracleQuote[oracle]);
                                    }
                                }
                            }
                        }
                    });
                    //console.log('Atellix websocket connect');
                    Vue.prototype.$connect(urlWebsocket);
                    $solana.init();
                    var wallets = $solana.getWallets();
                    //console.log('Wallets', wallets);
                    var walletAdapter;
                    var walletAwait = new Promise((resolve) => {
                        eventbus.on('WalletConnected', function (val) {
                            resolve(val);
                        });
                    });
                    if (wallets.length > 0) {
                        walletAdapter = wallets[0];
                        walletAdapter.on('connect', function (publicKey) {
                            console.log('Connected to ' + publicKey.toBase58());
                            var walletStatus = {
                                'connnected': true,
                                'icon': walletAdapter.icon,
                                'pubkey': publicKey.toBase58(),
                            };
                            walletIcon.value = walletAdapter.icon;
                            walletConnected.value = true;
                            walletPubkey.value = publicKey.toBase58();
                            eventbus.emit('WalletConnected', true);
                        });
                        walletAdapter.on('disconnect', function () {
                            console.log('Disconnected');
                            var walletStatus = {
                                'connnected': false,
                            };
                            walletConnected.value = false;
                            eventbus.emit('WalletConnected', false);
                        });
                        (async function (x) {
                            await walletAdapter.connect();
                            await walletAdapter.connect(); // Need to call twice on iOS?
                        })();
                    }
                    (async function (x) {
                        var ready = await walletAwait;
                        if (ready) {
                            console.log('Solana ready!');
                            $solana.getProvider(walletAdapter);
                            $solana.updateNetData(resCheckout.data['net_data']);
                        }
                    })();
                }
            });
        });

        const processOrder = async () => {
            console.log('Process order');
            //console.log(cart);
            var amount = cart.value.totalWithTax / 100;
            var resPayment = await axios.post(urlPayment, {
                'order_id': cart.value.code,
                'price_total': amount.toFixed(2),
            }, {
                auth: { username: 'api', password: '685f46052d084a8cbe8c642365c188be27c2a134919f4879886b9d7f8b04e05b' }
            });
            if (resPayment.status === 200 && resPayment.data.result === 'ok') {
                var paydata = resPayment.data;
                var resCheckout = await axios.post(urlCheckout, {
                    'command': 'load',
                    'mode': 'order',
                    'uuid': paydata['order_uuid'],
                });
                if (resCheckout.status === 200 && resCheckout.data.result === 'ok') {
                    const data = resCheckout.data;
                    $solana.updateNetData(data['net_data']);
                    $solana.updateSwapData(data['swap_data']);
                    $solana.updateOrderData(data['order_data']);
                    $solana.updateRegister(async (sig) => {
                        console.log('Register Signature: ' + sig);
                        const resRegister = await axios.post(urlCheckout, {
                            'command': 'register_signature',
                            'op': 'checkout',
                            'sig': sig,
                            'uuid': paydata['order_uuid'],
                            'timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                            'user_key': walletPubkey.value,
                        });
                        if (resRegister.status === 200 && resRegister.data.result === 'ok') {
                            socketStore.dispatch('send_object', { 'command': 'subscribe', 'data': { 'channel': 'event/sig/' + sig }});
                            return true;
                        }
                        return false;
                    });
                    const amountTotal = cart.value.totalWithTax * 100;
                    const tokensTotal = amountTotal.toFixed(0);
                    const swapKey = baseToken + '-' + tokenSelected.value;
                    var orderParams;
                    if (tokenSelected.value === baseToken) {
                        orderParams = {
                            'tokensTotal': tokensTotal,
                            'swap': false,
                        };
                    } else {
                        orderParams = {
                            'tokensTotal': tokensTotal,
                            'swap': true,
                            'swapKey': swapKey,
                        };
                    }
                    walletProcessing.value = true;
                    const txres = await $solana.merchantCheckout(orderParams);
                    console.log('Transaction Result');
                    console.log(txres);
                    if (txres.result === 'error') {
                        walletProcessing.value = false;
                    }
                }
            }
        };

        return {
            terms,
            loading,
            products: computed(() => cartGetters.getItems(cart.value)),
            totals: computed(() => cartGetters.getTotals(cart.value)),
            tableHeaders: ['Description', 'Quantity', 'Amount'],
            cartGetters,
            processOrder,
            updateTokenSelected,
            updatePaymentMethod,
            paymentMethod,
            walletConnected,
            walletIcon,
            walletProcessing,
            walletPubkey,
            tokenSelected,
            tokenData,
            tokenList,
            tokenStablecoin,
            tokenPrice,
            tokenOrderTotal
        };
    }
};
</script>

<style lang="scss" scoped>
.title {
    margin: var(--spacer-xl) 0 var(--spacer-base) 0;
}
.table {
    margin: 0 0 var(--spacer-base) 0;
    &__row {
        justify-content: space-between;
    }
    @include for-desktop {
        &__header {
            text-align: center;
            &:last-child {
                text-align: right;
            }
        }
        &__data {
            text-align: center;
        }
        &__description {
            text-align: left;
            flex: 0 0 12rem;
        }
        &__image {
            --image-width: 5.125rem;
            text-align: left;
            margin: 0 var(--spacer-xl) 0 0;
        }
    }
}
.product-sku {
    color: var(--c-text-muted);
    font-size: var(--font-size--sm);
    margin-bottom: var(--spacer-base);
}
.price {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
}
.product-price {
    --price-font-size: var(--font-size--base);
}
.summary {
    &__terms {
        margin: var(--spacer-base) 0 0 0;
    }
    &__total {
        margin: 0 0 var(--spacer-sm) 0;
        flex: 0 0 16.875rem;
    }
    &__action {
        @include for-desktop {
            display: flex;
            margin: var(--spacer-xl) 0 0 0;
        }
    }
    &__action-button {
        margin: 0;
        width: 100%;
        margin: var(--spacer-sm) 0 0 0;
        @include for-desktop {
            margin: 0 var(--spacer-xl) 0 0;
            width: auto;
        }
        &--secondary {
            @include for-desktop {
                text-align: right;
            }
        }
    }
    &__back-button {
        margin: var(--spacer-xl) 0 0 0;
        width: 100%;
        @include for-desktop {
            margin: 0 var(--spacer-xl) 0 0;
            width: auto;
        }
        color:    var(--c-white);
        &:hover {
            color:    var(--c-white);
        }
    }
    &__property-total {
        margin: var(--spacer-xl) 0 0 0;
    }
}
.property {
    margin: 0 0 var(--spacer-sm) 0;
    &__name {
        color: var(--c-text-muted);
    }
}
.accordion {
    margin: 0 0 var(--spacer-xl) 0;
    &__item {
        display: flex;
        align-items: flex-start;
    }
    &__content {
        flex: 1;
    }
    &__edit {
        flex: unset;
    }
}
.content {
    margin: 0 0 var(--spacer-xl) 0;
    color: var(--c-text);
    &:last-child {
        margin: 0;
    }
    &__label {
        font-weight: var(--font-weight--normal);
    }
}
</style>
