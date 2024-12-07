const ccxt = require('ccxt');
const talib = require('talib');

async function fetchData(symbol, timeframe, limit) {
    const exchange = new ccxt.binance();
    const bars = await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    return bars.map(bar => ({
        timestamp: new Date(bar[0]),
        open: bar[1],
        high: bar[2],
        low: bar[3],
        close: bar[4],
        volume: bar[5]
    }));
}

function calculateSMA(data, period) {
    const prices = data.map(d => d.close);
    const sma = talib.execute({
        name: "SMA",
        startIdx: 0,
        endIdx: prices.length - 1,
        inReal: prices,
        optInTimePeriod: period
    }).result.outReal;

    return sma.map((value, index) => ({
        timestamp: data[index].timestamp,
        value: value
    }));
}

async function strategy() {
    const symbol = 'BTC/USDT';
    const timeframe = '1h';
    const limit = 100;

    const data = await fetchData(symbol, timeframe, limit);

    const smaShort = calculateSMA(data, 10);
    const smaLong = calculateSMA(data, 50);

    const latestData = data[data.length - 1];
    const latestSmaShort = smaShort[smaShort.length - 1].value;
    const latestSmaLong = smaLong[smaLong.length - 1].value;

    console.log(`Current Price: ${latestData.close}`);
    console.log(`SMA Short: ${latestSmaShort}`);
    console.log(`SMA Long: ${latestSmaLong}`);

    if (latestData.close < latestSmaShort && latestSmaShort > latestSmaLong) {
        console.log("Consider entering a long position.");
    } else if (latestData.close > latestSmaShort && latestSmaShort < latestSmaLong) {
        console.log("Consider entering a short position.");
    } else {
        console.log("No clear signal.");
    }
}

strategy();
