import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import path from 'path';
import fs from 'fs-extra';

/**
 * Simple JSON file database with circular reference support.
 */
class JsonDB {
  /**
   * Directory where JSON files are stored.
   * @type {string}
   */
  directory;

  /**
   * Create a new JsonDB instance.
   * @param {string} directory - Directory to store JSON files.
   */
  constructor(directory) {
    this.directory = directory;
  }

  /**
   * Save data to a JSON file with the given id.
   * @param {string} id - Identifier for the JSON file (without extension).
   * @param {any} data - Data to save (can include circular references).
   * @returns {void}
   */
  save(id, data) {
    const savePath = path.join(this.directory, `${id}.json`);
    writefile(savePath, jsonStringifyWithCircularRefs(data));
  }

  /**
   * Load data from a JSON file with the given id.
   * @template T
   * @param {string} id - Identifier for the JSON file (without extension).
   * @returns {T} The parsed data (with circular references restored).
   */
  load(id) {
    const loadPath = path.join(this.directory, `${id}.json`);
    const parse = jsonParseWithCircularRefs(fs.readFileSync(loadPath, 'utf8'));
    return parse;
  }

  /**
   * Delete a JSON file with the given id.
   * @param {string} id - Identifier for the JSON file (without extension).
   * @returns {void}
   */
  delete(id) {
    const deletePath = path.join(this.directory, `${id}.json`);
    if (fs.existsSync(deletePath)) {
      fs.rmSync(deletePath);
    }
  }
}

export default JsonDB;
