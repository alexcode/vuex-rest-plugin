<template>
  <div id="app">
    <h1>My Generated Store</h1>
    <button type="button" name="button" @click="populate">
      Populate store
    </button>
    <br />
    <pre>{{ JSON.stringify($store.getters, undefined, 2) }}</pre>
  </div>
</template>

<script>
const data = require('./../tests/unit/apistore.spec.data');

export default {
  methods: {
    populate() {
      this.$store
        .dispatch('api/post', {
          url: 'https://httpbin.org/post',
          type: 'resource',
          data
        })
        .then(() => this.$forceUpdate());
    }
  }
};
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

#app pre {
  text-align: left;
}
</style>
