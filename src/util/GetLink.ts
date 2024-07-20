import { promisify } from 'util';
import YoutubeSearch from 'yt-search';
import StringSimilarity from 'string-similarity';
import Constants from './Constants.js';
import { logInfo } from './LogHelper.js';
import { generateTemplateString } from './FormatGenerators.js';

const {
  YOUTUBE_SEARCH: { MAX_MINUTES },
  INPUT_TYPES: { SONG },
} = Constants;
const search = promisify(YoutubeSearch as unknown as Function);

const findLinks = async (searchTerms: string, type: string, exclusionFilters: string[]): Promise<string[]> => {
  logInfo(`searching youtube with keywords "${searchTerms}"`);
  const result = await search(searchTerms);
  const isSong = Object.values(SONG).includes(type);

  return result.videos
    .filter(
      (video) =>
        !exclusionFilters ||
        !(
          exclusionFilters.some((exclusionFilter) => video.title.includes(exclusionFilter)) ||
          exclusionFilters.some((exclusionFilter) => video.description.includes(exclusionFilter))
        )
    )
    .filter((video) => (!isSong || video.seconds < MAX_MINUTES * 60) && video.seconds > 0)
    .slice(0, 10)
    .map((video) => (video.url.includes('https://youtube.com') ? video.url : 'https://youtube.com' + video.url));
};

type linkContext = {
  itemName: string;
  albumName: string;
  artistName: string;
  extraSearch: string;
  searchFormat: string;
  type: string;
  exclusionFilters: string[];
};
const getLinks = async ({
  itemName,
  albumName,
  artistName,
  extraSearch,
  searchFormat,
  type,
  exclusionFilters,
}: linkContext): Promise<string[]> => {
  let tempExtraSearch = extraSearch;
  let links: string[] = [];
  if (searchFormat.length)
    links = await findLinks(
      generateTemplateString(itemName, albumName, artistName, searchFormat),
      type,
      exclusionFilters
    );

  // custom search format failed or was never provided try the generic way
  if (!links.length) {
    const similarity = StringSimilarity.compareTwoStrings(itemName, albumName);
    // to avoid duplicate song downloads
    tempExtraSearch = tempExtraSearch ? ` ${tempExtraSearch}` : '';
    if (similarity < 0.5)
      links = await findLinks(`${albumName} - ${itemName}${tempExtraSearch}`, type, exclusionFilters);

    if (!links.length) links = await findLinks(`${artistName} - ${itemName}${tempExtraSearch}`, type, exclusionFilters);
  }

  return links;
};

export default getLinks;
