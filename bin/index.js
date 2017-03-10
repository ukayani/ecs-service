#!/usr/bin/env node

'use strict';
const pkg = require('../package.json');
const path = require('path');
const assert = require('assert-plus');
const program = require('commander');
const chalk = require('chalk');
const AWS = require('aws-sdk');
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
  showHelp();
  process.exit(1);
});

const getOptions = (options) => {
  const accessKey = options.accessKeyId;
  const secretKey = options.secretAccessKey;
  const region = options.region;

  return {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region
  };
};

const createClient = (program) => {
  const options = exitIfFailed(getOptions, program);

  const config = {
    apiVersion: '2010-05-15',
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    region: options.region
  };
  const client = new AWS.CloudFormation(config);
  return ServiceManager.create(client, fs);
};

const updateStack = (client, stackname, version, envFilePath) => {

  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
    assert.string(version, 'Must provide version');
  };

  exitIfFailed(validate, stackname, version);
  return client.update(stackname, version, path.resolve(envFilePath));
};

const createStack = (client, stackname, templateFilePath, paramsFilePath, envFilePath) => {
  const validate = () => {
    assert.string(stackname, 'Must provide stackname');
    assert.string(version, 'Must provide version');
    assert.string(templateFilePath, 'Must provide CF template file path');
    assert.string(paramsFilePath, 'Must provide parameter file path for CF template');
  };

  exitIfFailed(validate, stackname, version, templateFilePath, paramsFilePath);
  return client.create(stackname, version, path.resolve(templateFilePath), path.resolve(paramsFilePath), path.resolve(envFilePath));
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
  .option('-k, --access-key-id <id>', 'AWS Access key ID. Env: $AWS_ACCESS_KEY_ID')
  .option('-s, --secret-access-key <secret>', 'AWS Secret Access Key. Env: $AWS_SECRET_ACCESS_KEY')
  .option('-r, --region <region>', 'AWS Region. Env: $AWS_REGION')
  .option('-e, --env-file <file>', 'A .env file to supply to the container');

program
  .command('create [stackname] [version] [template_file] [params_file]')
  .description('Create ECS service using CF')
  .action((stackname, version, templateFile, paramsFile) => {
    const client = createClient(program);
    exitOnFailedPromise(createStack(client, stackname, version, templateFile, paramsFile, program.envFile));
  });

program
  .command('deploy [stackname] [version]')
  .description('Deploy ECS service using CF')
  .action((stackname, version) => {
    const client = createClient(program);
    exitOnFailedPromise(updateStack(client, stackname, version, program.envFile));
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
