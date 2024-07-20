import { Inputs } from '../config/Input.js';
import { List } from './List.js';

export type Album = List & {
  type: Inputs.ALBUM;
  release_date: string;
  total_tracks: number;
  images: any[];
};
