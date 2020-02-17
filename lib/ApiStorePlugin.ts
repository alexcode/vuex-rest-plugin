import get from "lodash-es/get";
import { Store } from "vuex";
import Actions from "./Actions";
import ApiStore from "./ApiStore";
import { VuexRestOptions } from "./types";

export default (options: VuexRestOptions) => {
  const namespaced = get(options, "namespaced");
  const dataPath = get(options, "dataPath");
  const apiStore = new ApiStore(options.models, namespaced);
  apiStore.actions = new Actions(options.axios, options.models, dataPath);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (store: Store<any>) =>
    store.registerModule(options.name || "api", apiStore);
};
