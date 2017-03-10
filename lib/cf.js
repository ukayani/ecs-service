'use strict';
const assert = require('assert-plus');
const create = (client) => {

  const get = (name) => {
    return client.describeStacks({StackName: name}).promise().then(res => res.Stacks[0]);
  };

  const getTemplate = (name) => {
    return client.getTemplate({StackName: name}).promise().then(res => JSON.parse(res.TemplateBody));
  };

  const update = (name, params, body) => {
    return client.updateStack({
      StackName: name,
      Parameters: params,
      TemplateBody: body,
      Capabilities: ['CAPABILITY_IAM']
    }).promise();
  };

  const create = (name, params, body) => {
    return client.createStack({
      StackName: name,
      Parameters: params,
      TemplateBody: body,
      Capabilities: ['CAPABILITY_IAM']
    }).promise();
  };

  const destroy = (name) => {
    return client.deleteStack({
      StackName: name
    }).promise();
  };

  const waitFor = (name, event) => {
    return client.waitFor(event, {StackName: name}).promise();
  };

  const waitForUpdate = (name) => {
    return waitFor(name, 'stackUpdateComplete');
  };

  const waitForExist = (name) => {
    return waitFor(name, 'stackExists');
  };

  const waitForCreate = (name) => {
    return waitFor(name, 'stackCreateComplete');
  };

  const waitForDelete = (name) => {
    return waitFor(name, 'stackDeleteComplete');
  };

  return {
    get,
    getTemplate,
    update,
    create,
    destroy,
    waitForUpdate,
    waitForExist,
    waitForCreate,
    waitForDelete
  };
};

module.exports = {
  create
};
