import Vue from 'vue';
import Vuex from 'vuex';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import flushPromises from 'flush-promises';
import size from 'lodash/size';
import forEach from 'lodash/forEach';
import { ApiStorePlugin, ApiState } from '../../lib';

const data = require('./apistore.spec.data.json');
Vue.use(Vuex);

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

describe('ApiStore', () => {
  let store: any;
  const axiosInstance = axios.create();
  const mock = new MockAdapter(axiosInstance);
  const fillStore = async () => {
    mock.onGet('/resource/all').reply(200, data);
    store.dispatch('get', {
      id: 'all',
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
          create: [],
          delete: {},
          save: {}
        },
        items: {},
        lastLoad: expect.any(Date),
        loaded: false,
        originItems: {}
      });
    });
  });
  it('test get Action (GET)', async () => {
    mock.onGet('/resource/all').reply(200, data);
    store.dispatch('get', {
      id: 'all',
      type: 'resource'
    });
    await flushPromises();
    forEach(data, resource => {
      const storeResource = store.getters.resources.items[resource.id];
      const storeUser = store.getters.users.items[resource.user.id];
      const storeVehicle = store.getters.vehicles.items[resource.vehicle.id];
      const storeRole = store.getters.roles.items[resource.user.role.id];
      expect(storeResource).toMatchObject(resource);
      expect(storeUser).toMatchObject(resource.user);
      expect(storeVehicle).toMatchObject(resource.vehicle);
      expect(storeRole).toMatchObject(resource.user.role);
    });
  });
  it('test get Action (GET) single object', async () => {
    const singleResource = data[0];
    mock.onGet(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('get', {
      id: singleResource.id,
      type: 'resource',
      clear: true
    });
    await flushPromises();
    const storeResource = store.getters.resources.items[singleResource.id];
    const storeUser = store.getters.users.items[singleResource.user.id];
    const storeVehicle =
      store.getters.vehicles.items[singleResource.vehicle.id];
    const storeRole = store.getters.roles.items[singleResource.user.role.id];
    expect(storeResource).toMatchObject(singleResource);
    expect(storeUser).toMatchObject(singleResource.user);
    expect(storeVehicle).toMatchObject(singleResource.vehicle);
    expect(storeRole).toMatchObject(singleResource.user.role);
  });

  it('test if references are proper ref', async () => {
    mock.onGet('/resource/all').reply(200, data);
    store.dispatch('get', {
      id: 'all',
      type: 'resource'
    });
    await flushPromises();
    forEach(data, resource => {
      const storeResource = store.getters.resources.items[resource.id];
      const storeUser = store.getters.users.items[resource.user.id];
      const storeVehicle = store.getters.vehicles.items[resource.vehicle.id];
      const storeRole = store.getters.roles.items[resource.user.role.id];
      expect(storeUser).toStrictEqual(storeResource.user);
      expect(storeVehicle).toStrictEqual(storeResource.vehicle);
      expect(storeRole).toStrictEqual(storeResource.user.role);
    });
  });

  it('test create Action (POST)', async () => {
    const singleResource = data[0];
    mock.onPost(`/resource`).reply(200, singleResource);
    store.dispatch('create', {
      type: 'resource',
      data: singleResource
    });
    await flushPromises();
    expect(
      store.getters.resources.items[singleResource.id]
    ).not.toBeUndefined();
  });

  it('test save Action (POST)', async () => {
    const singleResource = data[0];
    mock.onPost(`/resource`).reply(200, singleResource);
    store.dispatch('save', {
      type: 'resource',
      data: singleResource
    });
    await flushPromises();
    expect(
      store.getters.resources.items[singleResource.id]
    ).not.toBeUndefined();
  });

  it('test save Action (PATCH)', async () => {
    const singleResource = { ...data[0], name: 'test' };
    mock.onPatch(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('save', {
      id: singleResource.id,
      type: 'resource',
      data: singleResource
    });
    await flushPromises();
    expect(store.getters.resources.items[singleResource.id].name).not.toEqual(
      data[0].name
    );
  });

  it('test delete Action (DELETE)', async () => {
    const singleResource = data[0];
    await fillStore();
    mock.onDelete(`/resource/${singleResource.id}`).reply(200);
    store.dispatch('delete', {
      id: singleResource.id,
      type: 'resource'
    });
    await flushPromises();
    expect(store.getters.resources.items[singleResource.id]).toBeUndefined();
  });

  it('test delete Action (PATCH)', async () => {
    const toDelete = [data[0], data[1]];
    await fillStore();
    mock.onPatch(`/resource/all/delete`).reply(200);
    store.dispatch('delete', {
      id: 'all',
      type: 'resource',
      data: toDelete
    });
    await flushPromises();
    expect(store.getters.resources.items[toDelete[0].id]).toBeUndefined();
    expect(store.getters.resources.items[toDelete[1].id]).toBeUndefined();
  });

  it('test queueAction', async () => {
    store.dispatch('queueAction', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    store.dispatch('queueAction', {
      action: 'delete',
      type: 'resource',
      data: data[1]
    });
    store.dispatch('queueAction', {
      action: 'create',
      type: 'resource',
      data: data[2]
    });
    await flushPromises();
    expect(store.getters.resources.actionQueue.save[data[0].id]).toMatchObject(
      data[0]
    );
    expect(
      store.getters.resources.actionQueue.delete[data[1].id]
    ).toMatchObject(data[1]);
    expect(store.getters.resources.actionQueue.create[0]).toMatchObject(
      data[2]
    );
  });

  it('test processActionQueue', async () => {
    store.dispatch('queueAction', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    mock.onPost(`/resource`).reply(200, data[0]);
    store.dispatch('processActionQueue', ['resource']);
    await flushPromises();
    expect(store.getters.resources.actionQueue.save[data[0].id]).toMatchObject(
      data[0]
    );
  });

  it('test cancelActionQueue', async () => {
    store.dispatch('queueAction', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    mock.onPost(`/resource`).reply(200, data[0]);
    store.dispatch('cancelActionQueue', ['resource']);
    await flushPromises();
    expect(
      store.getters.resources.actionQueue.save[data[0].id]
    ).toBeUndefined();
  });

  it('test cancelAction', async () => {
    store.dispatch('queueAction', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    await flushPromises();
    store.dispatch('cancelAction', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    await flushPromises();
    expect(
      store.getters.resources.actionQueue.save[data[0].id]
    ).toBeUndefined();
  });

  it('test queueActionWatcher', async () => {
    await fillStore();
    store.dispatch('queueActionWatcher', {
      action: 'save',
      type: 'resource',
      data: data[0]
    });
    store.dispatch('queueActionWatcher', {
      action: 'save',
      type: 'resource',
      data: { ...data[1], name: 'test' }
    });
    await flushPromises();
    expect(
      store.getters.resources.actionQueue.save[data[0].id]
    ).toBeUndefined();
    expect(
      store.getters.resources.actionQueue.save[data[1].id]
    ).not.toBeUndefined();
  });
});
