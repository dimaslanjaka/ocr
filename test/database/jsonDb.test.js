import JsonDB from '../../src/database/jsonDb.js';
import fs from 'fs-extra';
import path from 'path';

const TEST_DIR = path.join(process.cwd(), 'tmp/jsondb');

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('JsonDB', () => {
  beforeEach(() => {
    cleanup();
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    cleanup();
  });

  it('should save and load data', () => {
    const db = new JsonDB(TEST_DIR);
    const data = { foo: 'bar', num: 42 };
    db.save('test1', data);
    const loaded = db.load('test1');
    expect(loaded).toEqual(data);
  });

  it('should delete data', () => {
    const db = new JsonDB(TEST_DIR);
    db.save('test2', { a: 1 });
    db.delete('test2');
    expect(() => db.load('test2')).toThrow();
  });

  it('should load all data', () => {
    const db = new JsonDB(TEST_DIR);
    db.save('a', { a: 1 });
    db.save('b', { b: 2 });
    const all = db.loadAll();
    const values = all.map((obj) => Object.values(obj)[0]);
    expect(values).toContain(1);
    expect(values).toContain(2);
  });

  it('should support circular references', () => {
    const db = new JsonDB(TEST_DIR);
    const obj = { name: 'circular' };
    obj.self = obj;
    db.save('circ', obj);
    const loaded = db.load('circ');
    expect(loaded.name).toBe('circular');
    expect(loaded.self).toBe(loaded);
  });

  it('should load all data as stream', async () => {
    const db = new JsonDB(TEST_DIR);
    db.save('x', { x: 1 });
    db.save('y', { y: 2 });
    const results = [];
    for await (const item of db.loadAllStream()) {
      results.push(item);
    }
    const values = results.map((obj) => Object.values(obj)[0]);
    expect(values).toContain(1);
    expect(values).toContain(2);
  });

  it('should handle array data', async () => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    const db = new JsonDB(TEST_DIR);
    db.save('custom', ['a', 'b', 'c']);
    const loaded = db.load('custom');
    expect(loaded).toEqual(['a', 'b', 'c']);
    loaded.push('d', 'e', 'f');
    db.save('custom', loaded);
    const reloaded = db.load('custom');
    expect(reloaded).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    const allSync = db.loadAll();
    expect(allSync).toHaveLength(1);
    expect(allSync[0]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    const allStreamResults = [];
    for await (const item of db.loadAllStream()) {
      allStreamResults.push(item);
    }
    expect(allStreamResults).toHaveLength(1);
    expect(allStreamResults[0]).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
