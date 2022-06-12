import chokidar from 'chokidar';
import os from 'os';
import path from 'path';
import fs from 'fs';

const home = os.homedir();
const dev = `${__dirname}/../~`;

function getPathTo(pathFrom: string) {
  const subDir = path.relative(dev, pathFrom);
  return path.join(home, subDir);
}

function ensureDirExists(pathTo: string) {
  if (!fs.existsSync(pathTo)) {
    fs.mkdirSync(pathTo);
    console.log(`${pathTo} - created`);
  }
}

function ensureFileExists(pathFrom: string, pathTo: string) {
  if (!fs.existsSync(pathTo)) {
    fs.copyFileSync(pathFrom, pathTo);
    console.log(`${pathTo} - created`);
    return true;
  }
  return false;
}

function syncFile(pathFrom: string, pathTo: string, stats: {mode: number} | undefined) {
  const fromBuffer = fs.readFileSync(pathFrom);
  const toBuffer = fs.readFileSync(pathTo);

  const toStats = fs.statSync(pathTo);

  const isContentSame = fromBuffer.equals(toBuffer);
  const isModeSame = stats === undefined || toStats.mode === stats.mode;

  if (!isContentSame) fs.writeFileSync(pathTo, fromBuffer, {});
  if (stats && !isModeSame) fs.chmodSync(pathTo, stats.mode);

  if (isContentSame && isModeSame) {
    console.log(`${pathTo} - already up to date`);
    return false;
  }

  console.log(`${pathTo} - updated`);
  return true;
}

function isSubDir(parentPath: string, childPath: string) {
  const parent = path.normalize(parentPath);
  const child = path.normalize(childPath);
  return child.startsWith(parent);
}

function isSamePath(first: string, second: string) {
  return path.normalize(first) === path.normalize(second);
}

chokidar.watch(dev).on(`all`, (event, pathFrom, stats) => {
  // If the path isn't underneath dev, ignore it.
  if (!isSubDir(dev, pathFrom)) return;

  const pathTo = getPathTo(pathFrom);

  // If it's the home dir, do nothing, because it should already exist.
  if (isSamePath(dev, pathFrom)) return;

  //   console.log(event, pathFrom);

  if (event === `addDir`) {
    // If the dir doesn't exist, create it.
    ensureDirExists(pathTo);
  }

  if (event === `add`) {
    // If the file doesn't exist, copy it from dev.
    ensureFileExists(pathFrom, pathTo);
    // If we didn't copy it from dev, ensure its content is up to date.
    syncFile(pathFrom, pathTo, stats);
  }

  if (event === `change`) {
    syncFile(pathFrom, pathTo, stats);
  }

  if (event === `unlink`) {
    fs.unlinkSync(pathTo);
  }

  if (event === `unlinkDir`) {
    fs.rmdirSync(pathTo);
  }
});
