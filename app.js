/* Constants */

const DELAY = 300; // in ms

/* Constants */

const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

let settings = {
  areModulesLoaded: false,
};

const updateSettings = () => {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
};

if (fs.existsSync('settings.json')) {
  settings = fs.readFileSync('settings.json', 'utf8');
  settings = JSON.parse(settings);
} else {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
}

if (!settings.areModulesLoaded) {
  console.log('Скачиваю модули, может занять некоторое время..');
  execSync('npm i --loglevel=error');
  settings.areModulesLoaded = true;
  updateSettings();
}

const robot = require('robotjs');
const ncp = require('copy-paste');
const mouseEvents = require('global-mouse-events');

const {
  getExchangeInfo,
} = require('./binance/get-exchange-info');

const {
  getInstrumentsPrices,
} = require('./binance/get-instruments-prices');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let shoulderOfDeposite = false;
let depositForCalculate = false;
let xAndYOfPlusButton = false;
let xAndYOfInstrumentInput = false;
let xAndYOfInstrumentInput2 = false;
let xAndYOfLimitInput = false;

const orderSteps = [
  'depositForCalculate',
  'shoulderOfDeposite',
  'xAndYOfPlusButton',
  'xAndYOfInstrumentInput',
  'xAndYOfInstrumentInput2',
  'xAndYOfLimitInput',
  'end',
];

const currentStep = {
  index: 0,
  stepName: orderSteps[0],

  incrementStep() {
    this.index += 1;
    this.stepName = orderSteps[this.index];
  },
};

const start = async () => {
  if (!depositForCalculate) {
    return askQuestion('depositForCalculate');
  }

  if (!shoulderOfDeposite) {
    return askQuestion('shoulderOfDeposite');
  }

  if (!xAndYOfPlusButton) {
    console.log('Нажмите мышкой на кнопку +');
    return true;
  }

  if (!xAndYOfInstrumentInput) {
    console.log('Нажмите мышкой на поле для ввода монеты');
    return true;
  }

  if (!xAndYOfInstrumentInput2) {
    console.log('Нажмите мышкой на поле выбора монеты');
    return true;
  }

  if (!xAndYOfLimitInput) {
    console.log('Нажмите мышкой на поле для ввода лимита');
    return true;
  }

  const resultGetExchangeInfo = await getExchangeInfo();

  if (!resultGetExchangeInfo || !resultGetExchangeInfo.status) {
    console.log(resultGetExchangeInfo.message || 'Cant resultGetExchangeInfo');
    return false;
  }

  const resultGetInstrumentsPrices = await getInstrumentsPrices();

  if (!resultGetInstrumentsPrices || !resultGetInstrumentsPrices.status) {
    console.log(resultGetInstrumentsPrices.message || 'Cant resultGetInstrumentsPrices');
    return false;
  }

  const exchangeInfo = resultGetExchangeInfo.result;
  const instrumentsPrices = resultGetInstrumentsPrices.result;

  const workAmount = Math.floor(depositForCalculate * shoulderOfDeposite);

  const differenceBetweenYValues = Math.abs(xAndYOfInstrumentInput.y - xAndYOfInstrumentInput2.y);

  for await (const exchangeInfoSymbol of exchangeInfo.symbols) {
    const instrumentName = exchangeInfoSymbol.symbol;
    console.log('instrumentName', instrumentName);

    if (!exchangeInfoSymbol.filters || !exchangeInfoSymbol.filters.length || !exchangeInfoSymbol.filters[2].stepSize) {
      console.log(`Не могу найти stepSize; symbol: ${instrumentName}`);
      robot.keyTap('down');
      await sleep(1000);
      continue;
    }

    const instrumentPriceDoc =  instrumentsPrices.find(doc => doc.symbol === instrumentName);

    if (!instrumentPriceDoc) {
      console.log(`Не могу найти цену; symbol: ${instrumentName}`);
      robot.keyTap('down');
      await sleep(1000);
      continue;
    }

    const stepSize = parseFloat(exchangeInfoSymbol.filters[2].stepSize);
    const instrumentPrice = parseFloat(instrumentPriceDoc.price);
    const stepSizePrecision = getPrecision(stepSize);

    let result = workAmount / instrumentPrice;

    if (result < stepSize) {
      result = stepSize;
    } else {
      const remainder = result % stepSize;

      if (remainder !== 0) {
        result -= remainder;

        if (result < stepSize) {
          result = stepSize;
        }
      }
    }

    if (!Number.isInteger(result)) {
      result = result.toFixed(stepSizePrecision);
    }

    result = result.toString().replace('.', ',');

    robot.moveMouse(xAndYOfPlusButton.x, xAndYOfPlusButton.y);
    robot.mouseClick();

    await sleep(DELAY);

    ncp.copy(instrumentName);

    robot.moveMouse(xAndYOfInstrumentInput.x, xAndYOfInstrumentInput.y);
    robot.mouseClick();

    await sleep(DELAY);

    robot.moveMouse(xAndYOfInstrumentInput2.x, xAndYOfInstrumentInput2.y);
    robot.mouseClick();

    robot.keyTap('v', ['control']);

    await sleep(DELAY);

    robot.moveMouse(xAndYOfInstrumentInput2.x, xAndYOfInstrumentInput2.y + differenceBetweenYValues);
    robot.mouseClick();

    await sleep(DELAY);

    ncp.copy(result);

    robot.moveMouse(xAndYOfLimitInput.x, xAndYOfLimitInput.y);
    robot.mouseClick('left', true);

    await sleep(DELAY);

    robot.keyTap('v', ['control']);
  }

  console.log('Process was finished');
};

