import { Inputs } from '../config/Input';
import { List } from './List';

export type Playlist = List & {
  type: Inputs.PLAYLIST;
  total: number;
};
