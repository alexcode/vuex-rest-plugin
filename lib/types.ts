import { AxiosRequestConfig, AxiosInstance, Method } from "axios";
import ApiState from "./ApiState";

export interface IndexedObject {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [index: string]: any;
}

export interface IndexedObjectTree {
  [id: string]: IndexedObject;
}

export interface ModelType {
  name: string;
  plural: string;
  type: ApiState;
  references?: ReferenceTree;
  afterGet?: Modifier;
  beforeSave?: Modifier;
  beforeQueue?: Modifier;
  afterQueue?: Modifier;
  [index: string]: string | ApiState | ReferenceTree | Modifier | undefined;
}

export interface ModelTypeTree {
  [index: string]: ModelType;
}

export interface Payload {
  id: string;
  type: string;
  transition?: string;
  url?: string;
  forceFetch?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query?: any;
  data?: IndexedObject | Array<IndexedObject>;
  axiosConfig?: AxiosRequestConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [index: string]: any;
}

export interface QueuePayload {
  type: string;
  url: string;
  payload: Payload;
  action: Method;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [index: string]: any;
}

export interface ToQueue {
  type: string;
  url: string;
  data: IndexedObject;
}

export interface QueuePayloadWithModifiers {
  action: Method;
  id: string;
  afterGet: IndexedObject;
  toQueue: ToQueue;
}

interface ReferenceTree {
  [index: string]: string;
}

export interface VuexRestOptions {
  name?: string;
  namespaced?: boolean;
  models: ModelTypeTree;
  axios: AxiosInstance;
  dataPath?: string;
}

export type Modifier = (value: IndexedObject | Array<IndexedObject>) => void;

export enum ModifierName {
  afterGet = "afterGet",
  beforeSave = "beforeSave",
  beforeQueue = "beforeQueue",
  afterQueue = "afterQueue"
}
