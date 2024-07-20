import NodeID3 from 'node-id3';
import fs from 'fs';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { logSuccess } from '../util/LogHelper.js';
import Constants from '../util/Constants.js';
import { logInfo } from '../util/LogHelper.js';
import { splitDates } from '../util/Filters.js';
import { Track } from '../types/items/Track.js';
import path from 'path';

const downloadAndSaveCover = (uri: string | null, filename: string): Promise<unknown> =>
  // eslint-disable-next-line no-async-promise-executor, @typescript-eslint/no-explicit-any
  new Promise(async (resolve: (_value: unknown) => void, reject: (_reason?: any) => void): Promise<void> => {
    let cover = '';
    if (uri)
      cover = (
        await axios({
          method: 'GET',
          url: uri,
          responseType: 'stream',
        })
      ).data;
    else cover = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'unknown.jpg'), 'utf8');

    const ffmpegCommand = ffmpeg();
    ffmpegCommand
      .on('error', (e) => {
        reject(e);
      })
      .on('end', () => {
        resolve('success');
      })
      .input(cover)
      .save(`${filename}`)
      .format('jpg');
  });

const mergeMetadata = async (output: string, songData: Track): Promise<void> => {
  const coverFileName = output.slice(0, output.length - 3) + 'jpg';
  let coverURL = songData.cover_url;
  if (!coverURL) coverURL = Constants.YOUTUBE_SEARCH.GENERIC_IMAGE;

  try {
    await downloadAndSaveCover(coverURL, coverFileName);
  } catch (_e) {
    // image is corrupt or not available try again
    logInfo('Album Thumbnail corrupt attempting again');
    try {
      await downloadAndSaveCover(coverURL, coverFileName);
    } catch (_e2) {
      // if it fails again just fallback to generic image
      logInfo('Album Thumbnail corrupt for second time fallback to generic image');

      await downloadAndSaveCover(null, coverFileName);
    }
  }

  const dateSplits = splitDates(songData.release_date);
  const firstArtist = songData.artists && songData.artists.length > 0 ? songData.artists.first : '';
  const metadata = {
    artist: firstArtist,
    originalArtist: firstArtist,
    albumArtist: songData.artists.join('/'),
    composer: firstArtist,
    performerInfo: songData.artists.join('/'),
    author: firstArtist,
    album: songData.album_name,
    title: songData.name,
    bpm: songData.bpm ? songData.bpm.toString() : undefined,
    year: dateSplits.year,
    date: `${dateSplits.day}${dateSplits.month}`,
    trackNumber: `${songData.track_number}/${songData.total_tracks}`,
    popularimeter: {
      email: 'mail@example.com',
      rating: (songData.popularity * Constants.FFMPEG.RATING_CONSTANT).toString(),
      counter: 0,
    },
    APIC: coverFileName,
    unsynchronisedLyrics: {
      language: 'eng',
      text: songData.lyrics,
    },
  };

  NodeID3.update(metadata, output);
  fs.unlinkSync(coverFileName);
  logSuccess('Metadata Merged!\n');
};

export default mergeMetadata;
