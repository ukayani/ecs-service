'use strict';
const create = (client) => {

  const get = (name) => {
    return client.describeStacks({StackName: name}).promise().then(res => res.Stacks[0]);
  };

  const getParameters = (name) => {
    return get(name).then(stack => {
      const params = {};
      stack.Parameters.forEach(entry => {
        params[entry.ParameterKey] = entry.ParameterValue;
      });
      return params;
    });
  };

  const getTemplate = (name) => {
    return client.getTemplate({StackName: name}).promise().then(res => JSON.parse(res.TemplateBody));
  };

  const update = (name, templateParams, body, tags) => {
    const params = {
      StackName: name,
      Parameters: templateParams,
      TemplateBody: body,
      Capabilities: ['CAPABILITY_IAM']
    };

    if (tags.length > 0) {
      params.Tags = tags;
    }

    return client.updateStack(params).promise();
  };

  const create = (name, templateParams, body, tags) => {
    const params = {
      StackName: name,
      Parameters: templateParams,
      TemplateBody: body,
      Capabilities: ['CAPABILITY_IAM']
    };

    if (tags.length > 0) {
      params.Tags = tags;
    }

    return client.createStack(params).promise();
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
    getParameters,
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
