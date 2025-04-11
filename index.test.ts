// Import the functions or classes to be tested
import * as process from "node:process";
import { assertEquals, assertThrows } from "jsr:@std/assert";

import { Config } from './index.ts';

Deno.test('Should throw error if config file isn\'t found.', () => {
  assertThrows(() => new Config({ configFile: 'non-existent-file.json' }));
});

Deno.test('Should createConfig, with blank config.json.', () => {
  new Config({ configFile: 'test_data/empty.json' });
});

Deno.test('Should createConfig, with test1.json.', () => {
  const config = new Config({ configFile: 'test_data/test1.json' });

  assertEquals(config.compiled.TEST_VAR, 'ABC');
});

Deno.test('Should createConfig, with test2.json.', () => {
  const config = new Config({ configFile: 'test_data/test2.json' });

  assertEquals(config.get('name'), 'ABC');

  assertEquals(config.get('notdefined'), undefined);
  assertEquals(config.get('notdefined.object.path.value'), undefined);

  assertEquals(config.get('app.name'), 'APP: ABC');
  assertEquals(config.get('app.version'), '1.0.0');
  assertEquals(config.get('auth.google.id'), '1234567890-abcde.apps.googleusercontent.com');

  assertEquals(config.getEnvObject('auth.google'), {
    id: '1234567890-abcde.apps.googleusercontent.com'
  });
});

Deno.test('Should overwrite defaults with values from env.', () => {
  process.env.APP_NAME = 'XYZ';
  const config = new Config({ configFile: 'test_data/test2.json' });

  assertEquals(config.get('name'), 'XYZ');
  assertEquals(config.get('app.name'), 'APP: XYZ');
});