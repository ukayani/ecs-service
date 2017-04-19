const CF = require('./cf');
const utils = require('./file.utils');
const log = require('./logging');
const env = require('./env');
const tags = require('./tags');

const create = (client) => {
  const cf = CF.create(client);

  const VERSION_PARAM = 'AppVersion';
  const SCALE_PARAM = 'AppDesiredCount';

  const DEFAULT_TAGS = [{
    Key: 'ComponentType',
    Value: 'ECS-Service'
  }];

  const addDefaultTags = (exists) => (tags) => {
    if (!exists) {
      // creating stack for first time so lets add the default tags
      return tags.concat(DEFAULT_TAGS);
    }

    // tags are being updated so lets include defaults
    return (tags.length) ? tags.concat(DEFAULT_TAGS): tags;
  };

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

  const update = (stackname, version, options) => {

    const envPromise = env.read(options.envFilePath);
    const templatePromise = cf.getTemplate(stackname);
    const existingParamsPromise = cf.getParameters(stackname);
    const paramsPromise = existingParamsPromise.then(params => Object.assign({}, params, {
      [VERSION_PARAM]: version,
      [SCALE_PARAM]: options.scale
    }));
    const tagPromise = tags.read(options.tagFilePath).then(addDefaultTags(true));

    log.info(`Updating ${stackname}`);
    const start = new Date();
    return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                  .then(args => processStack(stackname, cf.update).apply(null, args))
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => log.success(`Finished updating ${stackname}`))
                  .then(() => log.elapsed(start, new Date()));
  };

  const stop = (stackname) => update(stackname, null, {scale: '0'});

  const deploy = (stackname, version, templateFilePath, paramsFilePath, options) => {

    return cf.exists(stackname).then(exists => {

      const templatePromise = utils.read(templateFilePath).then(JSON.parse);
      const paramsPromise = getParamsFromFile(paramsFilePath, {
        [VERSION_PARAM]: version,
        [SCALE_PARAM]: options.scale
      });

      const envPromise = env.read(options.envFilePath);
      const tagPromise = tags.read(options.tagFilePath)
                             .then(addDefaultTags(exists));

      const stackOp = (exists) ? cf.update : cf.create;
      const operationName = (exists) ? 'Updating' : 'Creating';
      // need to remove any parameters that are no longer defined in the template in the case that the stack exists
      const existingParamsPromise = (exists) ? Promise.all([templatePromise, cf.getParameters(stackname)])
                                                      .then(([template, params]) => filterParamsUsingTemplate(template,
                                                        params)) : Promise.resolve({});

      if (!exists) {
        log.details('No existing service found');
      } else {
        log.details('Service already exists');
      }

      log.info(`${operationName} ${stackname}`);
      const waitForCompletion = (exists) ? cf.waitForUpdate : cf.waitForCreate;

      const start = new Date();
      return Promise.all([templatePromise, existingParamsPromise, paramsPromise, envPromise, tagPromise])
                    .then(args => processStack(stackname, stackOp).apply(null, args))
                    .then(() => waitForCompletion(stackname))
                    .then(() => log.success(`Finished ${operationName.toLowerCase()} ${stackname}`))
                    .then(() => log.elapsed(start, new Date()));

    });

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
    update,
    stop,
    deploy,
    destroy
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
