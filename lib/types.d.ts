export interface IndexedObject {
  id: string;
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
  afterSave?: Modifier;
  beforeQueue?: Modifier;
  afterQueue?: Modifier;
}

export interface ModelTypeTree {
  [index: string]: ModelType;
}

export interface Payload {
  id: string;
  type: string;
  transition?: string;
  url?: string;
  query?: any;
  data?: IndexedObject | Array<IndexedObject>;
  [index: string]: any;
}

export interface QueuePayload {
  type: string;
  data: IndexedObject | Array<IndexedObject>;
  action: string;
  [index: string]: any;
}

export interface ReferenceTree {
  [index: string]: string;
}

export type Modifier = (value: IndexedObject | Array<IndexedObject>) => void;
