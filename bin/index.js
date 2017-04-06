#!/usr/bin/env node

'use strict';
const pkg = require('../package.json');
const path = require('path');
const assert = require('assert-plus');
const program = require('commander');
const chalk = require('chalk');
const ServiceManager = require('../lib').ServiceManager;
const fs = require('../lib/file.utils');

const showHelp = () => {
  program.outputHelp(chalk.blue);
};

function exitIfFailed(fn) {
  const args = Array.prototype.slice.call(arguments, 1);
  try {
    return fn.apply(null, args);
  } catch (err) {
    console.error(chalk.red(err.message));
    showHelp();
    process.exit(1);
  }
}

const exitOnFailedPromise = (promise) => promise.catch(err => {
  console.error(chalk.red(err.message));
  process.exit(1);
});

const getAWSOptions = (options) => {
  const accessKey = options.accessKeyId;
  const secretKey = options.secretAccessKey;
  const region = options.region;
  const profile = options.profile;

  return {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region,
    profile
  };
};

const createClient = (program) => {
  const options = exitIfFailed(getAWSOptions, program);

  const config = {
    apiVersion: '2010-05-15',
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region
  };

  if (options.profile) {
    // configure the AWS profile if they specified it via options
    process.env.AWS_PROFILE = options.profile;
  }

  // need to load the AWS sdk after we set the process env for AWS_PROFILE
  const AWS = require('aws-sdk');
  const client = new AWS.CloudFormation(config);
  return ServiceManager.create(client, fs);
};

const getServiceOptions = (options) => {
  return {
    tagFilePath: (options.tagFile) ? path.resolve(options.tagFile) : options.tagFile,
    envFilePath: (options.envFile) ? path.resolve(options.envFile) : options.envFile,
    scale: options.scale
  };
};

const runStack = (client, stackname, version, options) => {

  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
    assert.string(version, 'Must provide version');
  };

  exitIfFailed(validate);

  return client.run(stackname, (version === 'current') ? null : version, options);
};

const stopStack = (client, stackname) => {

  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
  };

  exitIfFailed(validate);

  return client.stop(stackname);
};

const processStack = (stackOp, stackname, version, templateFilePath, paramsFilePath, options) => {
  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
    assert.string(version, 'Must provide version');
    assert.string(templateFilePath, 'Must provide CF template file path');
    assert.string(paramsFilePath, 'Must provide parameter file path for CF template');
  };

  exitIfFailed(validate);

  return stackOp(stackname, (version === 'current') ? null : version, path.resolve(templateFilePath),
    path.resolve(paramsFilePath), options);
};

const destroyStack = (client, stackname) => {
  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
  };
  exitIfFailed(validate);
  return client.destroy(stackname);
};

program
  .version(pkg.version)
  .option('-s, --scale <count>', 'Number of instances of service to run')
  .option('-k, --access-key-id <id>', 'AWS Access key ID. Env: $AWS_ACCESS_KEY_ID')
  .option('-s, --secret-access-key <secret>', 'AWS Secret Access Key. Env: $AWS_SECRET_ACCESS_KEY')
  .option('-r, --region <region>', 'AWS Region. Env: $AWS_REGION')
  .option('-p, --profile <name>', 'AWS credential profile to use')
  .option('-e, --env-file <file>', 'A .env file to supply to the container')
  .option('-t, --tag-file <file>', 'A file containing tags for the stack');

program
  .command('create [stackname] [version] [template_file] [params_file]')
  .description('Create ECS service using CF')
  .action((stackname, version, templateFile, paramsFile) => {
    const client = createClient(program);
    const options = getServiceOptions(program);
    exitOnFailedPromise(processStack(client.create, stackname, version, templateFile, paramsFile, options));
  });

program
  .command('update [stackname] [version] [template_file] [params_file]')
  .description(
    'Update ECS service using CF. Use "current" for version if you want to use the currently running version.')
  .action((stackname, version, templateFile, paramsFile) => {
    const client = createClient(program);
    const options = getServiceOptions(program);
    exitOnFailedPromise(processStack(client.update, stackname, version, templateFile, paramsFile, options));
  });

program
  .command('run [stackname] [version]')
  .description(
    'Run ECS service using CF. Use this if you are not updating the template. Use "current" for version if you want to use the currently running version.')
  .action((stackname, version) => {
    const client = createClient(program);
    const options = getServiceOptions(program);
    exitOnFailedPromise(runStack(client, stackname, version, options));
  });

program
  .command('stop [stackname]')
  .description('Stops ecs service. Sets the scale to 0.')
  .action((stackname) => {
    const client = createClient(program);
    exitOnFailedPromise(stopStack(client, stackname));
  });

program
  .command('destroy [stackname]')
  .description('Destroy the ECS service')
  .action((stackname) => {
    const client = createClient(program);
    exitOnFailedPromise(destroyStack(client, stackname));
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  showHelp();
}
