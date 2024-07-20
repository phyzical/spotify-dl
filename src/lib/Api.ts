import SpotifyWebApi from 'spotify-web-api-node';
import open from 'open';
import express from 'express';
import puppeteer from 'puppeteer';
import { cliInputs } from './Setup.js';
import Config from '../Config.js';
import Constants from '../util/Constants.js';
import { logInfo, logFailure } from '../util/LogHelper.js';
import { Inputs } from '../types/config/Input.js';
import { Track } from '../types/items/Track.js';
import { Artist } from '../types/items/Artist.js';
import { Album } from '../types/items/Album.js';
import { Playlist } from '../types/items/Playlist.js';
import { Episode } from '../types/items/Episode.js';
import { ArtistAlbum } from '../types/items/ArtistAlbum.js';
import { AudioFeature } from '../types/AudioFeature.js';
import { Image } from '../types/items/Image.js';

const {
  spotifyApi: { clientId, clientSecret },
} = Config;

const {
  AUTH: {
    SCOPES: { USERS_SAVED_PLAYLISTS, USERS_SAVED_TRACKS_ALBUMS, USERS_TOP_TRACKS },
    STATE,
    REFRESH_ACCESS_TOKEN_SECONDS,
    TIMEOUT_RETRY,
  },
  MAX_LIMIT_DEFAULT,
  SERVER: { PORT, HOST, CALLBACK_URI },
} = Constants;

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri: `http://${HOST}:${PORT}${CALLBACK_URI}`,
});

const scopes = [USERS_SAVED_PLAYLISTS, USERS_SAVED_TRACKS_ALBUMS, USERS_TOP_TRACKS];

let nextTokenRefreshTime;

const verifyCredentials = async (): Promise<void> => {
  if (!nextTokenRefreshTime || nextTokenRefreshTime < new Date()) {
    nextTokenRefreshTime = new Date();
    nextTokenRefreshTime.setSeconds(nextTokenRefreshTime.getSeconds() + REFRESH_ACCESS_TOKEN_SECONDS);
    logInfo('Generating new access token');
    await checkCredentials();
  }
};

const checkCredentials = async (): Promise<void> => {
  if (await spotifyApi.getRefreshToken()) await refreshToken();
  else {
    const { inputs, username, password, login } = cliInputs();

    const requiresLogin = inputs.find(
      (input) =>
        input.type == Inputs.SAVED_ALBUMS ||
        input.type == Inputs.SAVED_PLAYLISTS ||
        input.type == Inputs.SAVED_TRACKS ||
        input.type == Inputs.SAVED_SHOWS
    );

    const requestingLogin = (username && password) || login;

    if (requiresLogin || requestingLogin) await requestAuthorizedTokens();
    else await requestTokens();
  }
};

const requestAuthorizedTokens = async (): Promise<void> => {
  const { username, password } = cliInputs();
  const autoLogin = username.length > 0 && password.length > 0;
  const app = express();
  let resolve;
  const getCode = new Promise((_resolve) => {
    resolve = _resolve;
  });
  app.get(CALLBACK_URI, (req, res) => {
    resolve(req.query.code);
    res.end('');
  });
  const server = await app.listen(PORT);

  const authURL = await spotifyApi.createAuthorizeURL(scopes, STATE, autoLogin);

  let browser = null;

  logInfo('Performing Spotify Auth Please Wait...');

  if (autoLogin) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    try {
      await page.goto(authURL);
      await page.type('#login-username', username);
      await page.type('#login-password', password);
      await page.click('#login-button');
      await page.waitForSelector('#auth-accept, *[data-testid="auth-accept"]').then((e) => e.click());
    } catch (e) {
      logFailure(e.message);
      const screenshotPath = './failure.png';
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });
      throw new Error(
        [
          'Could not generate token',
          'Please find a screenshot of why the auto login failed at ',
          `${screenshotPath}`,
        ].join(' ')
      );
    }
  } else open(authURL);

  const code = await getCode;
  setTokens((await spotifyApi.authorizationCodeGrant(code)).body);
  if (browser) browser.close();

  server.close();
};

const requestTokens = async (): Promise<void> => {
  setTokens((await spotifyApi.clientCredentialsGrant()).body);
};

