import {
  extractTracks,
  extractAlbum,
  extractArtist,
  extractArtistAlbums,
  extractPlaylist,
  extractEpisodes,
  extractShowEpisodes,
  extractSavedShows,
  extractSavedAlbums,
  extractSavedPlaylists,
  extractSavedTracks,
} from '../lib/Api.js';
import { Artist } from '../types/items/Artist.js';
import { Album } from '../types/items/Album.js';
import { Track } from '../types/items/Track.js';
import { Playlist } from '../types/items/Playlist.js';
import { Episode } from '../types/items/Episode.js';
import { ArtistAlbum } from '../types/items/ArtistAlbum.js';

const getID = (url: string): string => {
  const splits = url.split('/');

  return splits[splits.length - 1];
};

export const getTrack = async (url: string): Promise<Track> => (await extractTracks([getID(url)]))[0];
export const getAlbum = async (url: string): Promise<Album> => await extractAlbum(getID(url));
export const getArtist = async (url: string): Promise<Artist> => await extractArtist(getID(url));

export const getArtistAlbums = async (url: string): Promise<ArtistAlbum[]> => {
  const artistResult = await getArtist(url);
  const albumsResult = await extractArtistAlbums(artistResult.id);
  const albumIds = albumsResult.map((album: Album): string => album.id);
  const albumInfos: ArtistAlbum[] = [];
  for (let x = 0; x < albumIds.length; x++) {
    const albumInfo = await extractAlbum(albumIds[x]);
    // hardcode to artist being requested
    albumInfo.items = albumInfo.items.map((item: Track): Track => {
      item.artists = [artistResult.name, ...item.artists];

      return item;
    });
    albumInfos.push(albumInfo);
  }

  return albumInfos;
};

export const getPlaylist = async (url: string): Promise<Playlist> => await extractPlaylist(getID(url));
export const getEpisode = async (url: string): Promise<Episode> => (await extractEpisodes([getID(url)]))[0];

export const getShowEpisodes = async (url: string): Promise<Episode[]> => await extractShowEpisodes(getID(url));

export const getSavedShows = async (): Promise<Episode[]> => {
  const shows = await extractSavedShows();
  const episodes: Episode[] = [];
  for (let x = 0; x < shows.length; x++) episodes.push(await extractShowEpisodes(shows[x].id));

  return episodes;
};

export const getSavedAlbums = async (): Promise<Album[]> => {
  const albums = await extractSavedAlbums();
  const albumInfos = [];
  for (let x = 0; x < albums.length; x++) albumInfos.push(await extractAlbum(albums[x].id));

  return albumInfos;
};

export const getSavedPlaylists = async (): Promise<Playlist[]> => {
  const playlistsResults = await extractSavedPlaylists();
  const playlistIds = playlistsResults.map((playlist) => playlist.id);
  const playlistInfos = [];
  for (let x = 0; x < playlistIds.length; x++) playlistInfos.push(await extractPlaylist(playlistIds[x]));

  return playlistInfos;
};

export const getSavedTracks = async (): Promise<Track[]> => await extractSavedTracks();
