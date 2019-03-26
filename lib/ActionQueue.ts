export default class ActionQueue {
  readonly post: Array<object>;
  readonly patch: object;
  readonly delete: object;
  constructor() {
    this.post = [];
    this.patch = {};
    this.delete = {};
  }
}
