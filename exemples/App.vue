<template>
  <div id="app">
    <h1>My Generated Store</h1>
    <button type="button" name="button" @click="populate">
      Populate store
    </button>
    <br />
    <code>{{ JSON.stringify($store.getters) }}</code>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
const data = require('./../tests/unit/apistore.spec.data');

@Component
export default class App extends Vue {
  populate(): void {
    this.$store
      .dispatch('post', {
        url: 'https://httpbin.org/post',
        type: 'resource',
        data
      })
      .then(() => this.$forceUpdate());
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
