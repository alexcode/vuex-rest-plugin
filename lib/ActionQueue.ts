import some from "lodash-es/some";
import has from "lodash-es/has";

export default class ActionQueue {
  [key: string]: any;
  readonly post: Array<object>;
  readonly patch: object;
  readonly delete: object;
  constructor() {
    this.post = [];
    this.patch = {};
    this.delete = {};
  }

  hasId(id: string) {
    return (
      has(this.delete, id) || has(this.patch, id) || some(this.post, ["id", id])
    );
  }
}