const refreshToken = async (): Promise<void> => {
  setTokens((await spotifyApi.refreshAccessToken()).body);
};

const setTokens = (tokens): void => {
  spotifyApi.setAccessToken(tokens['access_token']);
  spotifyApi.setRefreshToken(tokens['refresh_token']);
};
// common wrapper for api calls
// to have token verification and api throttling mitigation
// eslint-disable-next-line @typescript-eslint/ban-types
const callSpotifyApi = async (apiCall: Function): Promise<void> => {
  const maxRetries = 5;
  let tries = 1;
  let error;

  while (tries <= maxRetries) {
    await verifyCredentials();

    try {
      return await apiCall();
    } catch (e) {
      error = e;
      logInfo(`Got a spotify api error (${e})\n` + `Timing out for 5 minutes x ${tries}`);
      await new Promise((resolve) => setTimeout(resolve, TIMEOUT_RETRY * 1000));
      tries++;
    }
  }
  // if it still fails after all the timeouts and retries throw again
  throw new Error(error);
};



export const extractTracks = async (tracks: Track[]): Promise<Track[]> => {
  let extractedTracks: Track[] = [];
  const trackIds = tracks.map((track: Track): string => track.id).clean();
  const chunkedTracks = trackIds.chunk(20);
  for (let x = 0; x < chunkedTracks.length; x++) {
    logInfo('extracting track set ' + `${x + 1}/${chunkedTracks.length}`);
    extractedTracks.push(...(await callSpotifyApi(
      async (): Promise<Track[]> => (await spotifyApi.getTracks(chunkedTracks[x])).body.tracks
    );));
  }
  const audioFeatures = (await extractTrackAudioFeatures(trackIds)).clean();

  return extractedTracks.clean().map((track: Track): Track => {
    const audioFeature = audioFeatures.find((audioFeature: AudioFeature): boolean => audioFeature.id == track.id) as AudioFeature | undefined
    return {
      ...track,
      tempo: audioFeature?.tempo,
      cover_url: track.album.images.map((image: Image): string => image.url).first(),
    }
  });
};

