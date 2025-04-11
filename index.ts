/**
 * node-env-obj - The federated real-time open data platform
 * Copyright (C) 2016-2025 Data People Connected LTD.
 * <https://www.dpc-ltd.com/>
 *
 * This file is part of node-env-obj.
 * node-env-obj is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public Licence as published by the Free Software
 * Foundation, either version 3 of the Licence, or (at your option) any later version.
 * node-env-obj is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public Licence for more details.
 * You should have received a copy of the GNU Affero General Public Licence along with
 * this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import * as process from "node:process";

interface ConfigOptions {
  basePath: string;
  envPath: string;
  envFile: string;
  configPath: string;
  configFile: string;
  verbose: boolean;
  envFullPath: string;
  configFullPath: string;
}
interface ConfigOptionsIn {
  basePath?: string;
  envPath?: string;
  envFile?: string;
  configPath?: string;
  configFile?: string;
  verbose?: boolean;
}

interface EnvObject {
  [key: string]: EnvObjectValue;
}
type EnvObjectValue = string | EnvObject | string[] | EnvObject[] | undefined;

interface ConfigObject {
  global: {
    [key: string]: EnvObjectValue;
  };
  environment: {
    [key: string]: string;
  };
}

/**
 * @type {{development: string, production: string, test: string}}
 * @private
 */
const getEnvKey = (env: string) => {
  if (env === 'development') return 'dev';
  else if (env === 'test') return 'test';
  return 'prod';
};
const _regEx = /%(\w+)%/g;

/**
 * @class Config
 *
 */
export class Config {
  private _options: ConfigOptions;

  private _envKey: string;

  private _settings: EnvObject;

  constructor(opts?: ConfigOptionsIn) {
    const _env = process.env['NODE_ENV'] || 'production';
    this._envKey = getEnvKey(_env);

    // Merge user options with defaults
    this._options = {
      basePath: path.dirname(process.argv[1]),
      envPath: '/',
      envFile: `.${_env}.env`,
      configPath: '/',
      configFile: `config.json`,
      envFullPath: '',
      configFullPath: '',
      verbose: false,
      ...opts
    };

    // Build our full paths
    this._options.envFullPath = path.join(this._options.basePath, this._options.envPath, this._options.envFile);
    this._options.configFullPath = path.join(this._options.basePath, this._options.configPath, this._options.configFile);

    // Remerge out user options again in case they've overwritten the full paths
    this._options = {
      ...this._options,
      ...opts
    };

    if (fs.existsSync(this._options.envFullPath)) {
      const envFileData = this._parseEnvFile(fs.readFileSync(this._options.envFullPath, { encoding: 'utf8' }));
      Object.keys(envFileData).forEach(key => process.env[key] = envFileData[key]);

      if (this._options.verbose) {
        console.info(`node-env-obj: Loaded ${this._options.envFullPath} into environment variables.`);
      }
    }

    this._settings = this._loadSettings(process.env);
    this._settings.env = this._envKey;
  }

  get compiled(): EnvObject {
    return this._settings;
  }

  // Use the following to get a specific value from the config object.
  get(path: string): string | undefined {
    const parts = path.toString().split('.');
    let prop: EnvObject | EnvObjectValue | undefined = this._settings;

    for (let i = 0; i < parts.length; i += 1) {
      if (!prop) return undefined;
      const part = parts[i];
      if (this._isEnvObject(prop)) {
        prop = (prop as EnvObject)[part];
      }
    }

    if (typeof prop !== 'string') {
      if (this._options.verbose) {
        console.warn(`WARN: The property ${path} is not a string.`);
      }
      return undefined;
    }

    return prop;
  }

  getEnvObject(path: string): EnvObject | undefined {
    const parts = path.toString().split('.');
    let prop: EnvObject | EnvObjectValue | undefined = this._settings;

    for (let i = 0; i < parts.length; i += 1) {
      if (!prop) return undefined;
      const part = parts[i];
      if (this._isEnvObject(prop)) {
        prop = (prop as EnvObject)[part];
      }
    }

    if (this._isEnvObject(prop) === false) {
      if (this._options.verbose) {
        console.warn(`WARN: The property ${path} is not a EnvObject.`);
      }
      return undefined;
    }

    return prop as EnvObject;
  }

