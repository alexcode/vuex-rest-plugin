import Vue from 'vue';
import Vuex from 'vuex';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import flushPromises from 'flush-promises';
import ApiStorePlugin from '../../lib/ApiStorePlugin';
import ApiState from '../../lib/ApiState';

declare var global: any;

Vue.use(Vuex);

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
                user: 'fakeref',
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
    console.info('Start expected log');
    await flushPromises();
    expect(spyWarn).toHaveBeenCalledWith(
      'Patch error: We could not find the model fakeref for the reference user.'
    );
    expect(spyWarn).toHaveBeenCalledWith(
      'Reference error: We could not find the model fakeref for the reference user.'
    );
    console.info('End expected log');
  });

  it('test reference', async () => {
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
                depot: 'place'
              }
            },
            place: {
              name: 'PLACE',
              plural: 'PLACES',
              type: new ApiState()
            }
          }
        })
      ]
    });
    const resource = data[0];
    store.commit('api/ADD_RESOURCE', resource);
    await flushPromises();
    expect(
      store.getters['api/places'].items[resource.depot[0].id]
    ).toStrictEqual(resource.depot[0]);
    expect(
      store.getters['api/places'].originItems[resource.depot[0].id]
    ).toStrictEqual(resource.depot[0]);
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
                vehicle: 'vehicle',
                depot: 'place'
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
            },
            place: {
              name: 'PLACE',
              plural: 'PLACES',
              type: new ApiState()
            }
          }
        })
      ]
    });
    const resource = data[0];
    store.commit('api/ADD_RESOURCE', resource);
    await flushPromises();
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
    expect(
      store.getters['api/places'].items[resource.depot[0].id]
    ).toStrictEqual(resource.depot[0]);
  });

  it('test hooks with collection', async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models: {
            resource: {
              name: 'RESOURCE',
              plural: 'RESOURCES',
              type: new ApiState(),
              afterGet: (v: any) => {
                v.some_id = 'other_id_resource';
                return v;
              },
              references: {
                user: 'user'
              }
            },
            user: {
              name: 'USER',
              plural: 'USERS',
              type: new ApiState(),
              afterGet: (v: any) => {
                v.some_id = 'other_id_user';
                return v;
              }
            }
          }
        })
      ]
    });
    const resource = data[0];
    mock.onGet('/resource').reply(200, [resource]);
    store.dispatch('api/get', {
      type: 'resource'
    });
    await flushPromises();
    expect(store.getters['api/resources'].items[resource.id].some_id).toBe(
      'other_id_resource'
    );
    expect(store.getters['api/users'].items[resource.user.id].some_id).toBe(
      'other_id_user'
    );
  });

  it('test hooks with single object', async () => {
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models: {
            resource: {
              name: 'RESOURCE',
              plural: 'RESOURCES',
              type: new ApiState(),
              afterGet: (v: any) => {
                return {
                  id: v.id,
                  user: v.user,
                  some_id: 'other_id_resource'
                };
              },
              references: {
                user: 'user'
              }
            },
            user: {
              name: 'USER',
              plural: 'USERS',
              type: new ApiState(),
              afterGet: (v: any) => {
                return {
                  id: v.id,
                  some_id: 'other_id_user'
                };
              }
            }
          }
        })
      ]
    });
    const singleResource = data[0];
    mock.onGet(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('api/get', {
      id: singleResource.id,
      type: 'resource'
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[singleResource.id].some_id
    ).toBe('other_id_resource');
    expect(store.getters['api/users'].items[singleResource.user.id]).toEqual({
      id: singleResource.user.id,
      some_id: 'other_id_user'
    });
  });

  it('test hooks with class', async () => {
    class Resource {
      id: string;
      user: User;
      some_id: string;
      constructor(o: any) {
        this.id = o.id;
        this.user = o.user;
        this.some_id = 'other_id_resource';
      }
    }
    class User {
      id: string;
      config: object;
      email: string;
      first_name: string;
      last_name: string;
      name: string;
      role: object;
      tools?: object;
      some_id: string;
      constructor(o: any) {
        this.id = o.id;
        this.config = o.config;
        this.email = o.email;
        this.first_name = o.first_name;
        this.last_name = o.last_name;
        this.name = o.name;
        this.role = o.role;
        this.tools = o.tools;
        this.some_id = 'other_id_user';
      }
    }
    const store = new Vuex.Store({
      plugins: [
        ApiStorePlugin({
          axios: axiosInstance,
          models: {
            resource: {
              name: 'RESOURCE',
              plural: 'RESOURCES',
              type: new ApiState(),
              afterGet: (v: any) => {
                return new Resource(v);
              },
              references: {
                user: 'user'
              }
            },
            user: {
              name: 'USER',
              plural: 'USERS',
              type: new ApiState(),
              afterGet: (v: any) => {
                return new User(v);
              }
            }
          }
        })
      ]
    });
    const singleResource = data[0];
    mock.onGet(`/resource/${singleResource.id}`).reply(200, singleResource);
    store.dispatch('api/get', {
      id: singleResource.id,
      type: 'resource'
    });
    await flushPromises();
    expect(
      store.getters['api/resources'].items[singleResource.id]
    ).toBeInstanceOf(Resource);
    expect(
      store.getters['api/users'].items[singleResource.user.id]
    ).toBeInstanceOf(User);
    expect(
      store.getters['api/users'].items[singleResource.user.id].some_id
    ).toBe('other_id_user');
    expect(
      store.getters['api/resources'].items[singleResource.id].user
    ).toBeInstanceOf(User);
  });
});
