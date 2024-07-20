import fs from 'fs';
import path from 'path';
import { cliInputs } from './Setup.js';

const getCacheFile = (dir: string): string => {
  const { cacheFile } = cliInputs();
  const cacheFileIsRelative = cacheFile[0] == '.';

  return cacheFileIsRelative ? path.join(dir, cacheFile) : cacheFile;
};

export const writeId = (dir: string, id: string): void => {
  const cacheFile = getCacheFile(dir);
  fs.appendFileSync(cacheFile, `spotify ${id}\n`);
};

export const findId = (id: string, dir: string): string | boolean | undefined => {
  const cacheFile = getCacheFile(dir);
  let cached = false;
  if (fs.existsSync(cacheFile))
    cached = fs
      .readFileSync(cacheFile, 'utf-8')
      .split('\n')
      .map((line) => line.replace('spotify ', ''))
      .find((line) => line == id);

  return cached;
};
