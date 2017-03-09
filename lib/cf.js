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
    return client.updateStack({StackName: name, Parameters: params, TemplateBody:body, Capabilities: ['CAPABILITY_IAM']}).promise();
  };

  return {
    get,
    getTemplate,
    update
  };
};

module.exports = {
  create
};
