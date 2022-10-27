<template>
  <div>
     <template v-if="walletConnected"><template v-if="walletIcon"><img :src="walletIcon" style="height: 24px; width: 24px; vertical-align: text-top;"/></template> Wallet Connected</template>
     <template v-else>Wallet Not Connected</template>
  </div>
</template>
<script>
import { computed, ref, toRefs } from '@vue/composition-api';
import { useCart, cartGetters } from '@vue-storefront/vendure';
import { getCalculatedPrice } from '~/helpers';

export default {
  name: 'AtellixPayStatus',
  props: ['walletConnected', 'walletIcon', 'walletProcessing'],
  setup (props) {
    const { cart, removeItem, updateItemQty, applyCoupon } = useCart();

    //const products = computed(() => cartGetters.getItems(cart.value));

    return {
    };
  }
};
</script>

<!--<style lang="scss" scoped>
</style>-->
