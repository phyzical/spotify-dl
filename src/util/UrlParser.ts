import { Inputs } from '../types/config/Input.js';
import { ApiEndpoints } from '../types/Spotify.js';

export default (inputUrl: string): Inputs | Error => {
  if (inputUrl.includes(ApiEndpoints.YOUTUBE)) return Inputs.YOUTUBE;
  else if (inputUrl.includes(ApiEndpoints.TRACK)) return Inputs.SONG;
  else if (inputUrl.includes(ApiEndpoints.PLAYLIST)) return Inputs.PLAYLIST;
  else if (inputUrl.includes(ApiEndpoints.ALBUM)) return Inputs.ALBUM;
  else if (inputUrl.includes(ApiEndpoints.ARTIST)) return Inputs.ARTIST;
  else if (inputUrl.includes(ApiEndpoints.SHOW)) return Inputs.SHOW;
  else if (inputUrl.includes(ApiEndpoints.EPISODE)) return Inputs.EPISODE;
  else return new Error('Invalid spotify URL');
};
