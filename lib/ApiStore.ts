import { StoreOptions } from "vuex";
import Vue from "vue";
import cloneDeep from "lodash-es/cloneDeep";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";
import has from "lodash-es/has";
import isArray from "lodash-es/isArray";
import isEqual from "lodash-es/isEqual";
import isFunction from "lodash-es/isFunction";
import isString from "lodash-es/isString";
import omit from "lodash-es/omit";
import Actions from "./Actions";
import ApiState from "./ApiState";
import {
  ModelTypeTree,
  QueuePayload,
  IndexedObject,
  ModelType,
  Modifier
} from "./types";
import { applyModifier } from "./utils";

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
    forEach(this.models, (model, modelKey) => {
      const modelIdx = model.plural;

      // adding all states
      this.state[modelIdx] = model.type;

      // adding ADD_* mutations
      this.mutations[`ADD_${model.name.toUpperCase()}`] = async (
        myState: StateTree,
        item: IndexedObject | Array<IndexedObject>
      ) => {
        const state = myState[modelIdx];
        const res = await this.patchEntity(myState, model, item);
        this.storeOriginItem(state.originItems, res, model.beforeQueue);
        myState[modelIdx].lastLoad = new Date();
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
        payload: QueuePayload
      ) => {
        const state = myState[modelIdx];
        const storeAction = async (qp: QueuePayload) => {
          const QToStore = omit(qp, "method", "action");
          if (qp.action === "post") {
            Vue.set(
              state.items,
              qp.data.id,
              await applyModifier("afterGet", modelKey, this.models, qp.data)
            );
            state.actionQueue[qp.action].push(
              await applyModifier("beforeSave", modelKey, this.models, QToStore)
            );
          } else {
            if (qp.action === "delete") {
              Vue.delete(state.items, qp.id);
            }
            Vue.set(
              state.actionQueue[qp.action],
              qp.data.id,
              await applyModifier("beforeSave", modelKey, this.models, QToStore)
            );
          }
        };

        if (has(state.actionQueue, payload.action)) {
          storeAction(payload);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`action ${payload.action} is not storable`);
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
  // storing Origin item copy
  private async storeOriginItem(
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

  private async patchEntity(
    store: StateTree,
    model: ModelType,
    entity: IndexedObject | Array<IndexedObject>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (!entity) {
      return;
    }
    if (isArray(entity)) {
      return Promise.all(entity.map(e => this.patchEntity(store, model, e)));
    }

    if (entity.id && model) {
      // Patch references
      if (model.references) {
        forEach(model.references, async (modelName, prop) => {
          entity[prop] = await this.patchReference(
            store,
            entity,
            modelName,
            prop
          );
        });
      }

      const entityAfter = await applyModifier(
        "afterGet",
        model.name.toLowerCase(),
        this.models,
        entity
      );

      const state = store[model.plural];

      if (has(state.items, entity.id)) {
        const storeEntity = state.items[entity.id];
        forEach(entityAfter, (value, name: string) => {
          if (!isFunction(value) && !has(model.references, name)) {
            if (has(entity, name) && !isEqual(value, get(storeEntity, name))) {
              Vue.set(storeEntity, name, value);
            }
          }
        });

        return state.items[entity.id];
      } else {
        state.items = { ...state.items, [entity.id]: entityAfter };
        this.storeOriginItem(state.originItems, entityAfter, model.beforeQueue);

        return entityAfter;
      }
    }
  }

  private async patchReference(
    store: StateTree,
    entity: IndexedObject,
    modelName: string,
    prop: string
  ) {
    if (has(this.models, modelName)) {
      return this.patchEntity(store, this.models[modelName], entity[prop]);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `Patch error: We could not find the model ${modelName} for the reference ${prop}.`
      );
    }
  }
}
