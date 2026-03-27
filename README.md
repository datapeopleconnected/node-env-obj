# node-env-obj

Compile environment variables into a predefined JSON object structure.

The library can:

- Load an env file (for example `.production.env`) into `process.env`
- Read a JSON config template
- Replace `%VAR_NAME%` placeholders from environment values
- Expose resolved values through a singleton API or a `Config` instance

## Install

```bash
deno add jsr:@dpc/node-env-obj
```

## Quick Start

```ts
import config from "jsr:@dpc/node-env-obj";

const settings = config({
  configFile: "example.config.json",
});

console.log(settings.app?.title);
```

The default export is a singleton initializer. The first call creates the internal config instance; later calls reuse it.

## Example Config File

```json
{
  "environment": {
    "PROJECT_NAME": "helloworld",
    "PROJECT_URL": "http://example.com"
  },
  "global": {
    "app": {
      "title": "%PROJECT_NAME%",
      "url": "%PROJECT_URL%",
      "api": "%PROJECT_URL%/api/v1/"
    }
  }
}
```

`environment` contains default values. Runtime env vars override these defaults.

## API

### Default export

```ts
import config from "jsr:@dpc/node-env-obj";

const compiled = config(options);
```

Creates the singleton `Config` instance (once) and returns the compiled `global` object.

### `Config` class

```ts
import { Config } from "jsr:@dpc/node-env-obj";

const cfg = new Config({ configFile: "example.config.json" });
console.log(cfg.compiled);
```

### `get(path)`

```ts
import config, { get } from "jsr:@dpc/node-env-obj";

config({ configFile: "example.config.json" });
console.log(get("app.title"));
```

Returns a string value for a dotted path, or `undefined`.

### `getEnvObject(path)`

```ts
import config, { getEnvObject } from "jsr:@dpc/node-env-obj";

config({ configFile: "example.config.json" });
console.log(getEnvObject("app"));
```

Returns an object value for a dotted path, or `undefined`.

## Options

```ts
interface ConfigOptionsIn {
  basePath?: string;
  envPath?: string;
  envFile?: string;
  configPath?: string;
  configFile?: string;
  verbose?: boolean;
}
```

Defaults:

- `basePath`: `path.dirname(process.argv[1])`
- `envPath`: `/`
- `envFile`: `.${NODE_ENV || "production"}.env`
- `configPath`: `/`
- `configFile`: `config.json`
- `verbose`: `false`

## Environment Selection Keys

For objects that contain environment-specific values, the selected key is based on `NODE_ENV`:

- `development` -> `dev`
- `staging` -> `staging`
- `test` -> `test`
- anything else -> `prod`

Example:

```json
{
  "global": {
    "serviceUrl": {
      "dev": "http://localhost:3000",
      "staging": "https://staging.example.com",
      "prod": "https://example.com"
    }
  }
}
```

## Notes

- `get()` and `getEnvObject()` throw if the singleton was not initialized first.
- Placeholder format is `%VARIABLE_NAME%`.