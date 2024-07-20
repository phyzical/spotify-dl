import Constants from './Constants.js';

const {
  YOUTUBE_SEARCH: { VALID_CONTEXTS },
} = Constants;

export const generateTemplateString = (
  _itemName: string,
  _albumName: string,
  _artistName: string,
  format: string
): string => {
  const contexts = format.match(/(?<=\{).+?(?=\})/g);

  if (!contexts?.length) return format;

  const invalidContexts = contexts.filter((context) => !VALID_CONTEXTS.includes(context));
  if (invalidContexts.length > 0) throw new Error(`Invalid search contexts: ${invalidContexts}`);

  contexts.forEach((context) => (format = format.replace(`{${context}}`, eval(`_${context}`))));

  return format;
};
