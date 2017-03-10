const assert = require('assert-plus');
const CF = require('./cf');
const fs = require('fs');
const path = require('path');
const utils = require('./file.utils');
const chalk = require('chalk');

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
                    const parts = line.split('=');
                    assert.bool(parts.length == 2, 'Invalid line in file. All lines must be of the form A=B');
                    return {
                      Name: parts[0].trim(),
                      Value: parts[1].trim()
                    };
                  });
  };

  const processEnv = (template, env) => {
    const containerDef = template.Resources.TaskDefinition.Properties.ContainerDefinitions[0];
    containerDef.Environment = env;
    return template;
  };

  const update = (stackname, version, envFilePath) => {

    const envFilePromise = utils.read(envFilePath).then(contentToArray);
    const templatePromise = cf.getTemplate(stackname);

    return Promise.all([envFilePromise, templatePromise])
                  .then(params => {
                    const [env, template] = params;
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
                    return cf.update(stackname, templateParameters, JSON.stringify(body));
                  })
                  .then(() => cf.waitForUpdate(stackname))
                  .then(() => logSuccess(`Finished updating ${stackname}`));
  };

  const create = (stackname, version, templateFilePath, paramsFilePath, envFilePath) => {
    const templatePromise = utils.read(templateFilePath);
    const paramsPromise = utils.read(paramsFilePath);
    const envPromise = utils.read(envFilePath);

    return Promise.all([templatePromise, paramsPromise, envPromise])
      .then(contents => {
        const [templateContent, paramsContent, envContent] = contents;

        const template = JSON.parse(templateContent);
        const paramsJson = JSON.parse(paramsContent);
        paramsJson[VERSION_PARAM] = version;
        const params = Object.keys(paramsJson).map(key => {
          return {
            ParameterKey: key,
            ParameterValue: paramsJson[key]
          };
        });

        const env = contentToArray(envContent);

        const body = (env.length) ? processEnv(template, env) : template;

        return cf.create(stackname, params, JSON.stringify(body));
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
    update,
    create,
    destroy
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
