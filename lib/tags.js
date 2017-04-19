const utils = require('./file.utils');

const toTagArray = (tags) => {
  return Object.keys(tags).map(key => ({
    Key: key,
    Value: tags[key]
  }));
};

const read = (path) => {
  return path ? utils.read(path, '{}').then(JSON.parse).then(toTagArray) : Promise.resolve([]);
};

module.exports = {
  read
};
