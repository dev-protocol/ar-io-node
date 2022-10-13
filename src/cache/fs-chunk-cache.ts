import fs from 'fs';
import { Readable } from 'stream';
import winston from 'winston';

import { fromMsgpack, toB64Url, toMsgpack } from '../lib/encoding.js';
import {
  ChunkByAbsoluteOrRelativeOffsetSource,
  ChunkDataByAbsoluteOrRelativeOffsetSource,
  ChunkDataCache,
  ChunkMetadata,
  ChunkMetadataByAbsoluteOrRelativeOffsetSource,
} from '../types.js';

function chunkMetadataCacheDir(dataRoot: Buffer) {
  const b64DataRoot = toB64Url(dataRoot);
  return `data/chunks/${b64DataRoot}/metadata/`;
}

function chunkMetadataCachePath(dataRoot: Buffer, relativeOffset: number) {
  return `${chunkMetadataCacheDir(dataRoot)}/${relativeOffset}`;
}

function chunkDataCacheDir(dataRoot: Buffer) {
  const b64DataRoot = toB64Url(dataRoot);
  return `data/chunks/${b64DataRoot}/data/`;
}

function chunkDataCachePath(dataRoot: Buffer, relativeOffset: number) {
  return `${chunkDataCacheDir(dataRoot)}/${relativeOffset}`;
}

export class FsChunkCache
  implements ChunkDataByAbsoluteOrRelativeOffsetSource, ChunkDataCache
{
  private log: winston.Logger;
  private chunkSource: ChunkDataByAbsoluteOrRelativeOffsetSource;

  constructor({
    log,
    chunkSource,
  }: {
    log: winston.Logger;
    chunkSource: ChunkDataByAbsoluteOrRelativeOffsetSource;
  }) {
    this.log = log.child({ class: this.constructor.name });
    this.chunkSource = chunkSource;
  }

  async hasChunkData(dataRoot: Buffer, relativeOffset: number) {
    try {
      await fs.promises.access(
        chunkDataCachePath(dataRoot, relativeOffset),
        fs.constants.F_OK,
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getChunkData(
    dataRoot: Buffer,
    relativeOffset: number,
  ): Promise<Buffer | undefined> {
    try {
      if (await this.hasChunkData(dataRoot, relativeOffset)) {
        return await fs.promises.readFile(
          chunkDataCachePath(dataRoot, relativeOffset),
        );
      }
    } catch (error: any) {
      this.log.error('Failed to fetch chunk data from cache', {
        dataRoot,
        relativeOffset,
        message: error.message,
        stack: error.stack,
      });
    }

    return undefined;
  }

  async setChunkData(
    data: Buffer,
    dataRoot: Buffer,
    relativeOffset: number,
  ): Promise<void> {
    try {
      await fs.promises.mkdir(chunkDataCacheDir(dataRoot), {
        recursive: true,
      });
      await fs.promises.writeFile(
        chunkDataCachePath(dataRoot, relativeOffset),
        data,
      );
      this.log.info('Successfully cached chunk data', {
        dataRoot: toB64Url(dataRoot),
        relativeOffset,
      });
    } catch (error: any) {
      this.log.error('Failed to set chunk data in cache:', {
        dataRoot: toB64Url(dataRoot),
        relativeOffset,
        message: error.message,
        stack: error.stack,
      });
    }
  }

  async getChunkDataByAbsoluteOrRelativeOffset(
    absoluteOffset: number,
    dataRoot: Buffer,
    relativeOffset: number,
  ): Promise<Readable> {
    try {
      const chunkDataPromise = this.getChunkData(dataRoot, relativeOffset).then(
        async (chunkData) => {
          // Chunk is cached
          if (chunkData) {
            this.log.info('Successfully fetched chunk data from cache', {
              dataRoot: toB64Url(dataRoot),
              relativeOffset,
            });
            return chunkData;
          }

          // Fetch from ChunkSource
          return this.chunkSource.getChunkDataByAbsoluteOrRelativeOffset(
            absoluteOffset,
            dataRoot,
            relativeOffset,
          );
        },
      );
      const chunkData = await chunkDataPromise;
      return Readable.from(chunkData);
    } catch (error: any) {
      this.log.error('Failed to fetch chunk data:', {
        absoluteOffset,
        dataRoot: toB64Url(dataRoot),
        relativeOffset,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

export class FsChunkMetadataCache
  implements ChunkMetadataByAbsoluteOrRelativeOffsetSource
{
  private log: winston.Logger;
  private chunkSource: ChunkByAbsoluteOrRelativeOffsetSource;

  constructor({
    log,
    chunkSource,
  }: {
    log: winston.Logger;
    chunkSource: ChunkByAbsoluteOrRelativeOffsetSource;
  }) {
    this.log = log.child({ class: this.constructor.name });
    this.chunkSource = chunkSource;
  }

  async hasChunkMetadata(dataRoot: Buffer, relativeOffset: number) {
    try {
      await fs.promises.access(
        chunkMetadataCachePath(dataRoot, relativeOffset),
        fs.constants.F_OK,
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getChunkMetadata(
    dataRoot: Buffer,
    relativeOffset: number,
  ): Promise<ChunkMetadata | undefined> {
    try {
      if (await this.hasChunkMetadata(dataRoot, relativeOffset)) {
        const msgpack = await fs.promises.readFile(
          chunkMetadataCachePath(dataRoot, relativeOffset),
        );
        return fromMsgpack(msgpack) as ChunkMetadata;
      }
    } catch (error: any) {
      this.log.error('Failed to fetch chunk data from cache', {
        dataRoot,
        relativeOffset,
        message: error.message,
        stack: error.stack,
      });
    }

    return undefined;
  }

  async setChunkMetadata(chunkMetadata: ChunkMetadata): Promise<void> {
    const { data_root, offset } = chunkMetadata;
    try {
      await fs.promises.mkdir(chunkMetadataCacheDir(data_root), {
        recursive: true,
      });
      const msgpack = toMsgpack(chunkMetadata);
      await fs.promises.writeFile(
        chunkMetadataCachePath(data_root, offset),
        msgpack,
      );
      this.log.info('Successfully cached chunk metadata', {
        dataRoot: toB64Url(data_root),
        relativeOffset: offset,
      });
    } catch (error: any) {
      this.log.error('Failed to set chunk data in metacache:', {
        dataRoot: toB64Url(data_root),
        relativeOffset: offset,
        message: error.message,
        stack: error.stack,
      });
    }
  }

  async getChunkMetadataByAbsoluteOrRelativeOffset(
    absoluteOffset: number,
    dataRoot: Buffer,
    relativeOffset: number,
  ): Promise<ChunkMetadata> {
    try {
      const chunkMetadataPromise = this.getChunkMetadata(
        dataRoot,
        relativeOffset,
      ).then(async (chunkMetadata) => {
        // Chunk is cached
        if (chunkMetadata) {
          this.log.info('Successfully fetched chunk data from cache', {
            dataRoot: toB64Url(dataRoot),
            relativeOffset,
          });
          return chunkMetadata;
        }

        // Fetch from ChunkSource
        const chunk = await this.chunkSource.getChunkByAbsoluteOrRelativeOffset(
          absoluteOffset,
          dataRoot,
          relativeOffset,
        );

        return {
          data_root: dataRoot,
          data_size: chunk.chunk.length,
          offset: relativeOffset,
          data_path: chunk.data_path,
        };
      });

      return await chunkMetadataPromise;
    } catch (error: any) {
      this.log.error('Failed to fetch chunk data:', {
        absoluteOffset,
        dataRoot: toB64Url(dataRoot),
        relativeOffset,
        message: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
