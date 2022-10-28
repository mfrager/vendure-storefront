<template>
  <div>
     <template v-if="walletConnected">
        <select v-model="currentToken" @change="updateTokenSelected">
          <option v-for="token in tokenList" :key="token.id" :value="token.id">{{ token.label }}</option>
        </select>
     </template>
  </div>
</template>
<script>
import { ref, onMounted } from '@vue/composition-api';
import axios from 'axios';

export default {
  name: 'AtellixPayTokens',
  props: ['walletConnected', 'tokenList'],
  setup (props, { emit }) {
    const currentToken = ref('USDC');

    const updateTokenSelected = evt => {
        emit('input', evt.target.value);
    };

    onMounted(async () => {
        var urlCheckout = 'https://atx2.atellix.net/api/checkout';
        var resCheckout = await axios.post(urlCheckout, {
            'command': 'get_tokens',
        });
        if (resCheckout.status === 200 && resCheckout.data.result === 'ok') {
            emit('input', currentToken.value);
        }
    });
    return {
      currentToken,
      updateTokenSelected
    };
  }
}
</script>

<!--<style lang="scss" scoped>
</style>-->
