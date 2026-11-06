const path = require('node:path');
const dotenv = require('dotenv');

// Explicit paths also work when the new entry point is launched from the project root.
// Existing environment variables have priority; the original .env is never edited.
function loadEmailEnvironment() {
  const backendRoot = path.resolve(__dirname, '../..');
  for (const filename of ['.env.email.local', '.env']) {
    const result = dotenv.config({ path: path.join(backendRoot, filename) });
    if (result.error && result.error.code !== 'ENOENT') throw result.error;
  }
}

module.exports = { loadEmailEnvironment };
