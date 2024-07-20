import path from 'path';
import fs from 'fs';
import getLinks from './GetLink.js';
import { cleanOutputPath } from './Filters.js';
import Constants from './Constants.js';
import downloader from '../lib/Downloader.js';
import { writeId, findId } from '../lib/Cache.js';
import mergeMetadata from '../lib/Metadata.js';
import { cliInputs } from '../lib/Setup.js';
import {
  getTrack,
  getPlaylist,
  getArtistAlbums,
  getEpisode,
  getShowEpisodes,
  getSavedShows,
  getSavedAlbums,
  getSavedPlaylists,
  getSavedTracks,
  getAlbum,
} from './GetSongdata.js';
import { logSuccess, logInfo, logFailure } from './LogHelper.js';
import downloadSubtitles from '../lib/SubtitleDownloader.js';
import { generateTemplateString } from './FormatGenerators.js';
import { initArrayPolyfills } from './polyfills/Array.js';
import { Inputs } from '../types/config/Input.js';
import { List } from '../types/items/List.js';
import { Track } from '../types/items/Track.js';
import { Playlist } from '../types/items/Playlist.js';

const {
  YOUTUBE_SEARCH: { GENERIC_IMAGE },
} = Constants;
const {
  inputs,
  extraSearch,
  output,
  outputOnly,
  downloadReport,
  downloadLyrics,
  searchFormat,
  exclusionFilters,
  outputFormat,
  outputFileType,
} = cliInputs();

const itemOutputPath = (item: Track): string => {
  const itemName = cleanOutputPath(item.name || '_');
  const generatedPathSegments = cleanOutputPath(
    generateTemplateString(itemName, item.album_name, item.artists.first(), outputFormat)
  ).split('___');

  return `${path.join(path.normalize(output), ...(outputOnly ? [itemName] : generatedPathSegments))}.${outputFileType}`;
};

const downloadList = async (list: List): Promise<List> => {
  list.name = list.name.replace('/', '-');
  const totalItems = list.items.length;
  logInfo(`Downloading: ${list.name}`);
  logInfo(`Total Items: ${totalItems}`);
  let currentCount = 0;
  for (const item of list.items) {
    currentCount++;
    const fullItemPath = itemOutputPath(item);
    const itemDir = fullItemPath.substr(0, fullItemPath.lastIndexOf(path.sep));
    const cached = findId(item.id, itemDir);

    if (!cached) {
      logInfo(
        [
          `${currentCount}/${totalItems}`,
          `Artist: ${item.artists.first}`,
          `Album: ${item.album_name}`,
          `Item: ${item.name}`,
        ].join('\n')
      );
      //create the dir if it doesn't exist
      fs.mkdirSync(itemDir, { recursive: true });

      if (downloadLyrics) item.lyrics = await downloadSubtitles(item);

      const ytLinks = item.URL
        ? [item.URL]
        : await getLinks({
          itemName,
          albumName,
          artistName,
          extraSearch,
          searchFormat,
          type: list.type,
          exclusionFilters,
        });

      const outputFilePath = path.resolve(fullItemPath);

      const downloadSuccessful = await downloader(ytLinks, outputFilePath);

      if (downloadSuccessful) {
        await mergeMetadata(outputFilePath, item);
        writeId(itemDir, item.id);
      }
      item.failed = !downloadSuccessful;
    }
    item.cached = true;
  }
  logSuccess(`Finished processing ${list.name}!\n`);

  return list;
};

const generateReport = async (listResults: List[]): Promise<void> => {
  if (listResults.length) {
    logInfo('Download Report:');
    listResults.forEach((result) => {
      const listItems = result.items;
      const itemLength = listItems.length;
      const failedItems = listItems.filter((item) => item.failed);
      const failedItemLength = failedItems.length;
      logInfo(
        [
          'Successfully downloaded',
          `${itemLength - failedItemLength}/${itemLength}`,
          `for ${result.name} (${result.type})`,
        ].join(' ')
      );
      if (failedItemLength)
        logFailure(
          [
            'Failed items:',
            ...failedItems.map((item) =>
              [
                `Item: (${item.name})`,
                `Album: ${item.album_name}`,
                `Artist: ${item.artists.first}`,
                `ID: (${item.id})`,
              ].join(' ')
            ),
          ].join('\n')
        );
    });
  }
};

initArrayPolyfills();

const run = async (): Promise<void> => {
  const listResults = [];
  for (const input of inputs) {
    const lists: List[] = [];
    logInfo(`Starting processing of ${input.type} (${input.url})`);
    const URL = input.url;
    switch (input.type) {
      case Inputs.SONG: {
        const track = await getTrack(URL);
        lists.push({
          items: [track],
          name: `${track.name} ${track.artists.first}`,
          type: input.type,
        } as List);
        break;
      }
      case Inputs.PLAYLIST: {
        const list = await getPlaylist(URL);
        list.type = input.type;
        lists.push(list);
        break;
      }
      case Inputs.ALBUM: {
        const list = await getAlbum(URL);
        list.type = input.type;
        lists.push(list);
        break;
      }
      case Inputs.ARTIST: {
        const artistAlbumInfos = await getArtistAlbums(URL);
        lists.push(
          ...artistAlbumInfos.map((list) => {
            list.type = input.type;

            return list;
          })
        );
        break;
      }
      case Inputs.EPISODE: {
        const episode = await getEpisode(URL);
        if (episode)
          lists.push({
            items: [episode],
            name: `${episode.name} ${episode.album_name}`,
            type: input.type,
          });
        else logFailure('Failed to find episode, you may need to use auth');

        break;
      }
      case Inputs.SHOW: {
        const list = await getShowEpisodes(URL);
        list.type = input.type;
        lists.push(list);
        break;
      }
      case Inputs.SAVED_SHOWS: {
        const savedShowsInfo = await getSavedShows();
        lists.push(
          ...savedShowsInfo.map((list) => {
            list.type = input.type;

            return list;
          })
        );
        break;
      }
      case Inputs.SAVED_ALBUMS: {
        const savedAlbumsInfo = await getSavedAlbums();
        lists.push(
          ...savedAlbumsInfo.map((list) => {
            list.type = input.type;

            return list;
          })
        );
        break;
      }
      case Inputs.SAVED_PLAYLISTS: {
        const savedPlaylistsInfo = await getSavedPlaylists();
        lists.push(
          ...savedPlaylistsInfo.map((list) => {
            list.type = input.type;

            return list;
          })
        );
        break;
      }
      case Inputs.SAVED_TRACKS: {
        const list = await getSavedTracks();
        list.type = input.type;
        lists.push(list);
        break;
      }
      case Inputs.YOUTUBE: {
        lists.push({
          items: [
            {
              name: URL,
              artists: [''],
              album_name: URL,
              release_date: null,
              //todo can we get the youtube image?
              cover_url: GENERIC_IMAGE,
              id: URL,
              URL: URL,
            },
          ],
          name: URL,
          type: input.type,
        });
        break;
      }
      default: {
        throw new Error(
          `Invalid URL type (${input.type}), ` + 'Please visit github and make a request to support this type'
        );
      }
    }

    for (const [x, list] of lists.entries()) {
      logInfo(`Starting download of list ${x + 1}/${lists.length}`);
      const downloadResult = await downloadList(list);
      if (downloadReport) listResults.push(downloadResult);
    }
  }
  await generateReport(listResults);
  logSuccess('Finished!');
};

export default run;
