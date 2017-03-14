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

  const processEnv = (template, env) => {
    const containerDef = template.Resources.TaskDefinition.Properties.ContainerDefinitions[0];
    containerDef.Environment = env;
    return template;
  };

  const deploy = (stackname, version, envFilePath, tagFilePath) => {

    const envPromise = getEnv(envFilePath);
    const templatePromise = cf.getTemplate(stackname);
    const tagPromise = getTags(tagFilePath);

    return Promise.all([envPromise, templatePromise, tagPromise])
                  .then(([env, template, tags]) => {
                    const templateParameters = Object.keys(template.Parameters).map(key => {
                      return (key === VERSION_PARAM) ? {
                        ParameterKey: key,
                        ParameterValue: version
                      } : {
                        ParameterKey: key,
                        UsePreviousValue: true
                      };
                    });
                    logInfo(`Updating ${stackname} to version ${version}`);
                    const body = (env.length) ? processEnv(template, env) : template;
                    return cf.update(stackname, templateParameters, JSON.stringify(body), tags);
                  })
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => logSuccess(`Finished updating ${stackname}`));
  };

  const create = (stackname, version, templateFilePath, paramsFilePath, envFilePath, tagFilePath) => {
    const templatePromise = utils.read(templateFilePath).then(JSON.parse);
    const paramsPromise = utils.read(paramsFilePath).then(JSON.parse);
    const envPromise = getEnv(envFilePath);

    const tagPromise = getTags(tagFilePath);

    return Promise.all([templatePromise, paramsPromise, envPromise, tagPromise])
                  .then(([template, params, env, tags]) => {
                    params[VERSION_PARAM] = version;
                    const templateParams = Object.keys(params).map(key => {
                      return {
                        ParameterKey: key,
                        ParameterValue: params[key]
                      };
                    });

                    const body = (env.length) ? processEnv(template, env) : template;

                    return cf.create(stackname, templateParams, JSON.stringify(body), tags);
                  })
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
    deploy,
    create,
    destroy
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
