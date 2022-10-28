<template>
  <div>
     <template v-if="walletConnected">
       {{ tokenBalance }}
     </template>
  </div>
</template>
<script>
import { ref, computed, toRefs, watch } from '@vue/composition-api';
import $solana from '@/atellix/solana-client';

export default {
  name: 'AtellixPayBalance',
  props: ['walletConnected', 'walletPubkey', 'tokenData', 'currentToken'],
  setup (props) {
    const { currentToken, tokenData, walletPubkey, walletConnected } = toRefs(props);
    const tokenBalance = ref(0);

    const formatBalance = (tokenInfo, balance) => {
        var dcm = tokenInfo.decimals;
        var vdc = tokenInfo.viewDecimals;
        var res = $solana.math.evaluate('bal / 10^dcm', { bal: balance.toString(), dcm: dcm.toString() });
        return new Number(res).toLocaleString('en-US', { minimumFractionDigits: vdc, maximumFractionDigits: vdc });
    }

    watch(currentToken, async (val) => {
      const tokenInfo = tokenData.value[val];
      if (walletConnected.value) {
        tokenBalance.value = formatBalance(tokenInfo, await $solana.getTokenBalance(tokenInfo.mint, walletPubkey.value));
      }
    });

    watch(walletConnected, async (val) => {
      if (val) {
        const tokenInfo = tokenData.value[currentToken.value];
        tokenBalance.value = formatBalance(tokenInfo, await $solana.getTokenBalance(tokenInfo.mint, walletPubkey.value));
      }
    });

    return {
      tokenBalance
    };
  }
}
</script>

<!--<style lang="scss" scoped>
</style>-->
