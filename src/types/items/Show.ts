import { Inputs } from '../config/Input.js';
import { List } from './List.js';

export type Show = List & {
  id: string;
  type: Inputs.SHOW;
};