  _loadSettings(env: { [key: string]: string | undefined }): EnvObject {
    const json = fs.readFileSync(this._options.configFullPath);
    const raw: unknown = JSON.parse(json.toString());
    const settings = this._loadSettingsObject(raw);

    // Build our settings environment object.
    for (const variable in settings.environment) {
      if (!env[variable] && !settings.environment[variable] && this._options.verbose) {
        console.warn(`WARN: You must specify the ${variable} environment variable`);
      }

      if (env[variable]) {
        settings.environment[variable] = this._resolveReferences(env[variable], env);
      } else {
        settings.environment[variable] = this._resolveReferences(settings.environment[variable], settings.environment);
      }
    }

    // Flatten env var selection.
    if (settings.global) {
      this._flatternEnvObjectOptions(settings.global);

      // Apply the environment variables to the global object.
      this._applyEnvVars(settings.global, settings.environment || {});
    }

    return settings.global || {};
  }

  private _loadSettingsObject(raw: unknown): ConfigObject {
    const settings : ConfigObject = {
      global: {},
      environment: {}
    };

    if (raw instanceof Object === false || Array.isArray(raw)) throw new Error(`Config file ${this._options.configFullPath} is expected to be an object.`);

    if (typeof raw === 'object' && raw !== null) {
      if ('environment' in raw && raw['environment'] instanceof Object) {
        const env = raw['environment'] as { [key: string] : unknown };
        for (const variable in env) {
          if (typeof env[variable] === 'string' || typeof env[variable] === 'number' || typeof env[variable] === 'boolean') {
            settings.environment[variable] = env[variable].toString();
          } else if (this._options.verbose) {
            console.warn(`WARN: The property ${variable} in environment should be a string.`);
          }
        }
      }

      if ('global' in raw && raw['global'] instanceof Object) {
        const global = raw['global'] as EnvObject;
        for (const variable in global) {
          if (this._isEnvObject(global[variable])) {
            settings.global[variable] = global[variable];
          } else if (typeof global[variable] === 'string') {
            settings.global[variable] = global[variable];
          } else if (Array.isArray(global[variable])) {
            settings.global[variable] = global[variable];
          }
        }
      }
    }

    return settings;
  }

  private _isEnvObject = function (value: EnvObjectValue) {
    return value instanceof Object && !Array.isArray(value);
  };

  private _applyEnvVars(root: EnvObject, env: { [key: string]: string }) {
    for (const variable in root) {
      const value = root[variable];
      if (this._isEnvObject(value)) {
        this._applyEnvVars(value as EnvObject, env);
      } else if (typeof root[variable] === 'string') {
        root[variable] = this._resolveReferences(root[variable], env);
      }
    }
  };

  private _resolveReferences = function (target: string, values: { [key: string]: string | undefined }) {
    const matches = target.match(_regEx);

    if (matches) {
      matches.forEach((match) => {
        const key = match.replace(/%/g, '');
        if (typeof values[key] === 'string') {
          target = target.replace(`%${key}%`, values[key]);
        }
      });
    }

    return target;
  };

  private _flatternEnvObjectOptions(objectValue: EnvObjectValue) {
    if (objectValue instanceof Object === false) return;

    if (Array.isArray(objectValue)) {
      for (const value of objectValue) {
        this._flatternEnvObjectOptions(value);
      }
    } else {
      for (const key in objectValue) {
        const value = objectValue[key];
        if (value instanceof Object) {
          if (!Array.isArray(value) && this._envKey in value && typeof value[this._envKey] === 'string') {
            objectValue[key] = value[this._envKey];
          } else {
            this._flatternEnvObjectOptions(value);
          }
        }
      }
    }
  };

  private _parseEnvFile(data: string) {
    return data.split('\n').reduce((obj: { [key: string]: string }, line) => {
      const lineSplit = line.split('=');
      if (lineSplit.length > 0) {
        const key = lineSplit.shift();
        const value = lineSplit.join('=');
        if (key === undefined || key === '' || key.indexOf('#') >= 0) return obj;
        obj[key] = value;
      }
      return obj;
    }, {});
  };
}

let _instance: Config | null = null;

export function get(path: string): string | undefined {
  if (!_instance) {
    throw new Error('Config instance not created. Please create an instance before calling getValue.');
  }
  return _instance.get(path);
}

export function getEnvObject(path: string): EnvObject | undefined {
  if (!_instance) {
    throw new Error('Config instance not created. Please create an instance before calling getEnvObject.');
  }
  return _instance.getEnvObject(path);
}

export default (args?: ConfigOptionsIn): EnvObject => {
  if (!_instance) {
    _instance = new Config(args);
  }

  return _instance.compiled;
};