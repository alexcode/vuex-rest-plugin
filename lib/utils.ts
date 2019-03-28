import get from 'lodash/get';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import isFunction from 'lodash/isFunction';
import map from 'lodash/map';
import { ModelTypeTree } from './types';

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
