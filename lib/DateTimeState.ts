import ApiState from './ApiState';

export default class DateTimeState extends ApiState {
  from: Date | null;
  to: Date | null;
  constructor() {
    super();
    this.from = null;
    this.to = null;
  }
}
