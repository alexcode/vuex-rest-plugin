import { ActionContext, Commit, ActionTree, Action, StoreOptions } from 'vuex';
import { AxiosInstance } from 'axios';
import at from 'lodash/at';
import cloneDeep from 'lodash/cloneDeep';
import flatMap from 'lodash/flatMap';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import keys from 'lodash/keys';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import set from 'lodash/set';
import some from 'lodash/some';

// Types
interface IndexedObject {
  id: string;
  [index: string]: any;
}
interface IndexedObjectTree {
  [id: string]: IndexedObject;
}
interface ModelType {
  name: string;
  plural: string;
  type: ApiState;
  references?: ReferenceTree;
  afterGet?: Modifier;
  beforeSave?: Modifier;
  afterSave?: Modifier;
  beforeQueue?: Modifier;
  afterQueue?: Modifier;
}
interface ModelTypeTree {
  [index: string]: ModelType;
}
interface Payload {
  id: string;
  type: string;
  transition?: string;
  url?: string;
  query?: any;
  data?: IndexedObject | Array<IndexedObject>;
  [index: string]: any;
}
interface QueuePayload {
  type: string;
  data: IndexedObject | Array<IndexedObject>;
  action: string;
  [index: string]: any;
}
interface ReferenceTree {
  [index: string]: string;
}
type Modifier = (value: IndexedObject | Array<IndexedObject>) => void;

