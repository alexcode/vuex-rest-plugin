import { StoreOptions } from 'vuex';
import Vue from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import set from 'lodash/set';
import Actions from './Actions';
import ApiState from './ApiState';
import {
  ModelTypeTree,
  QueuePayload,
  IndexedObject,
  ModelType,
  Modifier,
  ReferenceTree
} from './types';
import { applyModifier } from './utils';

export default class ApiStore<S> implements StoreOptions<S> {
  namespaced: boolean;
  state: any;
  actions?: Actions<S, S>;
  readonly models: ModelTypeTree;
  readonly getters?: any;
  readonly mutations?: any;
  constructor(models: ModelTypeTree, namespaced: true) {
    this.namespaced = namespaced;
    this.models = models;
    this.state = Object.create(null);
    this.getters = Object.create(null);
    this.mutations = Object.create(null);
    forEach(this.models, (model, modelKey) => {
      const modelIdx = model.plural;
      // adding all states
      this.state[modelIdx] = model.type;
      // adding ADD_* mutations
      this.mutations[`ADD_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        item: IndexedObject | Array<IndexedObject>
      ) =>
        applyModifier('afterGet', modelKey, this.models, item).then(
          (i: any) => {
            this.storeOriginItem(
              get(myState, `${modelIdx}.originItems`),
              i,
              model.beforeQueue
            );
            this.patchEntity(myState, model, i);
            this.linkReferences(i, myState, model.references);
            myState[modelIdx].lastLoad = new Date();
          }
        );
      // adding INIT_* mutations
      this.mutations[`INIT_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        item: IndexedObject
      ) => {
        Vue.set(myState[modelIdx], 'init', item);
      };
      // adding DELETE_* mutations
      this.mutations[`DELETE_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        item: string | Array<IndexedObject>
      ) => {
        const store = myState[modelIdx];
        const deleteItem = (i: string | IndexedObject) => {
          if (isString(i)) {
            Vue.delete(store.originItems, i);
            Vue.delete(store.items, i);
          } else {
            this.removeOriginItem(store.originItems, i);
            Vue.delete(store.items, i.id);
          }
        };

        if (isArray(item)) {
          forEach(item, deleteItem);
        } else {
          deleteItem(item);
        }
      };
      // adding CLEAR_* mutations
      this.mutations[`CLEAR_${model.name.toUpperCase()}`] = (
        myState: ApiState
      ) => myState.reset;
      this.mutations[`QUEUE_ACTION_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        obj: QueuePayload
      ) => {
        const store = myState[modelIdx];
        const storeAction = async (d: IndexedObject) => {
          if (obj.action === 'post') {
            Vue.set(
              store.items,
              d.id,
              await applyModifier('afterGet', modelKey, this.models, d)
            );
            store.actionQueue[obj.action].push(
              await applyModifier('beforeSave', modelKey, this.models, d)
            );
          } else {
            Vue.set(
              store.actionQueue[obj.action],
              d.id,
              await applyModifier('beforeSave', modelKey, this.models, d)
            );
            if (obj.action === 'delete') {
              Vue.delete(store.items, d.id);
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
        myState: ApiState,
        obj: QueuePayload
      ) => {
        const deleteAction = (i: IndexedObject) =>
          Vue.delete(myState[model.plural].actionQueue[obj.action], i.id);
        if (isArray(obj.data)) {
          forEach(obj.data, deleteAction);
        } else {
          deleteAction(obj.data);
        }
      };
      this.mutations[`RESET_QUEUE_${model.name.toUpperCase()}`] = (
        myState: ApiState
      ) => {
        forEach(myState[model.plural].actionQueue, (actionList, action) => {
          myState[model.plural].actionQueue[action] = isArray(actionList)
            ? []
            : {};
        });
      };
      // adding getters
      this.getters[modelIdx.toLowerCase()] = (myState: ApiState) =>
        myState[modelIdx];
      // adding init getters
      this.getters[`${modelIdx.toLowerCase()}_init`] = (myState: ApiState) => {
        return get(myState, `${modelIdx}.init`, Object.create(null));
      };
    });
  }
  // storing Origin item copy
  async storeOriginItem(
    originItems: IndexedObject,
    item: IndexedObject | Array<IndexedObject>,
    modifiers?: Modifier
  ) {
    if (isArray(item)) {
      item.map(async i => {
        const modified = modifiers ? await modifiers(i) : i;
        Vue.set(originItems, i.id, cloneDeep(modified));
      });
    } else {
      const modified = modifiers ? await modifiers(item) : item;
      Vue.set(originItems, item.id, cloneDeep(modified));
    }
  }
  // Removing original copy
  removeOriginItem(originItems: IndexedObject, item: IndexedObject) {
    if (item && has(originItems, item.id)) {
      Vue.delete(originItems, item.id);
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
              Vue.set(store.items[entity.id], idx, get(entity, idx));
            }
          }
        });
      } else {
        store.items = { ...store.items, [entity.id]: entity };
      }

      if (model.references) {
        forEach(model.references, (prop, modelName) => {
          if (has(entity, prop) && get(entity, prop)) {
            try {
              this.patchEntity(state, this.models[modelName], entity[prop]);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn(
                `Patch error: We could not find the model ${modelName} for the reference ${prop}.`
              );
            }
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
    const setLink = (
      data: IndexedObject,
      modelName: string,
      prop?: string | number
    ) => {
      if (prop && isArray(data[prop])) {
        forEach(data[prop], i => setLink(i, modelName));
      } else {
        try {
          const item = prop ? data[prop] : data;
          const itemId = get(item, 'id');
          const model = this.models[modelName];
          const itemStore = state[model.plural];
          if (itemId) {
            this.storeOriginItem(
              itemStore.originItems,
              item,
              model.beforeQueue
            );
            itemStore.items = { ...itemStore.items, [itemId]: item };
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            `Reference error: We could not find the model ${modelName} for the reference ${prop}.`
          );
        }
      }
    };

    forEach(references, (prop, ref) => {
      if (isArray(data)) {
        forEach(data, item => setLink(item, ref, prop));
      } else {
        setLink(data, ref, prop);
      }
    });
  }
}