const askQuestion = (nameStep) => {
  switch (nameStep) {
    case 'depositForCalculate': {
      rl.question('Введите ваш депозит\n', userAnswer => {
        if (!userAnswer) {
          console.log('Вы ничего не ввели');
          return askQuestion('depositForCalculate');
        }

        if (!userAnswer
          || Number.isNaN(parseFloat(userAnswer))
          || userAnswer < 0) {
            console.log('Невалидные данные');
            return askQuestion('depositForCalculate');
        }

        depositForCalculate = parseFloat(userAnswer);
        currentStep.incrementStep();
        return start();
      });

      break;
    }

    case 'shoulderOfDeposite': {
      rl.question('Введите плечо\n', userAnswer => {
        if (!userAnswer) {
          console.log('Вы ничего не ввели');
          return askQuestion('shoulderOfDeposite');
        }

        if (!userAnswer
          || Number.isNaN(parseFloat(userAnswer))
          || userAnswer < 1
          || userAnswer > 5) {
            console.log('Невалидные данные');
            return askQuestion('shoulderOfDeposite');
        }

        shoulderOfDeposite = parseInt(userAnswer, 10);
        currentStep.incrementStep();
        return start();
      });

      break;
    }
  }
};

const getPrecision = (price) => {
  const dividedPrice = price.toString().split('.');

  if (!dividedPrice[1]) {
    return 0;
  }

  return dividedPrice[1].length;
};

mouseEvents.on('mouseup', (event) => {
  const {
    x, y, button,
  } = event;

  if (button === 2) {
    process.exit(1);
  }

  switch (currentStep.stepName) {
    case 'xAndYOfPlusButton': {
      xAndYOfPlusButton = { x, y };
      currentStep.incrementStep();
      return start();
      break;
    }

    case 'xAndYOfInstrumentInput': {
      xAndYOfInstrumentInput = { x, y };
      currentStep.incrementStep();
      return start();
      break;
    }

    case 'xAndYOfInstrumentInput2': {
      xAndYOfInstrumentInput2 = { x, y };
      currentStep.incrementStep();
      return start();
      break;
    }

    case 'xAndYOfLimitInput': {
      xAndYOfLimitInput = { x, y };
      currentStep.incrementStep();
      return start();
      break;
    }

    default: break;
  }
});

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

start();

/*
setTimeout(() => {
  for (let i = 0; i < 10; i += 1) {
    robot.keyTap('down');
    robot.keyTap('c', ['control']);
    console.log(ncp.paste());
  }
}, 5000);
*/
