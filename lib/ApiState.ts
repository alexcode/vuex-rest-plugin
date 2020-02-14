import isEmpty from 'lodash-es/isEmpty';
import some from 'lodash-es/some';
import ActionQueue from './ActionQueue';
import { IndexedObjectTree, IndexedObject } from './types';

export default class ApiState {
  [key: string]: any;
  items?: IndexedObjectTree;
  lastLoad: Date;
  loaded: boolean;
  originItems: IndexedObject;
  actionQueue: ActionQueue;
  constructor() {
    this.lastLoad = new Date();
    this.loaded = false;
    this.items = Object.create(null);
    this.originItems = Object.create(null);
    this.actionQueue = new ActionQueue();
  }
  public reset(): void {
    this.lastLoad = new Date();
    this.loaded = false;
    this.items = Object.create(null);
    this.originItems = Object.create(null);
    this.actionQueue = new ActionQueue();
  }
  get hasAction(): boolean {
    return some(this.actionQueue, (a: Array<object> | object) => !isEmpty(a));
  }
}
