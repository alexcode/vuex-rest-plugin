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

// type RootState<S> = S & { [index: string]: ApiState };

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
      this.mutations[`ADD_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        item: IndexedObject | Array<IndexedObject>
      ) =>
        applyModifier("afterGet", modelKey, this.models, item).then(
          (i: IndexedObject) => {
            this.storeOriginItem(
              get(myState, `${modelIdx}.originItems`),
              i,
              model.beforeQueue
            );
            this.patchEntity(myState, model, i);
            // this.linkReferences(i, myState, model.references);
            myState[modelIdx].lastLoad = new Date();
          }
        );

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
      ) => myState[modelIdx].reset();

      this.mutations[`QUEUE_ACTION_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        payload: QueuePayload
      ) => {
        const store = myState[modelIdx];
        const storeAction = async (qp: QueuePayload) => {
          const QToStore = omit(qp, "method", "action");
          if (qp.action === "post") {
            Vue.set(
              store.items,
              qp.data.id,
              await applyModifier("afterGet", modelKey, this.models, qp.data)
            );
            store.actionQueue[qp.action].push(
              await applyModifier("beforeSave", modelKey, this.models, QToStore)
            );
          } else {
            if (qp.action === "delete") {
              Vue.delete(store.items, qp.id);
            }
            Vue.set(
              store.actionQueue[qp.action],
              qp.data.id,
              await applyModifier("beforeSave", modelKey, this.models, QToStore)
            );
          }
        };

        if (has(store.actionQueue, payload.action)) {
          storeAction(payload);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`action ${payload.action} is not storable`);
        }
      };

      this.mutations[`UNQUEUE_ACTION_${model.name.toUpperCase()}`] = (
        myState: ApiState,
        payload: QueuePayload
      ) => {
        const id = payload.id || payload.data.id;
        Vue.delete(myState[model.plural].actionQueue[payload.action], id);
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

  private async patchEntity(
    state: ApiState,
    model: ModelType,
    entity: IndexedObject | Array<IndexedObject>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    if (!entity) {
      return;
    }
    if (isArray(entity)) {
      return Promise.all(entity.map(e => this.patchEntity(state, model, e)));
    }

    if (entity.id && model) {
      // Patch references
      if (model.references) {
        forEach(model.references, async (modelName, prop) => {
          entity[prop] = await this.patchReference(
            state,
            entity,
            modelName,
            prop
          );
        });
      }

      const store = state[model.plural];

      if (has(store.items, entity.id)) {
        forEach(entity, (value, idx: string) => {
          if (!isFunction(value)) {
            if (!isEqual(value, get(store.items[entity.id], idx))) {
              Vue.set(store.items[entity.id], idx, value);
            }
          }
        });
      } else {
        store.items = { ...store.items, [entity.id]: entity };
        this.storeOriginItem(store.originItems, entity, model.beforeQueue);
      }
    }
    return entity;
  }

  private async patchReference(
    state: ApiState,
    entity: IndexedObject,
    modelName: string,
    prop: string
  ) {
    const refEntity = await applyModifier(
      "afterGet",
      modelName,
      this.models,
      entity[prop]
    );

    if (has(this.models, modelName)) {
      return this.patchEntity(state, this.models[modelName], refEntity);
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        `Patch error: We could not find the model ${modelName} for the reference ${prop}.`
      );
    }
  }
}
