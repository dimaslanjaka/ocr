import JsonDatabase from './jsonDb.js';
import { pathToFileURL } from 'url';

async function testDatabase() {
  const db = new JsonDatabase('test_data/test_ocr.json');

  console.log('Testing JSON Database...');

  // Test creating a record
  const recordId = await db.createRecord(
    'test/image.jpg',
    [
      {
        text: 'Sample text',
        confidence: 0.95,
        bbox: [
          [0, 0],
          [100, 0],
          [100, 30],
          [0, 30]
        ]
      },
      {
        text: '1234 5678 9012 3456',
        confidence: 0.98,
        bbox: [
          [0, 40],
          [200, 40],
          [200, 70],
          [0, 70]
        ]
      }
    ],
    { source: 'test', version: '1.0' }
  );

  console.log('Created record:', recordId);

  // Test getting a record
  const record = await db.getRecord(recordId);
  console.log('Retrieved record:', record?.id);

  // Test search
  const searchResults = await db.searchRecords('1234');
  console.log('Search results:', searchResults.length);

  // Test stats
  const stats = await db.getStats();
  console.log('Database stats:', stats);

  console.log('All tests completed!');
}

// Convert require.main check to ESM equivalent
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  testDatabase().catch(console.error);
}