// Classes
class ActionQueue {
  readonly post: Array<object>;
  readonly patch: object;
  readonly delete: object;
  constructor() {
    this.post = [];
    this.patch = {};
    this.delete = {};
  }
}
class ApiState {
  [key: string]: any;
  items?: IndexedObjectTree;
  lastLoad: Date;
  loaded: boolean;
  originItems: IndexedObject;
  actionQueue: ActionQueue;
  constructor() {
    this.lastLoad = new Date();
    this.loaded = false;
    this.items = Object.create(null);
    this.originItems = Object.create(null);
    this.actionQueue = new ActionQueue();
  }
  public reset(): void {
    this.lastLoad = new Date();
    this.loaded = false;
    this.items = Object.create(null);
    this.originItems = Object.create(null);
    this.actionQueue = new ActionQueue();
  }
}
class DateTimeState extends ApiState {
  from: Date | null;
  to: Date | null;
  constructor() {
    super();
    this.from = null;
    this.to = null;
  }
}
async function applyModifier(
  modifierFnList: any,
  data?: object | Array<object>
) {
  const promises = <any>[];

  if (isArray(modifierFnList)) {
    forEach(modifierFnList, cb => {
      if (!isFunction(cb)) return;

      if (isArray(data)) {
        forEach(data, d => {
          promises.push(cb(d) || d);
        });
      } else {
        promises.push(cb(data) || data);
      }
    });
  } else if (isFunction(modifierFnList)) {
    if (isArray(data)) {
      forEach(data, d => {
        promises.push(modifierFnList(d) || d);
      });
    } else {
      return Promise.resolve(modifierFnList(data) || data);
    }
  } else {
    return Promise.resolve(data);
  }

  return Promise.all(promises);
}
class Actions<S, R> implements ActionTree<S, R> {
  [key: string]: Action<S, R>;
  init: Action<S, R>;
  get: Action<S, R>;
  post: Action<S, R>;
  patch: Action<S, R>;
  delete: Action<S, R>;
  queueActionWatcher: Action<S, R>;
  queueAction: Action<S, R>;
  processActionQueue: Action<S, R>;
  cancelAction: Action<S, R>;
  cancelActionQueue: Action<S, R>;
  constructor(axios: AxiosInstance, models: ModelTypeTree) {
    const _formatUrl = (payload: Payload) => {
      let url = payload.url || payload.type;

      if (!payload.url) {
        if (payload.id) {
          url += `/${payload.id}`;
        }

        if (payload.transition) {
          url += `/${payload.transition}`;
        }
      }

      if (payload.query && isObject(payload.query)) {
        const query = map(payload.query, (value: any, key: string) => {
          let resquestValue = value;
          if (isFunction(value.toISOString) || isDate(value)) {
            resquestValue = new Date(value).toISOString();
          }
          return `${key}=${resquestValue}`;
        });
        payload.query = query.join('&');
      }
      if (payload.query) {
        url += `?${payload.query}`;
      }
      return url;
    };

    const _isAll = (p: Payload) => !has(p, 'id') && isArray(p.data);

    const _getModel = (p: Payload | QueuePayload): ModelType => models[p.type];

    // retrieve entity from Vuex store
    const _getEntity = (state: S | ApiState, payload: Payload) => {
      return get(state, `${_getModel(payload).plural}.items`)[payload.id];
    };

    // fetch entity from API
    const _fetchEntity = (commit: Commit, payload: Payload) => {
      const model = _getModel(payload);
      const { data } = payload;
      if (get(payload, 'clear', _isAll(payload))) {
        commit(`CLEAR_${_getModel(payload).name.toUpperCase()}`);
      }
      return axios.get(_formatUrl(payload)).then(async result => {
        commit(
          `ADD_${_getModel(payload).name.toUpperCase()}`,
          await applyModifier(model.afterGet, result.data)
        );
      });
    };

    // store entity to API
    const _storeEntity = async (
      commit: Commit,
      payload: Payload,
      method: string = 'post'
    ) => {
      const model = _getModel(payload);
      const { data } = payload;
      return axios({
        method,
        url: _formatUrl(payload),
        data: await applyModifier(model.beforeSave, data)
      }).then(async result => {
        commit(
          `ADD_${_getModel(payload).name.toUpperCase()}`,
          await applyModifier(model.afterSave, result.data)
        );
      });
    };

    // delete entity to API
    const _deleteEntity = async (commit: Commit, payload: Payload) => {
      const model = _getModel(payload);
      const { id, data } = payload;

      if (_isAll(payload)) {
        return axios
          .patch(
            `${_formatUrl(payload)}/delete`,
            await applyModifier(model.beforeSave, data)
          )
          .then(() => {
            commit(`DELETE_${model.name.toUpperCase()}`, data);
          });
      }

      return axios.delete(_formatUrl(payload)).then(() => {
        commit(`DELETE_${model.name.toUpperCase()}`, id);
      });
    };

    this.init = (context: ActionContext<S, R>, payload: Payload) => {
      const { commit, state } = context;
      payload.id = 'create';
      return _fetchEntity(commit, payload);
    };

    this.get = async (context: ActionContext<S, R>, payload: Payload) => {
      const { commit, state } = context;
      return _getEntity(state, payload) || _fetchEntity(commit, payload);
    };

    this.post = (context: ActionContext<S, R>, payload: Payload) => {
      const { commit } = context;
      return _storeEntity(commit, payload);
    };

    this.patch = (context: ActionContext<S, R>, payload: Payload) => {
      const { commit } = context;
      return _storeEntity(commit, payload, 'patch');
    };

    this.delete = (context: ActionContext<S, R>, payload: Payload) => {
      const { commit } = context;
      return _deleteEntity(commit, payload);
    };
    // add watched changes to queue
    this.queueActionWatcher = (
      context: ActionContext<S, R>,
      payload: QueuePayload
    ) => {
      const model = _getModel(payload);
      const { commit, state } = context;
      const checkChanged = (i: IndexedObject) =>
        has(get(state, `${model.plural}.originItems`), i.id) &&
        !isEqual(get(state, `${model.plural}.originItems.${i.id}`), i);
      const hasChanged =
        isArray(payload.data) && payload.data
          ? some(payload.data, checkChanged)
          : checkChanged(payload.data);
      if (hasChanged) {
        commit(`QUEUE_ACTION_${model.name}`, payload);
      }
    };

    this.queueAction = (
      context: ActionContext<S, R>,
      payload: QueuePayload
    ) => {
      context.commit(`QUEUE_ACTION_${_getModel(payload).name}`, payload);
    };

    this.processActionQueue = (
      context: ActionContext<S, R>,
      payload: string | Array<string>
    ) => {
      const { commit, state, dispatch } = context;
      const confirmActionType = (queue: string) => {
        const model = models[queue];
        if (get(state, `${model.plural}.hasAction`)) {
          return flatMap(
            get(state, `${model.plural}.actionQueue`),
            (entities: IndexedObjectTree, action: string) =>
              map(entities, e => {
                if (action === 'post') {
                  return dispatch(action, { type: queue, data: e })
                    .then(() => commit(`DELETE_${model.name}`, e))
                    .then(() => commit(`RESET_QUEUE_${model.name}`));
                }
                return dispatch(action, {
                  type: queue,
                  id: e.id,
                  data: e
                }).then(() => commit(`RESET_QUEUE_${model.name}`));
              })
          );
        }
        return Promise.resolve();
      };

      if (isArray(payload)) {
        return Promise.all(flatMap(payload, confirmActionType));
      }
      return confirmActionType(payload);
    };

    this.cancelActionQueue = (
      context: ActionContext<S, R>,
      payload: string | Array<string>
    ) => {
      const { commit, state } = context;
      const cancelActionType = async (queue: string) => {
        const model = models[queue];
        if (get(state, `${model.plural}.hasAction`)) {
          const origin = keys(
            get(state, `${model.plural}.actionQueue.delete`, [])
          ).concat(
            keys(get(state, `${model.plural}.actionQueue.post`, [])),
            keys(get(state, `${model.plural}.actionQueue.patch`, []))
          );
          commit(
            `ADD_${model.name}`,
            await applyModifier(
              model.afterQueue,
              at(get(state, `${model.plural}.originItems`), origin)
            )
          );
          commit(`RESET_QUEUE_${model.name}`);
        }
      };

      if (isArray(payload)) {
        forEach(payload, cancelActionType);
      } else {
        cancelActionType(payload);
      }
    };

    this.cancelAction = (
      context: ActionContext<S, R>,
      payload: QueuePayload
    ) => {
      const model = _getModel(payload);
      const { commit, state } = context;
      // if (get(state, `${model.plural}.hasAction`)) {
      commit(`UNQUEUE_ACTION_${model.name}`, payload);
      // }
    };
  }
}
class ApiStore<S> implements StoreOptions<S> {
  state: any;
  actions?: Actions<S, S>;
  readonly models: ModelTypeTree;
  readonly getters?: any;
  readonly mutations?: any;
  constructor(models: ModelTypeTree) {
    this.models = models;
    this.state = Object.create(null);
    this.getters = Object.create(null);
    this.mutations = Object.create(null);
    forEach(this.models, model => {
      const modelIdx = model.plural;
      // adding all states
      this.state[modelIdx] = model.type;
      // adding ADD_* mutations
      this.mutations[`ADD_${model.name.toUpperCase()}`] = (
        state: S,
        item: IndexedObject | Array<IndexedObject>
      ) => {
        this.storeOriginItem(
          get(state, `${modelIdx}.originItems`),
          item,
          model.beforeQueue
        );
        this.patchEntity(state, model, item);
        this.linkReferences(item, state, model.references);
        return item;
      };
      // adding INIT_* mutations
      this.mutations[`INIT_${model.name.toUpperCase()}`] = (
        state: ApiState,
        item: IndexedObject
      ) => {
        set(state[modelIdx], 'init', item);
      };
      // adding DELETE_* mutations
      this.mutations[`DELETE_${model.name.toUpperCase()}`] = (
        state: ApiState,
        item: string | Array<IndexedObject>
      ) => {
        const store = state[modelIdx];
        const deleteItem = (i: string | IndexedObject) => {
          if (isString(i)) {
            delete store.originItems[i];
            delete store.items[i];
          } else {
            this.removeOriginItem(store.originItems, i);
            delete store.items[i.id];
          }
        };

        if (isArray(item)) {
          forEach(item, deleteItem);
        } else {
          deleteItem(item);
        }
      };
      // adding CLEAR_* mutations
      this.mutations[`CLEAR_${model.name.toUpperCase()}`] = (state: ApiState) =>
        state.reset;
      this.mutations[`QUEUE_ACTION_${model.name.toUpperCase()}`] = (
        state: ApiState,
        obj: QueuePayload
      ) => {
        const store = state[modelIdx];
        const storeAction = async (d: IndexedObject) => {
          if (obj.action === 'post') {
            set(store.items, d.id, await applyModifier(model.afterSave, d));
            store.actionQueue[obj.action].push(
              await applyModifier(model.beforeSave, d)
            );
          } else {
            set(
              store.actionQueue[obj.action],
              d.id,
              await applyModifier(model.beforeSave, d)
            );
            if (obj.action === 'delete') {
              delete store.items[d.id];
            }
          }
        };

        if (has(store.actionQueue, obj.action)) {
          if (isArray(obj.data)) {
            forEach(obj.data, storeAction);
          } else {
            storeAction(obj.data);
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(`action ${obj.action} is not storable`);
        }
      };
      this.mutations[`UNQUEUE_ACTION_${model.name.toUpperCase()}`] = (
        state: ApiState,
        obj: QueuePayload
      ) => {
        const deleteAction = (i: IndexedObject) =>
          delete state[model.plural].actionQueue[obj.action][i.id];
        if (isArray(obj.data)) {
          forEach(obj.data, deleteAction);
        } else {
          deleteAction(obj.data);
        }
      };
      this.mutations[`RESET_QUEUE_${model.name.toUpperCase()}`] = (
        state: ApiState
      ) => {
        forEach(state[model.plural].actionQueue, (actionList, action) => {
          state[model.plural].actionQueue[action] = isArray(actionList)
            ? []
            : {};
        });
      };
      // adding getters
      this.getters[modelIdx.toLowerCase()] = (state: ApiState) => {
        const s = get(state, modelIdx);
        s.hasAction = some(s.actionQueue, a => !isEmpty(a));
        return s;
      };
      // adding init getters
      this.getters[`${modelIdx.toLowerCase()}_init`] = (state: ApiState) => {
        return get(state, `${modelIdx}.init`, Object.create(null));
      };
    });
  }
  private async applyToArrayObject(
    data: IndexedObject | Array<IndexedObject>,
    fun: (value: IndexedObject) => any
  ) {
    return isArray(data) ? data.map(await fun) : await fun(data);
  }
  // storing Origin item copy
  async storeOriginItem(
    originItems: IndexedObject,
    item: IndexedObject | Array<IndexedObject>,
    modifiers?: Modifier
  ) {
    const data: IndexedObject | Array<IndexedObject> = modifiers
      ? await this.applyToArrayObject(item, modifiers)
      : item;

    this.applyToArrayObject(data, (d: IndexedObject) => {
      originItems[d.id] = cloneDeep(d);
    });
  }
  // Removing original copy
  removeOriginItem(originItems: IndexedObject, item: IndexedObject) {
    if (item && has(originItems, item.id)) {
      delete originItems[item.id];
    }
  }
  patchEntity(
    state: any,
    model: ModelType,
    entity: IndexedObject | Array<IndexedObject>
  ) {
    if (isArray(entity)) {
      forEach(entity, e => this.patchEntity(state, model, e));
    } else if (entity.id) {
      const store = state[model.plural];
      if (has(store.items, entity.id)) {
        forEach(store.items[entity.id], (value, idx: string) => {
          if (!isFunction(value)) {
            if (has(entity, idx) && !isEqual(value, get(entity, idx))) {
              set(store.items[entity.id], idx, get(entity, idx));
            }
          }
        });
      } else {
        set(store.items, entity.id, entity);
      }

      if (model.references) {
        forEach(model.references, (modelName, prop) => {
          if (has(entity, prop) && get(entity, prop)) {
            this.patchEntity(state, this.models[modelName], get(entity, prop));
          }
        });
      }
    }
  }
  // Replace objects by it's reference
  linkReferences(
    data: IndexedObject | Array<IndexedObject>,
    state: any,
    references?: ReferenceTree
  ) {
    const setLink = (item: IndexedObject, value: any, key: string | number) => {
      const itemId = get(item[key], 'id');
      const itemStore = state[this.models[value].plural];
      if (itemId) {
        this.storeOriginItem(
          itemStore.originItems,
          get(item, key),
          itemStore.beforeQueue
        );
        itemStore.items[itemId] = item[key];
      }
      const recurRef = get(state, `${this.models[value].plural}.references`);
      if (recurRef) {
        this.linkReferences(item, state, recurRef);
      }
    };

    forEach(references, (value, key) => {
      if (isArray(data)) {
        forEach(data, item => setLink(item, key, value));
      } else {
        setLink(data, value, key);
      }
    });
  }
}

// Plugin
const ApiStorePlugin = (options: any) => {
  const apiStore = new ApiStore(options.models);
  apiStore.actions = new Actions(options.axios, options.models);

  return (store: any) => store.registerModule(options.name || 'api', apiStore);
};

export { ApiStorePlugin, ApiState, DateTimeState };
