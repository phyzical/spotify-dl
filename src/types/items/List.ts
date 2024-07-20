import { Track } from './Track.js';

export type List = {
  id: string;
  type: string;
  items: Track[];
  name: string;
};
