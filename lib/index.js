const assert = require('assert-plus');
const CF = require('./cf');
const utils = require('./file.utils');
const log = require('./logging');

const envPattern = /^([A-Za-z0-9_]+)=(.*)$/;

const parseEnv = (line) => {
  const match = envPattern.exec(line);
  assert.bool(match && match.length > 2, 'Line is not valid environment variable definition');
  return [match[1], match[2]];
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

  const filterParamsUsingTemplate = (template, params) => {
    const templateParams = new Set(Object.keys(template.Parameters));
    return Object.keys(params).filter(templateParams.has.bind(templateParams)).reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  };

  const processEnv = (template, env) => {
    const containerDef = template.Resources.TaskDefinition.Properties.ContainerDefinitions[0];
    containerDef.Environment = env;
    return template;
  };

  const paramLens = (params) => {
    return (key) => {
      const param = params.find(p => p.ParameterKey === key) || {};
      return (param.UsePreviousValue) ? 'current' : param.ParameterValue;
    };
  };

  const mergeParameters = (existingParams, newParams) => {
    const paramList = Object.keys(newParams).filter(k => newParams[k]).reduce((acc, key) => {

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

    // create a Set out of the new param keys so we can find all existing parameters which are not provided in newParams
    const paramSet = new Set(Object.keys(newParams).filter(k => newParams[k]));

    // get all existing params that are not provided
    const remainingParams = Object.keys(existingParams)
                                  .filter(k => !paramSet.has(k))
                                  .map(k => ({
                                    ParameterKey: k,
                                    UsePreviousValue: true
                                  }));
    return paramList.concat(remainingParams);
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
      // ensure we remove parameters that are not defined in the template
      // This can occur when someone updates an existing stack and removes some previous parameters
      const existingParamsInTemplate = filterParamsUsingTemplate(template, existingParams);
      const templateParams = mergeParameters(existingParamsInTemplate, newParams);
      const params = paramLens(templateParams);
      log.details(`version: ${params(VERSION_PARAM)}`);
      log.details(`scale: ${params(SCALE_PARAM)}`);
      const body = (env.length) ? processEnv(template, env) : template;
      return stackOperation(stackname, templateParams, JSON.stringify(body), tags);
    };
  };

  const run = (stackname, version, options) => {

    const envPromise = getEnv(options.envFilePath);
    const templatePromise = cf.getTemplate(stackname);
    const existingParamsPromise = cf.getParameters(stackname);
    const paramsPromise = existingParamsPromise.then(params => Object.assign({}, params, {
      [VERSION_PARAM]: version,
      [SCALE_PARAM]: options.scale
    }));
    const tagPromise = getTags(options.tagFilePath);

    log.info(`Updating ${stackname}`);
    const start = new Date();
    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.update).apply(null, args))
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => log.success(`Finished updating ${stackname}`))
                  .then(() => log.elapsed(start, new Date()));
  };

  const stop = (stackname) => run(stackname, null, {scale: '0'});

  const update = (stackname, version, templateFilePath, paramsFilePath, options) => {
    const templatePromise = utils.read(templateFilePath).then(JSON.parse);

    const paramsPromise = getParamsFromFile(paramsFilePath, {
      [VERSION_PARAM]: version,
      [SCALE_PARAM]: options.scale
    });
    const envPromise = getEnv(options.envFilePath);
    const tagPromise = getTags(options.tagFilePath);

    // need to remove any parameters that are no longer defined in the template
    const existingParamsPromise = Promise.all([templatePromise, cf.getParameters(stackname)])
                                         .then(([template, params]) => filterParamsUsingTemplate(template, params));

    log.info(`Updating ${stackname}`);
    const start = new Date();
    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.update).apply(null, args))
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => log.success(`Finished updating ${stackname}`))
                  .then(() => log.elapsed(start, new Date()));
  };

  const create = (stackname, version, templateFilePath, paramsFilePath, options) => {
    const templatePromise = utils.read(templateFilePath).then(JSON.parse);
    const paramsPromise = getParamsFromFile(paramsFilePath, {
      [VERSION_PARAM]: version,
      [SCALE_PARAM]: options.scale
    });
    const existingParamsPromise = Promise.resolve({});
    const envPromise = getEnv(options.envFilePath);
    const tagPromise = getTags(options.tagFilePath);

    log.info(`Creating ${stackname}`);
    const start = new Date();
    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.create).apply(null, args))
                  .then(() => cf.waitForExist(stackname))
                  .then(() => cf.waitForCreate(stackname))
                  .then(() => log.success(`Finished creating ${stackname}`))
                  .then(() => log.elapsed(start, new Date()));
  };

  const destroy = (stackname) => {
    log.info(`Deleting ${stackname}`);
    return cf.destroy(stackname)
             .then(() => {
               return cf.waitForDelete(stackname);
             })
             .then(() => log.success(`Finished deleting ${stackname}`));
  };

  return {
    run,
    stop,
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
