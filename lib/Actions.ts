import { ActionContext, Commit, ActionTree, Action } from 'vuex';
import { AxiosInstance } from 'axios';
import at from 'lodash/at';
import flatMap from 'lodash/flatMap';
import forEach from 'lodash/forEach';
import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import keys from 'lodash/keys';
import map from 'lodash/map';
import some from 'lodash/some';
import ApiState from './ApiState';
import {
  ModelTypeTree,
  Payload,
  QueuePayload,
  ModelType,
  IndexedObject,
  IndexedObjectTree
} from './types';
import { applyModifier } from './utils';

export default class Actions<S, R> implements ActionTree<S, R> {
  [key: string]: Action<S, R>;
  get: Action<S, R>;
  post: Action<S, R>;
  patch: Action<S, R>;
  delete: Action<S, R>;
  queueActionWatcher: Action<S, R>;
  queueAction: Action<S, R>;
  processActionQueue: Action<S, R>;
  cancelAction: Action<S, R>;
  cancelActionQueue: Action<S, R>;
  constructor(axios: AxiosInstance, models: ModelTypeTree, dataPath?: string) {
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
        const resultData = dataPath ? get(result.data, dataPath) : result.data;
        commit(`ADD_${_getModel(payload).name.toUpperCase()}`, resultData);
        return resultData;
      });
    };

    // store entity to API
    const _storeEntity = async (
      commit: Commit,
      payload: Payload,
      method: string = 'post'
    ) => {
      // const model = _getModel(payload);
      const { data } = payload;
      return axios({
        method,
        url: _formatUrl(payload),
        data: await applyModifier('beforeSave', payload.type, models, data)
      }).then(async result => {
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
            `${_formatUrl(payload)}/delete`,
            await applyModifier('beforeSave', payload.type, models, data)
          )
          .then(() => {
            commit(`DELETE_${model.name.toUpperCase()}`, data);
          });
      }

      return axios.delete(_formatUrl(payload)).then(() => {
        commit(`DELETE_${model.name.toUpperCase()}`, id);
      });
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
              'afterQueue',
              queue,
              models,
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
