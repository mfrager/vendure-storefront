<template>
  <div>
    {{ price }}
  </div>
</template>
<script>
import { ref, computed, toRefs, watch } from '@vue/composition-api';
import $solana from '@/atellix/solana-client';

export default {
  name: 'AtellixPayTokenPrice',
  props: ['tokenPrice', 'tokenData', 'currentToken'],
  setup (props) {
    const { tokenPrice, tokenData, currentToken } = toRefs(props);
    const price = ref(0);

    const formatPrice = (tokenInfo, balance) => {
        var dcm = tokenInfo.decimals;
        var vdc = tokenInfo.viewDecimals;
        var res = $solana.math.evaluate('bal / 10^dcm', { bal: balance.toString(), dcm: dcm.toString() });
        return new Number(res).toLocaleString('en-US', { minimumFractionDigits: vdc, maximumFractionDigits: vdc });
    }

    watch(tokenPrice, async (val) => {
      const tokenInfo = tokenData.value[currentToken.value];
      price.value = formatPrice(tokenInfo, val);
    });

    watch(currentToken, async (val) => {
      const tokenInfo = tokenData.value[val];
      price.value = formatPrice(tokenInfo, tokenPrice.value);
    });

    return {
      price
    };
  }
}
</script>

<!--<style lang="scss" scoped>
</style>-->
