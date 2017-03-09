const assert = require('assert-plus');
const CF = require('./cf');
const fs = require('fs');
const path = require('path');

const create = (client) => {
  const cf = CF.create(client);

  const deploy = (stackname) => {
    cf.getTemplate(stackname).then(console.log);
  };

  return {
    deploy
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
