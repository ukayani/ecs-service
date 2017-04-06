const chalk = require('chalk');

const logInfo = (message) => {
  console.log(chalk.blue(message));
};

const logDetails = (message) => {
  console.log(chalk.grey(message));
};

const logSuccess = (message) => {
  console.log(chalk.green(message));
};

const logElapsed = (start, end) => {
  const MILLIS_PER_SECOND = 1000;
  const MINUTE = 60;
  const duration = Math.round((end.getTime() - start.getTime()) / MILLIS_PER_SECOND);
  if (duration > 2 * MINUTE) {
    const minutes = Math.floor(duration / MINUTE);
    const seconds = duration - (minutes * MINUTE);
    logDetails(`Elapsed: ${minutes} minutes ${seconds} seconds`);
  } else {
    logDetails(`Elapsed: ${duration} seconds`);
  }
};

module.exports = {
  info: logInfo,
  details: logDetails,
  success: logSuccess,
  elapsed: logElapsed
};
