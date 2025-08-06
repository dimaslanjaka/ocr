import { spawn } from 'child_process';

/**
 * Spawns a child process asynchronously and returns a promise.
 * @param {string} command - The command to run.
 * @param {string[]} args - List of string arguments.
 * @param {import('child_process').SpawnOptions} [options] - Options for spawn.
 * @returns {Promise<{ stdout: string, stderr: string, code: number, output: string }>}
 */
export function spawnAsync(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      const output = stdout + stderr;
      resolve({ stdout, stderr, code, output });
    });
  });
}

export default { spawnAsync };
