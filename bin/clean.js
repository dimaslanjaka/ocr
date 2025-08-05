import * as glob from 'glob';
import fs from 'fs-extra';

glob
  .stream('**/*', {
    nodir: false,
    cwd: 'tmp',
    absolute: true,
    ignore: ['**/nuitka-cache/**', '**/tesseract-cache/**', '**/vouchers/**/*.json', '**/jest/**', '**/worker-cache/**']
  })
  .on('data', (file) => {
    fs.rmSync(file, { force: true, recursive: true });
  });
