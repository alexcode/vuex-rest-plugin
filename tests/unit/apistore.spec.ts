import Vue from 'vue';
import Vuex from 'vuex';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import flushPromises from 'flush-promises';
import size from 'lodash/size';
import forEach from 'lodash/forEach';
import { ApiStorePlugin, ApiState } from '../../lib';

declare var global: any;

Vue.use(Vuex);

describe('ApiStore by default', function() {
  const data = require('./apistore.spec.data.json');
  const models = {
    resource: {
      name: 'RESOURCE',
      plural: 'RESOURCES',
      type: new ApiState(),
      references: {
        user: 'user',
        vehicle: 'vehicle'
      }
    },
    user: {
      name: 'USER',
      plural: 'USERS',
      type: new ApiState(),
      references: {
        role: 'role'
      }
    },
    vehicle: {
      name: 'VEHICLE',
      plural: 'VEHICLES',
      type: new ApiState()
    },
    role: {
      name: 'ROLE',
      plural: 'ROLES',
      type: new ApiState()
    }
  };
  let store: any;
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);
  const fillStore = async () => {
    mock.onGet('/resource').reply(200, data);
    store.dispatch('api/get', {
      type: 'resource'
    });
    await flushPromises();
  };
  beforeAll(() => {
    store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models
        })
      ]
    });
  });
  beforeEach(() => {
    forEach(store.state.api, state => state.reset());
  });
  afterEach(() => {
    mock.reset();
  });

  it('test api module state', () => {
    expect(size(store.state.api)).toBe(size(models));
    forEach(store.state.api, (state: ApiState) => {
      expect(state).toEqual({
        actionQueue: {
          post: [],
          delete: {},
          patch: {}
        },
        items: {},
        lastLoad: expect.any(Date),
        loaded: false,
        originItems: {}
      });
    });
  });
  it('test get Action (GET)', async () => {
    mock.onGet('/resource').reply(200, data);
    store.dispatch('api/get', {
      type: 'resource'
    });
    await flushPromises();
    forEach(data, resource => {
      const storeResource = store.getters['api/resources'].items[resource.id];
      const storeUser = store.getters['api/users'].items[resource.user.id];
      const storeVehicle =
        store.getters['api/vehicles'].items[resource.vehicle.id];
      const storeRole = store.getters['api/roles'].items[resource.user.role.id];
      expect(storeResource).toMatchObject(resource);
      expect(storeUser).toMatchObject(resource.user);
      expect(storeVehicle).toMatchObject(resource.vehicle);
      expect(storeRole).toMatchObject(resource.user.role);
    });
  });
  it('test get Action (GET) single object', async () => {
    const singleResource = data[0];
    mock.onGet(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('api/get', {
      id: singleResource.id,
      type: 'resource',
      clear: true
    });
    await flushPromises();
    const storeResource =
      store.getters['api/resources'].items[singleResource.id];
    const storeUser = store.getters['api/users'].items[singleResource.user.id];
    const storeVehicle =
      store.getters['api/vehicles'].items[singleResource.vehicle.id];
    const storeRole =
      store.getters['api/roles'].items[singleResource.user.role.id];
    expect(storeResource).toMatchObject(singleResource);
    expect(storeUser).toMatchObject(singleResource.user);
    expect(storeVehicle).toMatchObject(singleResource.vehicle);
    expect(storeRole).toMatchObject(singleResource.user.role);
  });

  it('test if references are proper ref', async () => {
    mock.onGet('/resource').reply(200, data);
    store.dispatch('api/get', {
      type: 'resource'
    });
    await flushPromises();
    forEach(data, resource => {
      const storeResource = store.getters['api/resources'].items[resource.id];
      const storeUser = store.getters['api/users'].items[resource.user.id];
      const storeVehicle =
        store.getters['api/vehicles'].items[resource.vehicle.id];
      const storeRole = store.getters['api/roles'].items[resource.user.role.id];
      expect(storeUser).toStrictEqual(storeResource.user);
      expect(storeVehicle).toStrictEqual(storeResource.vehicle);
      expect(storeRole).toStrictEqual(storeResource.user.role);
    });
  });

  it('test post Action', async () => {
    const singleResource = data[0];
    mock.onPost(`/resource`).reply(200, singleResource);
    store.dispatch('api/post', {
      type: 'resource',
      data: singleResource
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[singleResource.id]
    ).not.toBeUndefined();
  });

  it('test patch Action', async () => {
    const singleResource = { ...data[0], name: 'test' };
    mock.onPatch(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('api/patch', {
      id: singleResource.id,
      type: 'resource',
      data: singleResource
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[singleResource.id].name
    ).not.toEqual(data[0].name);
  });

  it('test patch Action batch', async () => {
    const resources = [
      { ...data[0], name: 'test' },
      { ...data[1], name: 'test2' }
    ];
    mock.onPatch(`/resource`).reply(200, resources);
    store.dispatch('api/patch', {
      type: 'resource',
      data: resources
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[resources[0].id].name
    ).not.toEqual(data[0].name);
    expect(
      store.getters['api/resources'].items[resources[1].id].name
    ).not.toEqual(data[1].name);
  });

  it('test delete Action (DELETE)', async () => {
    const singleResource = data[0];
    await fillStore();
    mock.onDelete(`/resource/${singleResource.id}`).reply(200);
    store.dispatch('api/delete', {
      id: singleResource.id,
      type: 'resource'
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[singleResource.id]
    ).toBeUndefined();
  });

  it('test delete Action (PATCH)', async () => {
    const toDelete = [data[0], data[1]];
    await fillStore();
    mock.onPatch(`/resource/delete`).reply(200);
    store.dispatch('api/delete', {
      type: 'resource',
      data: toDelete
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[toDelete[0].id]
    ).toBeUndefined();
    expect(
      store.getters['api/resources'].items[toDelete[1].id]
    ).toBeUndefined();
  });

  it('test queueAction', async () => {
    store.dispatch('api/queueAction', {
      action: 'post',
      type: 'resource',
      data: data[0]
    });
    store.dispatch('api/queueAction', {
      action: 'delete',
      type: 'resource',
      data: data[1]
    });
    store.dispatch('api/queueAction', {
      action: 'patch',
      type: 'resource',
      data: data[2]
    });
    await flushPromises();
    expect(store.getters['api/resources'].actionQueue.post[0]).toMatchObject(
      data[0]
    );
    expect(
      store.getters['api/resources'].actionQueue.delete[data[1].id]
    ).toMatchObject(data[1]);
    expect(
      store.getters['api/resources'].actionQueue.patch[data[2].id]
    ).toMatchObject(data[2]);
  });

  it('test processActionQueue', async () => {
    store.dispatch('api/queueAction', {
      action: 'patch',
      type: 'resource',
      data: data[0]
    });
    mock.onPost(`/resource`).reply(200, data[0]);
    store.dispatch('api/processActionQueue', ['resource']);
    await flushPromises();
    expect(
      store.getters['api/resources'].actionQueue.patch[data[0].id]
    ).toMatchObject(data[0]);
  });

  it('test cancelActionQueue', async () => {
    store.dispatch('api/queueAction', {
      action: 'patch',
      type: 'resource',
      data: data[0]
    });
    mock.onPost(`/resource`).reply(200, data[0]);
    store.dispatch('api/cancelActionQueue', ['resource']);
    await flushPromises();
    expect(
      store.getters['api/resources'].actionQueue.patch[data[0].id]
    ).toBeUndefined();
  });

  it('test cancelAction', async () => {
    store.dispatch('api/queueAction', {
      action: 'patch',
      type: 'resource',
      data: data[0]
    });
    await flushPromises();
    store.dispatch('api/cancelAction', {
      action: 'patch',
      type: 'resource',
      data: data[0]
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].actionQueue.patch[data[0].id]
    ).toBeUndefined();
  });

  it('test queueActionWatcher', async () => {
    await fillStore();
    store.dispatch('api/queueActionWatcher', {
      action: 'patch',
      type: 'resource',
      data: data[0]
    });
    store.dispatch('api/queueActionWatcher', {
      action: 'patch',
      type: 'resource',
      data: { ...data[1], name: 'test' }
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].actionQueue.patch[data[0].id]
    ).toBeUndefined();
    expect(
      store.getters['api/resources'].actionQueue.patch[data[1].id]
    ).not.toBeUndefined();
  });
});

describe('ApiStore options', function() {
  const data = require('./apistore.spec.data.json');
  const models = {
    resource: {
      name: 'RESOURCE',
      plural: 'RESOURCES',
      type: new ApiState(),
      references: {
        user: 'user',
        vehicle: 'vehicle'
      }
    },
    user: {
      name: 'USER',
      plural: 'USERS',
      type: new ApiState(),
      references: {
        role: 'role'
      }
    },
    vehicle: {
      name: 'VEHICLE',
      plural: 'VEHICLES',
      type: new ApiState()
    },
    role: {
      name: 'ROLE',
      plural: 'ROLES',
      type: new ApiState()
    }
  };
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);
  afterEach(() => {
    mock.reset();
  });

  it('test without namespaced', async () => {
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

  it('test dataPath', async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models,
          dataPath: 'test'
        })
      ]
    });
    const resource = data[0];
    mock.onGet(`/resource/${resource.id}`).reply(200, { test: resource });
    store.dispatch('api/get', {
      id: resource.id,
      type: 'resource',
      clear: true
    });
    await flushPromises();
    const storeResource = store.getters['api/resources'].items[resource.id];
    expect(storeResource).toMatchObject(resource);
  });
});

