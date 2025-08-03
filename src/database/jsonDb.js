import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

class JsonDatabase {
  constructor(dbPath = 'data/ocr_results.json') {
    this.dbPath = dbPath;
    this.ensureDbExists();
  }

  async ensureDbExists() {
    try {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

      try {
        await fs.access(this.dbPath);
      } catch {
        const initialData = {
          records: [],
          metadata: { created: new Date().toISOString() }
        };
        await this.writeData(initialData);
      }
    } catch (error) {
      console.error('Error ensuring database exists:', error);
    }
  }

  async readData() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        records: [],
        metadata: { created: new Date().toISOString() }
      };
    }
  }

  async writeData(data) {
    await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
  }

  async createRecord(imagePath, ocrResults, metadata = {}) {
    const data = await this.readData();

    // Check if record already exists for this image path
    const existingRecordIndex = data.records.findIndex((record) => record.imagePath === imagePath);

    if (existingRecordIndex !== -1) {
      // Update existing record
      data.records[existingRecordIndex] = {
        ...data.records[existingRecordIndex],
        ocrResults,
        metadata,
        updatedAt: new Date().toISOString()
      };
      await this.writeData(data);
      return data.records[existingRecordIndex].id;
    } else {
      // Create new record
      const recordId = uuidv4();
      const record = {
        id: recordId,
        imagePath,
        createdAt: new Date().toISOString(),
        ocrResults,
        metadata
      };
      data.records.push(record);
      await this.writeData(data);
      return recordId;
    }
  }

  async getRecord(recordId) {
    const data = await this.readData();
    return data.records.find((record) => record.id === recordId) || null;
  }

  async getRecordByImagePath(imagePath) {
    const data = await this.readData();
    return data.records.find((record) => record.imagePath === imagePath) || null;
  }

  async getAllRecords() {
    const data = await this.readData();
    return data.records;
  }

  async updateRecord(recordId, updates) {
    const data = await this.readData();
    const recordIndex = data.records.findIndex((record) => record.id === recordId);

    if (recordIndex !== -1) {
      data.records[recordIndex] = {
        ...data.records[recordIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await this.writeData(data);
      return true;
    }

    return false;
  }

  async deleteRecord(recordId) {
    const data = await this.readData();
    const originalCount = data.records.length;
    data.records = data.records.filter((record) => record.id !== recordId);

    if (data.records.length < originalCount) {
      await this.writeData(data);
      return true;
    }

    return false;
  }

  async searchRecords(query) {
    const data = await this.readData();
    const results = [];

    for (const record of data.records) {
      for (const ocrResult of record.ocrResults || []) {
        if (ocrResult.text && ocrResult.text.toLowerCase().includes(query.toLowerCase())) {
          results.push(record);
          break;
        }
      }
    }

    return results;
  }

  async getStats() {
    const data = await this.readData();
    const records = data.records;

    return {
      totalRecords: records.length,
      totalTextElements: records.reduce((sum, record) => sum + (record.ocrResults?.length || 0), 0),
      created: data.metadata?.created,
      lastRecord: records.length > 0 ? records[records.length - 1].createdAt : null
    };
  }
}

export default JsonDatabase;
