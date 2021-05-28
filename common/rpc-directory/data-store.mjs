// Copyright 2021 HITCON Online Contributors
// SPDX-License-Identifier: BSD-2-Clause

import assert from 'assert';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

/**
 * DataStore is a class that handles storing small amount of JSON data.
 * These data are used as lightweight database.
 * NOTE: All data is store in *memory*, so we should be careful not to let the
 * size of data stored get too large.
 * NOTE: Each service will get one instance of this class. No synchronization
 * is provided between services. Each service should take care to ensure that
 * they are the sole
 */
class DataStore {
  /**
   * Constructor for DataStore, it doesn't load or store any data.
   * However, it'll create the storage directory.
   * @constructor
   */
  constructor() {
    // Stores the opened data files.
    this.opened = {};
    /*
     * Structure of objects in opened:
     * data {object} - The payload JSON data object.
     * dirty {boolean} - True if we have not initiate the write operation for
     * what is currently in the data object, and the data object differs from
     * the on disk data.
     * writeInProgress {boolean} - True if we are currently writing.
     * pending {boolean} - True if we wanted to flush dirty data when write is
     * in progress.
     */

    // Where to store the data files?
    this.dataDir = 'small_data';

    // If set to true, we'll always automatically flush dirty cache.
    // This can only be set in the constructor.
    this.autoFlush = true;

    if (!this.autoFlush) {
      // If no auto flush, then we'll need to flush periodically.
      this._routineFlusher();
    }
    fs.mkdirSync(this.dataDir);
  }

  /**
   * Helper utility to generate file path for data.
   * @param {string} dataName - Name of the data to load.
   * @param {boolean} real - If set, return the actual path, if not, return the
   * temporary path.
   * @return {string} path - The file path.
   */
  _getPath(dataName, real) {
    let ext = '.json';
    if (!real) {
      ext = '.json.tmp';
    }
    return path.join(this.dataDir, dataNme+ext);
  }
  /**
   * Load a data file either from cache or disk.
   * If the data doesn't exist, return an empty object. This method deos not
   * fail.
   * @param {string} dataName - Name of the data to load.0
   * @return {object} data - The data that is loaded.
   */
  async loadData(dataName) {
    if (!(dataName in this.opened)) {
      this.opened = await this._loadDataFromDisk(dataName);
    }
    return this.opened[dataName].data;
  }
  
  /**
   * Load a data file from disk.
   * @private
   * @param {string} dataName - Name of the data to load.
   * @return {object} data - The data that is loaded.
   */
  async _loadDataFromDisk(dataName) {
    let result = {};
    result.data = {};
    result.dirty = false;
    result.writeInProgress = false;
    result.pending = false;

    let filePath = this._getPath(dataName, true);
    let readFd = undefined;
    try {
      readFd = await fsPromises.open(filePath, 'r');
    } catch (e) {
      console.warn('Unable to open \'' + filePath + '\' for reading. Reason: '+e);
      readFd = undefined;
    }
    if (readFd === undefined) {
      // It is normal for read to fail, when we first read the data.
      return result;
    }
    try {
      let fileContent = await readFd.read('utf-8');
      await readFd.close();
    } catch (e) {
      console.error('Failed to read \'' + filePath + '\'. Reason: '+e);
      throw e;
    }
    let dataObject = JSON.parse(fileContent);
    result.data = dataObject;
    return result;
  }
  
  /**
   * Save the dataObj into the data file.
   * This method returns immediately, while the save operation carries on in
   * the background atomically.
   * @param {string} dataName - Name of the data to save.
   * @param {object} dataObj - The data object to save.
   * @return 
   */
  async saveData(dataName, dataObj) {
    if (!(dataName in this.opened)) {
      this.opened[dataName] = {};
      this.opened[dataName].data = {};
      this.opened[dataName].dirty = true;
      this.opened[dataName].writeInProgress = false;
      this.opened[dataName].pending = false;
    }
    this.opened[dataName].data = dataObj;
    this.opened[dataName].dirty = true;
    // Possibly trigger the save action here.
    if (this.autoFlush) {
      _flushDirtyData(dataName);
    }
  }
  
  /**
   * Actually try to save the data back to disk.
   * @param {string} dataName - The name of the data to save.
   */
  async _flushDirtyData(dataName) {
    if (!(dataName in this.opened)) {
      throw 'Attempting to flush non-existent data.';
    }
    // Wait a tick so we don't delay anything.
    await new Promise(resolve => setTimeout(resolve, 0));

    while (true) {
      if (!this.opened[dataName].dirty) {
        // Not dirty? Not our problem.
        break;
      }
      if (this.opened[dataName].writeInProgress) {
        // Somebody else is writing.
        console.warn('Concurrent _flushDirtyData()');
        this.opened[dataName].pending = true;
        break;
      }
      this.opened[dataName].writeInProgress = true;
      this.opened[dataName].pending = false;
      this.opened[dataName].dirty = false;
      let fileContent = JSON.stringify(this.opened[dataName].data);
      
      // Write to temp file first.
      let filePath = this._getPath(dataName, false);
      let writeFd = undefined;
      try {
        writeFd = await fsPromises.open(filePath, 'w');
        await writeFd.write(fileContent, 'utf-8');
        await writeFd.close();
        
        // Overwrite the actual file.
        fsPromises.rename(filePath, this._getPath(dataName, true));
      } catch (e) {
        console.warn('Unable to open \'' + filePath + '\' for writing. Reason: '+e);
        throw e;
      }
      
      // We're done.
      this.opened[dataName].writeInProgress = false;
      
      if (this.opened[dataName].pending) {
        // We've pending flush, so flush it again.
        continue;
      }
      if (this.autoFlush) {
        // We auto flush, so let's flush again.
        continue;
      }
      break;
    }
    return true;
  };
  
  /**
   * This method runs continuously since the creation of this class.
   * It attempts to flush all outstanding dirty cache.
   * Runs only when autoFlush is false.
   */
  async _routineFlusher() {
    // Wait a tick before starting.
    await new Promise(resolve => setTimeout(resolve, 0));

    while (true) {
      // TODO: Make this configurable.
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      for (let dataName in this.opened) {
        // no await, we let it run in the background.
        this._flushDirtyData(dataName);
      }
    }
  }
};

export default DataStore;
