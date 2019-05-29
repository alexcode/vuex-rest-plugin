import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isDate from 'lodash/isDate';
import isFunction from 'lodash/isFunction';
import isObject from 'lodash/isObject';
import map from 'lodash/map';
import { ModelTypeTree, Payload } from './types';

export async function applyModifier(
  modifier: string,
  modelName: string,
  models: ModelTypeTree,
  data?: object | Array<object>
): Promise<any> {
  const applyFn = (d?: object) => {
    const fn = get(models, `${modelName}.${modifier}`);
    return !isFunction(fn) ? Promise.resolve(d) : fn(d);
  };
  const refs = get(models, `${modelName}.references`, []);
  const applyRefFn = (d?: object) =>
    map(refs, (ref, key) => {
      if (has(d, key)) {
        return applyModifier(modifier, ref, models, get(d, key));
      }
      return Promise.resolve(d);
    });

  if (isArray(data)) {
    return Promise.all(data.map(applyRefFn)).then(() =>
      Promise.all(data.map(applyFn))
    );
  }
  return Promise.resolve(applyRefFn(data)).then(() => applyFn(data));
}

export function formatUrl(payload: Payload) {
  let url = payload.url || payload.type;

  if (!payload.url && payload.id) {
    url += `/${payload.id}`;
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
}
