# vuex-rest-plugin

This plugin will create a store based on a model. A set of methods will populate your store as well as reference' stores.

## Usage

### Exemple `store.js` file

```js
import Vue from "vue";
import Vuex from "vuex";
import axios from "axios";
import { ApiStorePlugin, ApiState } from "vuex-rest-plugin";

Vue.use(Vuex);
const axiosInstance = axios.create();

export default new Vuex.Store({
  plugins: [
    ApiStorePlugin({
      axios: axiosInstance,
      name: "my_custom_name", //default is 'api'
      dataPath: "path_of_the_retured_payload", //default undefined.
      namespaced: true, // default true
      models: {
        resource: {
          name: "RESOURCE",
          plural: "RESOURCES",
          type: new ApiState(),
          references: {
            user: "user",
            vehicle: "vehicle"
          }
        },
        user: {
          name: "USER",
          plural: "USERS",
          type: new ApiState(),
          references: {
            role: "role"
          }
        },
        vehicle: {
          name: "VEHICLE",
          plural: "VEHICLES",
          type: new ApiState()
        },
        role: {
          name: "ROLE",
          plural: "ROLES",
          type: new ApiState()
        }
      }
    })
  ]
});
```

## Available vuex actions

Vuex-rest actions accept a payload in params.

```ts
{
  id?: string;
  type: string;
  url?: string;
  query?: string | object;
  data?: IndexedObject | Array<IndexedObject>;
}
```

The payload will format the URL as `:type/:id?:query` or `:type?:query` depending of the action.

`id` is the id of the object.

`type` (Required) is type of model.

`url` override of normal formating of the URI to `/:url?:query`.

`query` can be a URL querystring as `my_param=1&my_second_param=2` or an object `{ my_param: 1, my_second_param: 2 }`.

`data` the payload to send with a `PATCH` or `POST` requests.

### `get`

```js
// fetch array
this.$store.dispatch("api/get", { type: "resource" });
// will return a single element
this.$store.dispatch("api/get", { type: "resource", id: "my_id" });
```

### `post`

```js
this.$store.dispatch('api/post', { type: 'resource'  data: {...} });
this.$store.dispatch('api/post', { type: 'resource'  data: [{...}] });
```

### `patch`

```js
this.$store.dispatch('api/patch', { id: 'my_id', type: 'resource'  data: {...} });
this.$store.dispatch('api/patch', { type: 'resource'  data: [{...}] });
```

### `delete`

```js
this.$store.dispatch("api/delete", { id: "my_id", type: "resource" });
```

Any of the above action can be queue and process/cancel at a later stage. Here are some helpers to help you with this.

### `queueAction`

```js
this.$store.dispatch("api/queueAction", {
  action: "delete",
  type: "resource",
  data: data
});
```

### `cancelAction`

```js
this.$store.dispatch("api/cancelAction", {
  action: "delete",
  type: "resource",
  data: data
});
```

### `processActionQueue`

```js
this.$store.dispatch("api/processActionQueue", ["resource"]);
this.$store.dispatch("api/processActionQueue", ["resource", "role"]);
```

### `cancelActionQueue`

```js
this.$store.dispatch("api/cancelActionQueue", ["resource"]);
this.$store.dispatch("api/cancelActionQueue", ["resource", "role"]);
```

### `queueActionWatcher` [DEPRECATED]

It can be called in a watcher to set the object to queue.

```js
this.$store.dispatch("api/queueActionWatcher", {
  action: "delete",
  type: "resource",
  data: data
});
```

The store can be emptied with the reset action.

```js
this.$store.dispatch("api/reset");
```

# Contribute

## Project setup

```
yarn install
```

### Compiles and hot-reloads for development

```
yarn run serve
```

### Compiles and minifies for production

```
yarn run build
```

### Run your tests

```
yarn run test
```

### Lints and fixes files

```
yarn run lint
```

### Run your unit tests

```
yarn run test:unit
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
