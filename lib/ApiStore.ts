import { StoreOptions } from "vuex";
import Vue from "vue";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";
import has from "lodash-es/has";
import isArray from "lodash-es/isArray";
import isEqual from "lodash-es/isEqual";
import isFunction from "lodash-es/isFunction";
import isString from "lodash-es/isString";
import Actions from "./Actions";
import ApiState from "./ApiState";
import {
  ModelTypeTree,
  QueuePayload,
  QueuePayloadWithModifiers,
  IndexedObject,
  IndexedObjectTree,
  ModelType
} from "./types";

interface StateTree {
  [index: string]: ApiState;
}

export default class ApiStore<S> implements StoreOptions<S> {
  namespaced: boolean;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  state: any;
  actions?: Actions<S, S>;
  readonly models: ModelTypeTree;
  readonly getters?: any;
  readonly mutations?: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  constructor(models: ModelTypeTree, namespaced = true) {
    this.namespaced = namespaced;
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
        myState: StateTree,
        item: IndexedObject | Array<IndexedObject>
      ) => {
        myState[modelIdx].lastLoad = new Date();
        this.upsertData(myState, model, item);
      };

      this.mutations[`SAVE_ORIGIN_${model.name.toUpperCase()}`] = (
        myState: StateTree,
        item: IndexedObject | Array<IndexedObject>
      ) => {
        this.saveOrigins(myState, model, item);
      };

      // adding DELETE_* mutations
      this.mutations[`DELETE_${model.name.toUpperCase()}`] = (
        myState: StateTree,
        item: string | Array<IndexedObject>
      ) => {
        const state = myState[modelIdx];
        const deleteItem = (i: string | IndexedObject) => {
          if (isString(i)) {
            Vue.delete(state.originItems, i);
            Vue.delete(state.items, i);
          } else {
            this.removeOriginItem(state.originItems, i);
            Vue.delete(state.items, i.id);
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
        myState: StateTree
      ) => myState[modelIdx].reset();

      this.mutations[`QUEUE_ACTION_${model.name.toUpperCase()}`] = (
        myState: StateTree,
        { id, action, afterGet, toQueue }: QueuePayloadWithModifiers
      ) => {
        const state = myState[modelIdx];

        if (has(state.actionQueue, action)) {
          if (action === "post") {
            Vue.set(state.items, id, afterGet);
            state.actionQueue[action].push(toQueue);
          } else {
            if (action === "delete") {
              Vue.delete(state.items, id);
            }
            Vue.set(state.actionQueue[action], id, toQueue);
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(`action ${action} is not storable`);
        }
      };

      this.mutations[`UNQUEUE_ACTION_${model.name.toUpperCase()}`] = (
        myState: StateTree,
        payload: QueuePayload
      ) => {
        const state = myState[model.plural];
        const id = payload.id || payload.data.id;
        if (payload.action === "patch") {
          this.revertOriginItem(state, id);
        }
        Vue.delete(state.actionQueue[payload.action], id);
      };

      this.mutations[`RESET_QUEUE_${model.name.toUpperCase()}`] = (
        myState: StateTree
      ) => {
        const state = myState[model.plural];
        forEach(state.actionQueue, (actionList, action) => {
          if (action === "patch") {
            forEach(actionList, (item, id) => this.revertOriginItem(state, id));
          }

          state.actionQueue[action] = isArray(actionList) ? [] : {};
        });
      };

      // adding getters
      this.getters[modelIdx.toLowerCase()] = (myState: ApiState) =>
        myState[modelIdx];
    });
  }

  // Removing original copy
  private getIndexedMap(data: IndexedObject | Array<IndexedObject>) {
    const indexMap: IndexedObjectTree = {};
    if (isArray(data)) {
      return data.reduce((acc, entity) => {
        acc[entity.id] = entity;
        return acc;
      }, indexMap);
    } else {
      indexMap[data.id] = data;
      return indexMap;
    }
  }

  // Save original copy
  private saveOriginItem(state: ApiState, data: IndexedObject) {
    state.originItems = {
      ...state.originItems,
      ...this.getIndexedMap(data)
    };
  }
  // Save original copy
  private saveOrigins(
    store: StateTree,
    model: ModelType,
    data: IndexedObject | Array<IndexedObject>
  ) {
    try {
      const state = store[model.plural];
      if (isArray(data)) {
        data.forEach((e: IndexedObject) => this.saveOriginItem(state, e));
      } else {
        this.saveOriginItem(state, data);
        forEach(model.references, (modelName, prop) => {
          this.saveOrigins(store, this.models[modelName], data[prop]);
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`We could not find the model ${model.plural}.`);
    }
  }
  // Removing original copy
  private removeOriginItem(originItems: IndexedObject, item: IndexedObject) {
    if (item && has(originItems, item.id)) {
      Vue.delete(originItems, item.id);
    }
  }
  // Revert to original copy
  private revertOriginItem(state: ApiState, id: string) {
    if (has(state.originItems, id)) {
      state.items[id] = state.originItems[id];
    }
  }

  private upsertData(
    store: StateTree,
    model: ModelType,
    data: IndexedObject | Array<IndexedObject>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): IndexedObject | Array<IndexedObject> {
    if (isArray(data)) {
      return data.map((e: IndexedObject) => this.patchEntity(store, model, e));
    } else {
      return this.patchEntity(store, model, data);
    }
  }

  private patchEntity(
    store: StateTree,
    model: ModelType,
    entity: IndexedObject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): IndexedObject {
    // Patch references
    if (model.references) {
      forEach(model.references, (modelName, prop) => {
        entity[prop] = this.patchReference(store, entity, modelName, prop);
      });
    }

    const state = store[model.plural];

    if (has(state.items, entity.id)) {
      const storeEntity = state.items[entity.id];
      forEach(entity, (value, name: string) => {
        if (!isFunction(value) && !has(model.references, name)) {
          if (has(entity, name) && !isEqual(value, get(storeEntity, name))) {
            Vue.set(storeEntity, name, value);
          }
        }
      });

      return state.items[entity.id];
    } else {
      state.items = { ...state.items, ...this.getIndexedMap(entity) };

      return entity;
    }
  }

  private patchReference(
    store: StateTree,
    entity: IndexedObject,
    modelName: string,
    prop: string
  ) {
    if (has(this.models, modelName)) {
      return this.upsertData(store, this.models[modelName], entity[prop]);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `Patch error: We could not find the model ${modelName} for the reference ${prop}.`
      );
    }
  }
}
