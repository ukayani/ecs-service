const assert = require('assert-plus');
const CF = require('./cf');
const service = require('../template/Service.json');

const create = (client, fs) => {
  const cf = CF.create(client);

  const test = () => {
    console.log(service);
  };

  return {
    test
  };
};

module.exports = {
  ServiceManager: {
    create
  }
};