describe('ApiStore custom model', function() {
  const data = require('./apistore.spec.data.json');
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);
  afterEach(() => {
    mock.reset();
  });

  it('test wrong reference', async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models: {
            resource: {
              name: 'RESOURCE',
              plural: 'RESOURCES',
              type: new ApiState(),
              references: {
                user: 'users',
                vehicle: 'vehicle'
              }
            },
            user: {
              name: 'USER',
              plural: 'USERS',
              type: new ApiState()
            },
            vehicle: {
              name: 'VEHICLE',
              plural: 'VEHICLES',
              type: new ApiState(),
              references: {
                user: 'user'
              }
            }
          }
        })
      ]
    });
    const resource = data[0];
    mock.onGet(`/resource/${resource.id}`).reply(200, resource);
    const spyWarn = jest.spyOn(global.console, 'warn');
    try {
    } catch (e) {}
    store.dispatch('api/get', {
      id: resource.id,
      type: 'resource',
      clear: true
    });
    await flushPromises();
    expect(spyWarn).toHaveBeenCalledWith(
      'Patch error: We could not find the model users for the reference user.'
    );
    expect(spyWarn).toHaveBeenCalledWith(
      'Reference error: We could not find the model users for the reference user.'
    );
  });

  it('test nested reference', async () => {
    await flushPromises();
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models: {
            resource: {
              name: 'RESOURCE',
              plural: 'RESOURCES',
              type: new ApiState(),
              references: {
                user: 'user',
                vehicle: 'vehicle'
              }
            },
            user: {
              name: 'USER',
              plural: 'USERS',
              type: new ApiState(),
              references: {
                role: 'role'
              }
            },
            vehicle: {
              name: 'VEHICLE',
              plural: 'VEHICLES',
              type: new ApiState(),
              references: {
                user: 'user'
              }
            },
            role: {
              name: 'ROLE',
              plural: 'ROLES',
              type: new ApiState()
            }
          }
        })
      ]
    });
    const resource = data[0];
    store.commit('api/ADD_RESOURCE', resource);
    expect(resource).toStrictEqual(
      store.getters['api/resources'].items[resource.id]
    );
    expect(resource.user).toStrictEqual(
      store.getters['api/users'].items[resource.user.id]
    );
    expect(resource.vehicle.user).toStrictEqual(
      store.getters['api/users'].items[resource.vehicle.user.id]
    );
    expect(resource.vehicle.user.role).toStrictEqual(
      store.getters['api/roles'].items[resource.vehicle.user.role.id]
    );
  });
});
