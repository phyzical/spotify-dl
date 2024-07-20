import Genius from 'genius-lyrics';
import { logInfo } from '../util/LogHelper.js';
import { Track } from '../types/items/Track.js';

const downloadSubtitles = async (item: Track): Promise<string> => {
  const Client = new Genius.Client();
  const term = `${item.name} - ${item.artists.first}`;
  let searches;
  try {
    logInfo(`lyrics downloading for ${term}`);
    searches = await Client.songs.search(term);
  } catch (e) {
    logInfo(e.message);
  }
  let lyrics = '';
  if (searches && searches.length && searches.first) lyrics = (await searches.first.lyrics()).trim();
  else logInfo(`No lyrics found for ${term}`);

  return lyrics;
};

export default downloadSubtitles;
