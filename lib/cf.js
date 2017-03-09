'use strict';
const assert = require('assert-plus');
const create = (client) => {

  const get = (name) => {
    return client.describeStacks({StackName: name}).promise().then(res => res.Stacks[0]);
  };

  const getTemplate = (name) => {
    return client.getTemplate({StackName: name}).promise().then(res => JSON.parse(res.TemplateBody));
  };

  return {
    get,
    getTemplate
  };
};

module.exports = {
  create
};
