/* eslint-disable no-unused-vars */
export enum Inputs {
  SONG = 'song',
  PLAYLIST = 'playlist',
  ALBUM = 'album',
  ARTIST = 'artist',
  SAVED_ALBUMS = 'savedAlbums',
  SAVED_TRACKS = 'savedTracks',
  SAVED_PLAYLISTS = 'savedPlaylists',
  SHOW = 'show',
  EPISODE = 'episode',
  SAVED_SHOWS = 'savedShows',
  YOUTUBE = 'youtube',
}

export type Input = {
  type: Inputs;
  url: string;
};
