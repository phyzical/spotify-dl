import { DateContext } from '../types/DateContext.js';

export const cleanOutputPath = (output: string): string =>
  output ? output.replace(/[&\/\\#+$!"~.%:*?<>{}\|]/g, '') : '';

export const removeQuery = (url: string): string => url.split('?')[0];

export const splitDates = (dateString?: string): DateContext => {
  const dateSplits = dateString && dateString.split('-');

  return {
    year: dateSplits && dateSplits.length > 0 ? dateSplits[0] : '',
    month: dateSplits && dateSplits.length > 1 ? dateSplits[1] : '',
    day: dateSplits && dateSplits.length > 2 ? dateSplits[2] : '',
  };
};
