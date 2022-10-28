<template>
  <div>
     <template v-if="walletConnected">
        <template v-if="walletProcessing">
            <div>
                <div style="float: left; width: 25px; margin-right: 20px;"><RingLoader :size="30" /></div>
                <div style="float: left; width: 125px;">Processing on<br/>
                    <img style="height: 15px;" srcset="https://atx2.atellix.net/dist_ext/assets/img/atellix/solana-color-black@2x.png 2x, https://atx2.atellix.net/dist_ext/assets/img/atellix/solana-color-black.png 1x" src="https://atx2.atellix.net/dist_ext/assets/img/atellix/solana-color-black.png"/>
                </div>
                <br clear="all"/>
            </div>
        </template>
        <template v-else-if="walletIcon">
            Wallet Connected
            <img :src="walletIcon" style="height: 24px; width: 24px; vertical-align: text-top;"/>
        </template>
     </template>
     <template v-else>Wallet Not Connected</template>
  </div>
</template>
<script>
import { RingLoader } from '@saeris/vue-spinners';
export default {
  name: 'AtellixPayStatus',
  props: ['walletConnected', 'walletIcon', 'walletProcessing', 'walletPubkey'],
  components: {
    RingLoader
  },
  setup (props) {
    return {};
  }
};
</script>

<!--<style lang="scss" scoped>
</style>-->
