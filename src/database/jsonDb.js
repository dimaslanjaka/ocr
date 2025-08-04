import '../shim.js';

/// Import necessary modules
import CryptoJS from 'crypto-js';
import fs from 'fs-extra';
import path from 'path';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import * as glob from 'glob';

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
    id = this.#hash(id);
    const savePath = path.join(this.directory, `${id}.json`);
    const encoded = jsonStringifyWithCircularRefs(data);
    if (typeof encoded === 'string') writefile(savePath, encoded);
  }

  /**
   * Load data from a JSON file with the given id.
   * @template T
   * @param {string} id - Identifier for the JSON file (without extension).
   * @returns {T} The parsed data (with circular references restored).
   */
  load(id) {
    id = this.#hash(id);
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
    id = this.#hash(id);
    const deletePath = path.join(this.directory, `${id}.json`);
    if (fs.existsSync(deletePath)) {
      fs.rmSync(deletePath);
    }
  }

  /**
   * Load all JSON files in the database directory.
   * @template T
   * @returns {Array<T>} Array of parsed data from all JSON files.
   */
  loadAll() {
    const files = glob.sync('**/*.json', { cwd: this.directory });
    return files.map((file) => {
      const filePath = path.join(this.directory, file);
      const content = fs.readFileSync(filePath, 'utf8');
      return jsonParseWithCircularRefs(content);
    });
  }

  /**
   * Asynchronously load all JSON files in the database directory using glob.stream and file streams.
   * Yields each parsed object one by one.
   * @template T
   * @returns {AsyncGenerator<T>}
   */
  async *loadAllStream() {
    const stream = glob.stream('**/*.json', { cwd: this.directory });
    for await (const file of stream) {
      const filePath = path.join(this.directory, file);
      const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      let data = '';
      for await (const chunk of readStream) {
        data += chunk;
      }
      yield jsonParseWithCircularRefs(data);
    }
  }

  /**
   * Generate an MD5 hash for the given id.
   * @param {string} id - The input string to hash.
   * @returns {string} The MD5 hash of the id.
   */
  #hash(id) {
    return CryptoJS.MD5(id).toString();
  }
}

export default JsonDB;
