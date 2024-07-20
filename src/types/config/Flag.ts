import { Input } from './Input.js';

export type Flag = {
  inputs: Input[];
  cacheFile: '.spdlcache',
  cookieFile: 'cookies.txt',
  downloadReport: true,
  output: process.cwd(),
  extraSearch: '',
  login: false,
  password: '',
  username: '',
  savedAlbums: false,
  savedPlaylists: false,
  savedTracks: false,
  savedShows: false,
  outputOnly: false,
  downloadLyrics: false,
  searchFormat: '',
  outputFormat: '{artistName}___{albumName}___{itemName}',
  exclusionFilters: '',
  outputFileType: 'mp3',
};
