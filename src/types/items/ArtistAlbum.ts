import { Inputs } from '../config/Input.js';
import { Album } from './Album.js';

export type ArtistAlbum = Album & {
  type: Inputs.ARTIST;
};
