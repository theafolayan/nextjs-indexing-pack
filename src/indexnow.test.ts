import test from 'node:test';
import assert from 'node:assert/strict';

import { submitToIndexNow } from './indexnow';

test('submitToIndexNow requires a fully qualified baseUrl', async () => {
  await assert.rejects(
    submitToIndexNow({ baseUrl: 'example.com', key: 'test-key' }),
    (error: Error) => {
      assert.equal(
        error.message,
        '`baseUrl` must be a fully qualified URL. Received: example.com'
      );
      return true;
    }
  );
});
