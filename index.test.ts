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

Deno.test('Should createConfig, with test3.json.', () => {
  const config = new Config({ configFile: 'test_data/test3.json' });
  
  assertEquals(config.get('STRING'), 'ABC');
  assertEquals(config.get('NUMBER'), '2');
  assertEquals(config.get('BOOL'), 'true');
  assertEquals(config.get('OBJECT'), '%OBJECT%');
  assertEquals(config.get('ARRAY'), '%ARRAY%');
});

// Writes a config.json and env file into a temp dir, then builds a Config from them.
// Each test uses its own variable names: env file values are copied into process.env and
// would otherwise leak into later tests.
const configFromFiles = (environment: { [key: string]: string }, global: { [key: string]: string }, envFileData: string) => {
  const dir = Deno.makeTempDirSync({ prefix: 'node-env-obj-test-' });
  try {
    Deno.writeTextFileSync(`${dir}/config.json`, JSON.stringify({ environment, global }));
    Deno.writeTextFileSync(`${dir}/.test.env`, envFileData);
    return new Config({ basePath: dir, envFile: '.test.env', configFile: 'config.json' });
  } finally {
    Deno.removeSync(dir, { recursive: true });
  }
};

Deno.test('Should keep dollar signs in env file values exactly.', () => {
  const config = configFromFiles(
    { DOLLAR_ONE: '', DOLLAR_TWO: '', DOLLAR_MATCH: '', DOLLAR_SIDES: '' },
    {
      one: '%DOLLAR_ONE%',
      two: '%DOLLAR_TWO%',
      match: '%DOLLAR_MATCH%',
      sides: 'before-%DOLLAR_SIDES%-after',
    },
    [
      'DOLLAR_ONE=pa$word',
      'DOLLAR_TWO=pa$$word',
      'DOLLAR_MATCH=pa$&word',
      'DOLLAR_SIDES=$`$\'$1',
    ].join('\n'),
  );

  assertEquals(config.get('one'), 'pa$word');
  assertEquals(config.get('two'), 'pa$$word');
  assertEquals(config.get('match'), 'pa$&word');
  assertEquals(config.get('sides'), 'before-$`$\'$1-after');
});

Deno.test('Should keep dollar signs in config defaults and env vars exactly.', () => {
  process.env.DOLLAR_PROCESS = 'x$$y$&z';
  const config = configFromFiles(
    { DOLLAR_DEFAULT: 'pa$$word', DOLLAR_PROCESS: '', DOLLAR_REF: '%DOLLAR_DEFAULT%!' },
    { fromDefault: '%DOLLAR_DEFAULT%', fromProcess: '%DOLLAR_PROCESS%', fromRef: '%DOLLAR_REF%' },
    '',
  );

  assertEquals(config.get('fromDefault'), 'pa$$word');
  assertEquals(config.get('fromProcess'), 'x$$y$&z');
  assertEquals(config.get('fromRef'), 'pa$$word!');
});

Deno.test('Should strip one pair of matching quotes from env file values.', () => {
  const config = configFromFiles(
    {
      QUOTE_DOUBLE: '', QUOTE_SINGLE: '', QUOTE_SPACES: '', QUOTE_TWICE: '', QUOTE_EMPTY: '',
      QUOTE_MISMATCHED: '', QUOTE_LONE: '', QUOTE_INSIDE: '', QUOTE_APOSTROPHE: '', QUOTE_OPEN: '',
    },
    {
      double: '%QUOTE_DOUBLE%',
      single: '%QUOTE_SINGLE%',
      spaces: '%QUOTE_SPACES%',
      twice: '%QUOTE_TWICE%',
      empty: '[%QUOTE_EMPTY%]',
      mismatched: '%QUOTE_MISMATCHED%',
      lone: '%QUOTE_LONE%',
      inside: '%QUOTE_INSIDE%',
      apostrophe: '%QUOTE_APOSTROPHE%',
      open: '%QUOTE_OPEN%',
    },
    [
      'QUOTE_DOUBLE="a.example.com,b.example.com"',
      "QUOTE_SINGLE='pa$$word'",
      'QUOTE_SPACES=" padded "',
      'QUOTE_TWICE=""twice""',
      'QUOTE_EMPTY=""',
      'QUOTE_MISMATCHED="abc\'',
      'QUOTE_LONE="',
      'QUOTE_INSIDE=a"b"c',
      "QUOTE_APOSTROPHE=it's",
      'QUOTE_OPEN="abc',
    ].join('\n'),
  );

  assertEquals(config.get('double'), 'a.example.com,b.example.com');
  assertEquals(config.get('single'), 'pa$$word');
  assertEquals(config.get('spaces'), ' padded ');
  assertEquals(config.get('twice'), '"twice"');
  assertEquals(config.get('empty'), '[]');
  assertEquals(config.get('mismatched'), '"abc\'');
  assertEquals(config.get('lone'), '"');
  assertEquals(config.get('inside'), 'a"b"c');
  assertEquals(config.get('apostrophe'), "it's");
  assertEquals(config.get('open'), '"abc');
});

Deno.test('Should trim whitespace and CRLF line endings around env file keys and values.', () => {
  const config = configFromFiles(
    { TRIM_CRLF: '', TRIM_TRAILING: '', TRIM_AROUND: '', TRIM_QUOTED_CRLF: '', TRIM_INNER: '' },
    {
      crlf: '%TRIM_CRLF%',
      trailing: '%TRIM_TRAILING%',
      around: '%TRIM_AROUND%',
      quotedCrlf: '%TRIM_QUOTED_CRLF%',
      inner: '%TRIM_INNER%',
    },
    [
      'TRIM_CRLF=crlf-value',
      'TRIM_TRAILING=trailing   ',
      '  TRIM_AROUND  =  around  ',
      'TRIM_QUOTED_CRLF="quoted"',
      '',
      'TRIM_INNER=a b  c',
      '',
    ].join('\r\n'),
  );

  assertEquals(config.get('crlf'), 'crlf-value');
  assertEquals(config.get('trailing'), 'trailing');
  assertEquals(config.get('around'), 'around');
  assertEquals(config.get('quotedCrlf'), 'quoted');
  assertEquals(config.get('inner'), 'a b  c');
  assertEquals(process.env['TRIM_CRLF'], 'crlf-value');
  assertEquals(process.env['\r'], undefined);
});
