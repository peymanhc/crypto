const express = require('express');
const ccxt = require('ccxt');
const talib = require('talib');
const cors = require('cors'); 

const app = express();
const port = 8000;

app.use(cors())
app.use(express.json());

app.post('/strategy', async (req, res) => {
    const { symbol, timeframe } = req.body;
    const limit = 100;

    const fetchData = async (symbol, timeframe, limit) => {
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
    };

    const calculateSMA = (data, period) => {
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
    };

    const data = await fetchData(symbol, timeframe,limit);
    const smaShort = calculateSMA(data, 10);
    const smaLong = calculateSMA(data, 50);

    const latestData = data[data.length - 1];
    const latestSmaShort = smaShort[smaShort.length - 1].value;
    const latestSmaLong = smaLong[smaLong.length - 1].value;

    let signal = "ایده ای ندارم";
    if (latestData.close < latestSmaShort && latestSmaShort > latestSmaLong) {
        signal = "ورود به موقعیت لانگ";
    } else if (latestData.close > latestSmaShort && latestSmaShort < latestSmaLong) {
        signal = "ورود به موقعیت شورت";
    }

    res.json({
        currentPrice: latestData.close,
        smaShort: latestSmaShort,
        smaLong: latestSmaLong,
        signal: signal
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});