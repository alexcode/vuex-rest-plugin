import { ActionContext, Commit, ActionTree, Action } from "vuex";
import { AxiosInstance, Method } from "axios";
import at from "lodash-es/at";
import flatMap from "lodash-es/flatMap";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";
import has from "lodash-es/has";
import isArray from "lodash-es/isArray";
// import isEqual from 'lodash-es/isEqual';
import keys from "lodash-es/keys";
import map from "lodash-es/map";
// import some from 'lodash-es/some';
import values from "lodash-es/values";
import ApiState from "./ApiState";
import {
  ModelTypeTree,
  Payload,
  QueuePayload,
  ModelType,
  // IndexedObject,
  IndexedObjectTree
} from "./types";
import { applyModifier, formatUrl } from "./utils";

export default class Actions<S, R> implements ActionTree<S, R> {
  [key: string]: Action<S, R>;
  get: Action<S, R>;
  post: Action<S, R>;
  patch: Action<S, R>;
  delete: Action<S, R>;
  // queueActionWatcher: Action<S, R>;
  queueAction: Action<S, R>;
  processActionQueue: Action<S, R>;
  cancelAction: Action<S, R>;
  cancelActionQueue: Action<S, R>;
  reset: Action<S, R>;
  constructor(axios: AxiosInstance, models: ModelTypeTree, dataPath?: string) {
    const _isAll = (p: Payload) => !has(p, "id") && isArray(p.data);

    const _getModel = (p: Payload | QueuePayload): ModelType => models[p.type];

    // retrieve entity from Vuex store
    const _getEntity = (state: S | ApiState, payload: Payload) => {
      return get(state, `${_getModel(payload).plural}.items`)[payload.id];
    };

    // fetch entity from API
    const _fetchEntity = (commit: Commit, payload: Payload) => {
      if (get(payload, "clear", _isAll(payload))) {
        commit(`CLEAR_${_getModel(payload).name.toUpperCase()}`);
      }
      return axios
        .get(formatUrl(payload), payload.axiosConfig)
        .then(async result => {
          const resultData = dataPath
            ? get(result.data, dataPath)
            : result.data;
          commit(`ADD_${_getModel(payload).name.toUpperCase()}`, resultData);
          return resultData;
        });
    };

    // store entity to API
    const _storeEntity = async (
      commit: Commit,
      payload: Payload,
      method: Method = "post"
    ) => {
      const mainConfig = {
        method,
        url: formatUrl(payload),
        data: await applyModifier(
          "beforeSave",
          payload.type,
          models,
          payload.data
        )
      };
      const config = { ...mainConfig, ...payload.axiosConfig };
      return axios(config).then((result: any) => {
        const resultData = dataPath ? get(result.data, dataPath) : result.data;
        commit(`ADD_${_getModel(payload).name.toUpperCase()}`, resultData);
        return resultData;
      });
    };

    // delete entity to API
    const _deleteEntity = async (commit: Commit, payload: Payload) => {
      const model = _getModel(payload);
      const { id, data } = payload;

      if (_isAll(payload)) {
        return axios
          .patch(
            `${formatUrl(payload)}/delete`,
            await applyModifier("beforeSave", payload.type, models, data),
            payload.axiosConfig
          )
          .then(() => {
            commit(`DELETE_${model.name.toUpperCase()}`, data);
          });
      }

      return axios.delete(formatUrl(payload), payload.axiosConfig).then(() => {
        commit(`DELETE_${model.name.toUpperCase()}`, id);
      });
    };

    const _confirmActionType = (
      queue: string,
      { state, commit, dispatch }: ActionContext<S, R>
    ) => {
      const model = models[queue];
      if (get(state, `${model.plural}.hasAction`)) {
        return flatMap(
          get(state, `${model.plural}.actionQueue`),
          (entities: IndexedObjectTree, action: string) =>
            map(entities, async e => {
              if (action === "post") {
                await dispatch(action, { type: queue, data: e });
                commit(`DELETE_${model.name}`, e);
                return commit(`RESET_QUEUE_${model.name}`);
              }
              await dispatch(action, {
                type: queue,
                id: e.id,
                data: e
              });
              return commit(`RESET_QUEUE_${model.name}`);
            })
        );
      }
      return Promise.resolve();
    };

    const _cancelActionType = async (
      queue: string,
      { state, commit }: ActionContext<S, R>
    ) => {
      const model = models[queue];
      if (get(state, `${model.plural}.hasAction`)) {
        const originIds = keys(
          get(state, `${model.plural}.actionQueue.delete`, [])
        ).concat(
          keys(get(state, `${model.plural}.actionQueue.post`, [])),
          keys(get(state, `${model.plural}.actionQueue.patch`, []))
        );
        const origin = at(get(state, `${model.plural}.originItems`), originIds);
        commit(
          `ADD_${model.name}`,
          await applyModifier("afterQueue", queue, models, origin)
        );
        commit(`RESET_QUEUE_${model.name}`);
      }
    };

    this.get = async (
      { commit, state }: ActionContext<S, R>,
      payload: Payload
    ) => {
      const entity = _getEntity(state, payload);
      if (payload.forceFetch || !entity) {
        return _fetchEntity(commit, payload);
      }
      return entity;
    };

    this.post = ({ commit }: ActionContext<S, R>, payload: Payload) =>
      _storeEntity(commit, payload);

    this.patch = ({ commit }: ActionContext<S, R>, payload: Payload) =>
      _storeEntity(commit, payload, "patch");

    this.delete = ({ commit }: ActionContext<S, R>, payload: Payload) =>
      _deleteEntity(commit, payload);

    // add watched changes to queue
    // this.queueActionWatcher = (
    //   { commit, state }: ActionContext<S, R>,
    //   payload: QueuePayload
    // ) => {
    //   const model = _getModel(payload);
    //   const checkChanged = (i: IndexedObject) =>
    //     has(get(state, `${model.plural}.originItems`), i.id) &&
    //     !isEqual(get(state, `${model.plural}.originItems.${i.id}`), i);
    //   const hasChanged =
    //     isArray(payload.data) && payload.data
    //       ? some(payload.data, checkChanged)
    //       : checkChanged(payload.data);
    //   if (hasChanged) {
    //     commit(`QUEUE_ACTION_${model.name}`, payload);
    //   }
    // };

    this.queueAction = (
      { commit }: ActionContext<S, R>,
      payload: QueuePayload
    ) => commit(`QUEUE_ACTION_${_getModel(payload).name}`, payload);

    this.processActionQueue = (
      context: ActionContext<S, R>,
      queue: string | Array<string>
    ) => {
      if (isArray(queue)) {
        return Promise.all(flatMap(queue, q => _confirmActionType(q, context)));
      }
      return _confirmActionType(queue, context);
    };

    this.cancelActionQueue = (
      context: ActionContext<S, R>,
      payload: string | Array<string>
    ) => {
      if (isArray(payload)) {
        forEach(payload, p => _cancelActionType(p, context));
      } else {
        _cancelActionType(payload, context);
      }
    };

    this.cancelAction = (
      { commit }: ActionContext<S, R>,
      payload: QueuePayload
    ) => {
      const model = _getModel(payload);
      commit(`UNQUEUE_ACTION_${model.name}`, payload);
    };

    this.reset = (context: ActionContext<S, R>) => {
      values(context.state).forEach(s => s.reset());
    };
  }
}
