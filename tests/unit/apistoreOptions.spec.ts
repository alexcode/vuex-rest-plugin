import Vue from "vue";
import Vuex from "vuex";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";
import flushPromises from "flush-promises";
import ApiStorePlugin from "../../lib/ApiStorePlugin";
import ApiState from "../../lib/ApiState";

Vue.use(Vuex);
Vue.config.devtools = false;
Vue.config.productionTip = false;

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("ApiStore options", function() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const data = require("./apistore.spec.data.json");
  const models = {
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
  };
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);
  afterEach(() => {
    mock.reset();
  });

  it("test without namespaced", async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models,
          namespaced: false
        })
      ]
    });
    expect(store.getters.resources).not.toBeUndefined();
  });

  it("test dataPath", async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models,
          dataPath: "test"
        })
      ]
    });
    const resource = data[0];
    mock.onGet(`/resource/${resource.id}`).reply(200, { test: resource });
    store.dispatch("api/get", {
      id: resource.id,
      type: "resource",
      clear: true
    });
    await flushPromises();
    const storeResource = store.getters["api/resources"].items[resource.id];
    expect(storeResource).toMatchObject(resource);
  });

  it("test interceptor config", async () => {
    await flushPromises();
    const customInstance = axios.create();
    const customConfig = "custom_stuff";
    let interceptorValue = undefined;
    customInstance.interceptors.request.use((config: any) => {
      interceptorValue = config.customConfig;
      return config;
    });
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: customInstance,
          models: {
            resource: {
              name: "RESOURCE",
              plural: "RESOURCES",
              type: new ApiState()
            }
          }
        })
      ]
    });
    mock.onGet(`/resource/${data[0].id}`).reply(200, data[0]);
    store.dispatch("api/get", {
      id: data[0].id,
      type: "resource",
      axiosConfig: { customConfig }
    });
    await flushPromises();
    expect(interceptorValue).toBe(customConfig);
  });
});
