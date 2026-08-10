import assert from 'node:assert';
import test from 'node:test';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { ProviderRegistry } from '../src/registry/provider-registry';

test('ProviderRegistry — Registration and Resolution Invariants', () => {
  ProviderRegistry.clear();

  const memoryProvider = new InMemoryStorageProvider();
  ProviderRegistry.register(memoryProvider);

  assert.strictEqual(ProviderRegistry.has('in-memory'), true);
  assert.strictEqual(ProviderRegistry.has('unknown'), false);

  const resolved = ProviderRegistry.get('in-memory');
  assert.strictEqual(resolved, memoryProvider);

  assert.throws(
    () => {
      ProviderRegistry.get('unregistered-id');
    },
    (err: unknown) => err instanceof Error && err.message.includes('not registered')
  );

  ProviderRegistry.clear();
  assert.strictEqual(ProviderRegistry.has('in-memory'), false);
});
