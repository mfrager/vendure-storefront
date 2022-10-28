<template>
  <div>
     <template v-if="walletConnected">
        <template v-if="walletIcon">
            Wallet Connected
            <img :src="walletIcon" style="height: 24px; width: 24px; vertical-align: text-top;"/>
        </template>
     </template>
     <template v-else>Wallet Not Connected</template>
  </div>
</template>
<script>
export default {
  name: 'AtellixPayStatus',
  props: ['walletConnected', 'walletIcon', 'walletProcessing', 'walletPubkey'],
  setup (props) {
    return {};
  }
};
</script>

<!--<style lang="scss" scoped>
</style>-->
