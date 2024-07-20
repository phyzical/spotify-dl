import { Artist } from './Artist';
import { Album } from './Album';

export type Track = {
  name: string;
  tempo: number | undefined;
  popularity: number;
  artists: Artist[];
  album_name: string;
  release_date: string;
  track_number: number;
  total_tracks: number;
  cover_url: string;
  lyrics: string;
  URL: string;
  id: string;
  album: Album;
};
