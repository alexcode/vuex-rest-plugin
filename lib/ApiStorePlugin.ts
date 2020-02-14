import get from 'lodash-es/get';
import Actions from './Actions';
import ApiStore from './ApiStore';

export default (options: any) => {
  const namespaced = get(options, 'namespaced', true);
  const dataPath = get(options, 'dataPath');
  const apiStore = new ApiStore(options.models, namespaced);
  apiStore.actions = new Actions(options.axios, options.models, dataPath);

  return (store: any) => store.registerModule(options.name || 'api', apiStore);
};
