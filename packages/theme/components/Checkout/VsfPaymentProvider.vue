<template>
    <div class="payment-provider">
        <SfHeading
            :level="3"
            :title="$t('Payment methods')"
            class="sf-heading--left sf-heading--no-underline title"
        />
        <div class="form">
            <div class="form__radio-group payment__methods">
                <div v-for="method in paymentMethods" :key="method.id">
                    <template v-if="method.code == 'atellixpay'">
                        <table style="border: 0px; padding: 0px; margin: 0px; width: 100%;"> 
                            <tr style="padding: 0px; margin: 0px;"> 
                                <td style="border: 0px; padding: 0px; margin: 0px; vertical-align: top;" rowspan="3">
                                    <SfRadio
                                        v-e2e="'payment-method'"
                                        :label="method.name"
                                        :value="method.id"
                                        :selected="selectedPaymentMethod.id"
                                        @input="selectPaymentMethod(method)"
                                        name="paymentMethod"
                                        :description="method.description"
                                        class="form__radio payment__method"
                                    >
                                        <template #label="{ label }">
                                            <div class="sf-radio__label payment__label">
                                                <div>{{ label }}</div>
                                            </div>
                                        </template>
                                        <template #description="{ description }">
                                            <div class="sf-radio__description payment__description">
                                                <div class="payment__info" v-html='description'>
                                                </div>
                                            </div>
                                        </template>
                                    </SfRadio>
                                </td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-top: 8px; padding-left: 10px; height: 40px;" colspan="2"> 
                                    <AtellixPayStatus
                                        :walletConnected="walletConnected"
                                        :walletIcon="walletIcon"
                                        :walletProcessing="walletProcessing"
                                        :walletPubkey="walletPubkey"
                                    />
                                </td>
                            </tr>
                            <tr style="padding: 0px; margin: 0px; height: 40px;"> 
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    Select Token: 
                                </td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    <AtellixPayTokens
                                        :walletConnected="walletConnected"
                                        :tokenList="tokenList"
                                        @input="selectToken"
                                    />
                                </td>
                            </tr>
                            <tr style="padding: 0px; margin: 0px; height: 40px;"> 
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    Token Balance:
                                </td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    <AtellixPayBalance
                                        :walletConnected="walletConnected"
                                        :walletPubkey="walletPubkey"
                                        :currentToken="selectedToken"
                                        :tokenData="tokenData"
                                    />
                                </td>
                            </tr>
                            <tr v-if="!tokenStablecoin" style="padding: 0px; margin: 0px; height: 40px;"> 
                                <td style="border: 0px; padding: 0px; margin: 0px;">&nbsp;</td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    Token Price:
                                </td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    {{ tokenPrice }}
                                </td>
                            </tr>
                            <!--<tr v-if="!tokenStablecoin" style="padding: 0px; margin: 0px; height: 40px;"> 
                                <td style="border: 0px; padding: 0px; margin: 0px;">&nbsp;</td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    Tokens For Order:
                                </td>
                                <td style="border: 0px; padding: 0px; margin: 0px; padding-left: 10px;"> 
                                    {{ orderTokens }}
                                </td>
                            </tr>-->
                        </table>
                    </template>
                    <template v-else>
                        <SfRadio
                            v-e2e="'payment-method'"
                            :label="method.name"
                            :value="method.id"
                            :selected="selectedPaymentMethod.id"
                            @input="selectPaymentMethod(method)"
                            name="paymentMethod"
                            :description="method.description"
                            class="form__radio payment__method"
                        >
                            <template #label="{ label }">
                                <div class="sf-radio__label payment__label">
                                    <div>{{ label }}</div>
                                </div>
                            </template>
                            <template #description="{ description }">
                                <div class="sf-radio__description payment__description">
                                    <div class="payment__info" v-html='description'>
                                    </div>
                                </div>
                            </template>
                        </SfRadio>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {
    SfHeading,
    SfButton,
    SfRadio
} from '@storefront-ui/vue';
import { ref, toRefs, onMounted } from '@vue/composition-api';
import { usePaymentProviderMock } from '@/composables/usePaymentProviderMock';
import { usePayment } from '@vue-storefront/vendure';

export default {
    name: 'VsfPaymentProvider',
    props: ['walletConnected', 'walletIcon', 'walletProcessing', 'walletPubkey', 'tokenList', 'tokenData', 'tokenStablecoin', 'tokenPrice', 'orderTokens'],
    components: {
        SfHeading,
        SfButton,
        SfRadio,
        AtellixPayStatus: () => import('~/components/Checkout/AtellixPayStatus'),
        AtellixPayTokens: () => import('~/components/Checkout/AtellixPayTokens'),
        AtellixPayBalance: () => import('~/components/Checkout/AtellixPayBalance'),
    },
    setup (props, { emit }) {
        const { status } = usePaymentProviderMock();
        const selectedToken = ref('');
        const selectedPaymentMethod = ref({});
        const paymentMethods = ref([]);
        const { methods, load } = usePayment();

        const selectPaymentMethod = async (paymentMethod) => {
            selectedPaymentMethod.value = paymentMethod;
            emit('paymentMethodSelected', paymentMethod);
            status.value = true;
        };

        const selectToken = async (token) => {
            selectedToken.value = token;
            emit('tokenSelected', token);
        };

        onMounted(async () => {
            await load();

            paymentMethods.value = methods.value;
        });

        return {
            paymentMethods,
            selectedPaymentMethod,
            selectedToken,
            selectPaymentMethod,
            selectToken
        };
    }
};
</script>

<style lang="scss" scoped>
.title {
    margin: var(--spacer-xl) 0 var(--spacer-base) 0;
    --heading-title-font-weight: var(--font-weight--bold);
}
.form {
    --button-width: 100%;
    @include for-desktop {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        --button-width: auto;
    }
    &__action {
        @include for-desktop {
            flex: 0 0 100%;
            display: flex;
        }
    }
    &__radio-group {
        flex: 0 0 100%;
        margin: 0 0 var(--spacer-xl) 0;
        @include for-desktop {
            margin: 0 0 var(--spacer-xl) 0;
        }

    }
}
.payment {
    &__methods {
        border: 1px solid var(--c-light);
        border-width: 1px 0;
        @include for-desktop {
            display: flex;
            padding: var(--spacer-lg) 0;
        }
    }
    &__method {
        --radio-description-margin: 0;
        --radio-container-align-items: center;
        --ratio-content-margin: 0 0 0 var(--spacer-base);
        --radio-label-font-size: var(--font-base);
        --radio-background: transparent;
        white-space: nowrap;
        --radio-background: transparent;
        @include for-desktop {
            border: 0;
            --radio-border-radius: 4px;
        }
    }
}
</style>
