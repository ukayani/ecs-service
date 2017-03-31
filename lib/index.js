const assert = require('assert-plus');
const CF = require('./cf');
const utils = require('./file.utils');
const chalk = require('chalk');

const envPattern = /^([A-Za-z0-9_]+)=(.*)$/;

const parseEnv = (line) => {
  const match = envPattern.exec(line);
  assert.bool(match && match.length > 2, 'Line is not valid environment variable definition');
  return [match[1], match[2]];
};

const logInfo = (message) => {
  console.log(chalk.blue(message));
};

const logSuccess = (message) => {
  console.log(chalk.green(message));
};

const create = (client) => {
  const cf = CF.create(client);

  const VERSION_PARAM = 'AppVersion';
  const SCALE_PARAM = 'AppDesiredCount';

  const contentToArray = (content) => {
    return content.trim().split('\n')
                  .filter(line => line.length > 0 && !line.startsWith('#'))
                  .map(line => {
                    const [key, value] = parseEnv(line);
                    return {
                      Name: key.trim(),
                      Value: value.trim()
                    };
                  });
  };

  const toTagArray = (tags) => {
    return Object.keys(tags).map(key => ({
      Key: key,
      Value: tags[key]
    }));
  };

  const getTags = (path) => path ? utils.read(path, '{}').then(JSON.parse).then(toTagArray) : Promise.resolve([]);
  const getEnv = (path) => path ? utils.read(path).then(contentToArray) : Promise.resolve([]);

  const getParamsFromFile = (path, overrides) => {
    return path ? utils.read(path, '{}').then(JSON.parse)
                       .then(params => Object.assign({}, params, overrides)) : Promise.resolve();
  };

  const processEnv = (template, env) => {
    const containerDef = template.Resources.TaskDefinition.Properties.ContainerDefinitions[0];
    containerDef.Environment = env;
    return template;
  };

  const mergeParameters = (existingParams, newParams) => {
    return Object.keys(newParams).filter(k => newParams[k]).reduce((acc, key) => {
      if (existingParams[key] && existingParams[key] === newParams[key]) {
        return acc.concat([{
          ParameterKey: key,
          UsePreviousValue: true
        }]);
      }

      return acc.concat([{
        ParameterKey: key,
        ParameterValue: newParams[key]
      }]);
    }, []);
  };

  /**
   * Process a stack with the given stack operation (create / update)
   * @param stackname
   * @param stackOperation - cf.create or cf.update
   * @param existingParams - existing parameters for the stack if any
   * @param newParams - new parameters for the stack
   * @param template - template body
   * @param env - a list of env vars - will overwrite existing envs if non empty
   * @param tags - a list of tags for the stack - will overwrite existing tags if non empty
   */
  const processStack = (stackname, stackOperation) => {
    return (template, existingParams, newParams, env, tags) => {
      const templateParams = mergeParameters(existingParams, newParams);
      const body = (env.length) ? processEnv(template, env) : template;
      return stackOperation(stackname, templateParams, JSON.stringify(body), tags);
    };
  };

  const run = (stackname, version, options) => {

    const envPromise = getEnv(options.envFilePath);
    const templatePromise = cf.getTemplate(stackname);
    const existingParamsPromise = cf.getParameters(stackname);
    const paramsPromise = existingParamsPromise.then(params => Object.assign({}, params,
      {
        [VERSION_PARAM]: version,
        [SCALE_PARAM]: options.scale
      }));
    const tagPromise = getTags(options.tagFilePath);

    logInfo(`Updating ${stackname} to ${version}`);
    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.update).apply(null, args))
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => logSuccess(`Finished updating ${stackname}`));
  };

  const update = (stackname, version, templateFilePath, paramsFilePath, options) => {
    const templatePromise = utils.read(templateFilePath).then(JSON.parse);

    const paramsPromise = getParamsFromFile(paramsFilePath,
      {
        [VERSION_PARAM]: version,
        [SCALE_PARAM]: options.scale
      });
    const envPromise = getEnv(options.envFilePath);
    const tagPromise = getTags(options.tagFilePath);
    const existingParamsPromise = cf.getParameters(stackname);

    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.update).apply(null, args))
                  .then(() => logSuccess(`Updating ${stackname}`))
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => logSuccess(`Finished updating ${stackname}`));
  };

  const create = (stackname, version, templateFilePath, paramsFilePath, options) => {
    const templatePromise = utils.read(templateFilePath).then(JSON.parse);
    const paramsPromise = getParamsFromFile(paramsFilePath,
      {
        [VERSION_PARAM]: version,
        [SCALE_PARAM]: options.scale
      });
    const existingParamsPromise = Promise.resolve({});
    const envPromise = getEnv(options.envFilePath);
    const tagPromise = getTags(options.tagFilePath);

    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.create).apply(null, args))
                  .then(() => cf.waitForExist(stackname))
                  .then(() => logSuccess(`Creating ${stackname}`))
                  .then(() => cf.waitForCreate(stackname))
                  .then(() => logSuccess(`Finished creating ${stackname}`));
  };

  const destroy = (stackname) => {
    logInfo(`Deleting ${stackname}`);
    return cf.destroy(stackname)
             .then(() => {
               return cf.waitForDelete(stackname);
             })
             .then(() => logSuccess(`Finished deleting ${stackname}`));
  };

  return {
    run,
    create,
    destroy,
    update
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
