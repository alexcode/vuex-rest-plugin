import has from "lodash-es/has";
import isArray from "lodash-es/isArray";
import isDate from "lodash-es/isDate";
import isFunction from "lodash-es/isFunction";
import isObject from "lodash-es/isObject";
import map from "lodash-es/map";
import { IndexedObject, ModifierName, ModelTypeTree, Payload } from "./types";

export async function applyModifier(
  modifier: ModifierName,
  modelName: string,
  models: ModelTypeTree,
  data?: IndexedObject | Array<IndexedObject>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const applyItemModifier = async (
    modifier: ModifierName,
    modelName: string,
    models: ModelTypeTree,
    data: IndexedObject
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> => {
    try {
      await Promise.all(
        map(models[modelName]["references"], async (ref, key) => {
          if (has(data, key) && data[key]) {
            data[key] = await applyModifier(modifier, ref, models, data[key]);
          }
          return Promise.resolve(data[key]);
        })
      );
      const fn = models[modelName][modifier];
      return !isFunction(fn) ? Promise.resolve(data) : await fn(data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Modifier error on "${modelName}". ${e}`);
    }
  };

  if (data) {
    if (isArray(data)) {
      return Promise.all(
        data.map(item => applyItemModifier(modifier, modelName, models, item))
      );
    } else {
      return await applyItemModifier(modifier, modelName, models, data);
    }
  }
  return Promise.resolve(data);
}

export function formatUrl(payload: Payload) {
  let url = payload.url || payload.type;

  if (!payload.url && payload.id) {
    url += `/${payload.id}`;
  }

  if (payload.query && isObject(payload.query)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query = map(payload.query, (value: any, key: string) => {
      let resquestValue = value;
      if (isFunction(value.toISOString) || isDate(value)) {
        resquestValue = new Date(value).toISOString();
      }
      return `${key}=${resquestValue}`;
    });
    payload.query = query.join("&");
  }
  if (payload.query) {
    url += `?${payload.query}`;
  }

  return url;
}
