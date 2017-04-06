const assert = require('assert-plus');
const utils = require('./file.utils');

const envPattern = /^([A-Za-z0-9_]+)=(.*)$/;

const parseEnv = (line) => {
  const match = envPattern.exec(line);
  assert.bool(match && match.length > 2, 'Line is not valid environment variable definition');
  return [match[1], match[2]];
};

const contentToArray = (content) => {
  return content.trim().split('\n')
                .filter(line => line.length > 0 && !line.startsWith('#'))
                .map(line => {
                  const [key, value] = parseEnv(line);
                  return {
                    Name: key.trim(),
                    Value: value.trim()
                  };
                });
};

const read = (path) => path ? utils.read(path).then(contentToArray) : Promise.resolve([]);

module.exports = {
  read
};
