async function strategy() {
    const button = document.querySelector('button');
    button.disabled = true;
    button.innerText = 'در حال بارگذاری ...';

    console.log("result.signal");
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('timeframe').value;

    try {
        const response = await fetch('http://localhost:8000/strategy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbol, timeframe })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = `
            <p>قیمت فعلی: ${result.currentPrice}</p>
            <p>پوزیشن شورت: ${result.smaShort}</p>
            <p>لانگ پوزیشن: ${result.smaLong}</p>
            <p>سیگنال: ${result.signal}</p>
        `;
    } catch (error) {
        console.error('Error fetching strategy:', error);
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = `<p style="color: red;">خطا: ${error.message}</p>`;
    } finally {
        button.disabled = false; 
        button.innerText = 'ثبت درخواست'; 
    }
}