export const extractPlaylist = async (playlistId: string): Promise<Playlist> => {
  const playlist = (await callSpotifyApi(
    async () => (await spotifyApi.getPlaylist(playlistId, { limit: 1 })).body
  )) as unknown as Playlist;
  let playlistTracks: Playlist;
  let offset = 0;
  do {
    playlistTracks = (await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getPlaylistTracks(playlistId, {
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    )) as unknown as Playlist;
    if (!offset) logInfo(`extracting ${playlistTracks.total} tracks`);

    playlist.items.push(...playlistTracks.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (playlist.items.length < playlistTracks.total);
  return {
    ...playlist,
    name: `${playlist.name} - ${playlist.owner.display_name}`,
    items: await extractTracks(playlist.items),
    type: Inputs.PLAYLIST,
    total: playlistTracks.total,
  };
};

export const extractAlbum = async (albumId: string): Promise<ArtistAlbum> => {
  const albumInfo = await callSpotifyApi(async () => (await spotifyApi.getAlbum(albumId, { limit: 1 })).body);
  const tracks: Track[] = [];
  let offset = 0;
  let albumTracks;
  do {
    albumTracks = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getAlbumTracks(albumId, {
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${albumTracks.total} tracks`);

    tracks.push(...albumTracks.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (tracks.length < albumTracks.total);

  const trackParsed = (await extractTracks(tracks.filter((track) => track).map((track) => track.id))).map((track) => {
    track.artists = [albumInfo.artists.first.name, ...track.artists];

    return track;
  });

  return {
    name: `${albumInfo.name} - ${albumInfo.label}`,
    items: trackParsed,
  };
};

export const extractArtist = async (artistId: string): Promise<Artist> => {
  const data = await callSpotifyApi(async () => (await spotifyApi.getArtist(artistId)).body);

  return {
    id: data.id,
    name: data.name,
    href: data.href,
  };
};

export const extractArtistAlbums = async (artistId: string): Promise<Album[]> => {
  const albums = [];
  let offset = 0;
  let artistAlbums;
  do {
    artistAlbums = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getArtistAlbums(artistId, {
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${artistAlbums.total} albums`);

    albums.push(...artistAlbums.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (albums.length < artistAlbums.total);
  // remove albums that are not direct artist albums
  return albums;
};

export const extractEpisodes = async (episodeIds: string[]): Promise<Episode> => {
  const episodes = [];
  let episodesResult;
  const chunkedEpisodes = episodeIds.chunk(20);
  for (let x = 0; x < chunkedEpisodes.length; x++) {
    logInfo('extracting episode set ' + `${x + 1}/${chunkedEpisodes.length}`);
    episodesResult = await callSpotifyApi(async () => (await spotifyApi.getEpisodes(chunkedEpisodes[x])).body.episodes);
    episodesResult = episodesResult.filter((episode) => episode);
    episodes.push(...episodesResult);
  }

  return episodes.map((episode: Episode, index: number): Episode => ({
    ...episode,
    artists: [episode.show.publisher as Artist],
    album: episode.show as Album,
    popularity: 100,
    tempo: 0,
    // shows dont have a way to see what episode they are guess via context
    track_number: index,
    total_tracks: episode.show.total_episodes,
    cover_url: episode.images.map((image: Image): string => image.url).first(),
  }));
};

export const extractShowEpisodes = async (showId: string): Promise<Show[]> => {
  const showInfo = await callSpotifyApi(async () => (await spotifyApi.getShow(showId)).body);
  const episodes = [];
  let offset = 0;
  let showEpisodes;
  do {
    showEpisodes = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getShowEpisodes(showId, {
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${showEpisodes.total} episodes`);

    episodes.push(...showEpisodes.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (episodes.length < showEpisodes.total);

  return {
    name: `${showInfo.name} - ${showInfo.publisher}`,
    items: await extractEpisodes(episodes.map((episode) => episode.id)),
  };
};

export const extractSavedShows = async (): Promise<Show> => {
  const shows = [];
  let offset = 0;
  let savedShows;
  do {
    savedShows = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getMySavedShows({
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${savedShows.total} shows`);

    shows.push(...savedShows.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (shows.length < savedShows.total);

  return shows.map((show) => show.show);
};

export const extractSavedAlbums = async () => {
  const albums = [];
  let offset = 0;
  let savedAlbums;
  do {
    savedAlbums = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getMySavedAlbums({
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${savedAlbums.total} albums`);

    albums.push(...savedAlbums.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (albums.length < savedAlbums.total);

  return albums.map((album) => album.album);
};

export const extractSavedPlaylists = async (): Promise<Playlist[]> => {
  let offset = 0;
  const playlists = [];
  let savedPlaylists;
  do {
    savedPlaylists = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getUserPlaylists({
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    if (!offset) logInfo(`extracting ${savedPlaylists.total} playlists`);

    playlists.push(...savedPlaylists.items);
    offset += MAX_LIMIT_DEFAULT;
  } while (playlists.length < savedPlaylists.total);

  return playlists;
};

export const extractSavedTracks = async (): Promise<Track[]> => {
  const tracks = [];
  let offset = 0;
  let savedTracks;
  do {
    savedTracks = await callSpotifyApi(
      async () =>
        (
          await spotifyApi.getMySavedTracks({
            limit: MAX_LIMIT_DEFAULT,
            offset: offset,
          })
        ).body
    );
    tracks.push(...savedTracks.items.map((item) => item.track));
    offset += MAX_LIMIT_DEFAULT;
    logInfo('extracting tracks ' + `${tracks.length}/${savedTracks.total}`);
  } while (tracks.length < savedTracks.total);
  const audioFeatures = await extractTrackAudioFeatures(tracks.map((track) => track.id));

  return {
    name: 'Saved Tracks',
    items: tracks.filter((track) => track).map((track) => parseTrack(track, audioFeatures)),
  };
};

export const extractTrackAudioFeatures = async (trackIds: string[]): Promise<AudioFeature[]> => {
  const audioFeatures = [];
  for (const chunk of trackIds.chunk(MAX_LIMIT_DEFAULT))
    audioFeatures.push(
      ...(await callSpotifyApi(async () => (await spotifyApi.getAudioFeaturesForTracks(chunk)).body.audio_features))
    );

  return audioFeatures.filter((x) => x);
};
