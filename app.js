// Core state
let chart;
let gameState = {
    apiKey: "",
    symbol: "",
    timeseries: [], // ascending by date: [{date: 'YYYY-MM-DD', close: number}]
    startIndex: null, // index in timeseries of starting date (current date)
    currentIndex: null, // moves forward as user progresses
    score: 0,
};

// DOM refs
const els = {
    form: document.getElementById('setup-form'),
    apiKey: document.getElementById('apiKey'),
    symbol: document.getElementById('symbol'),
    startBtn: document.getElementById('startBtn'),
    status: document.getElementById('status'),
    infoSymbol: document.getElementById('info-symbol'),
    infoStartDate: document.getElementById('info-start-date'),
    infoCurrentDate: document.getElementById('info-current-date'),
    infoCurrentPrice: document.getElementById('info-current-price'),
    score: document.getElementById('score'),
    btnUp: document.getElementById('btn-up'),
    btnDown: document.getElementById('btn-down'),
    restartBtn: document.getElementById('restartBtn'),
    canvas: document.getElementById('chart'),
};

function setStatus(message, isError = false) {
    els.status.textContent = message || '';
    els.status.style.color = isError ? '#ef4444' : 'var(--muted)';
}

function enablePredictionButtons(enabled) {
    els.btnUp.disabled = !enabled;
    els.btnDown.disabled = !enabled;
}

function setInfo({ symbol, startDate, currentDate, currentPrice, score }) {
    if (symbol !== undefined) els.infoSymbol.textContent = symbol || '—';
    if (startDate !== undefined) els.infoStartDate.textContent = startDate || '—';
    if (currentDate !== undefined) els.infoCurrentDate.textContent = currentDate || '—';
    if (currentPrice !== undefined) els.infoCurrentPrice.textContent = currentPrice ?? '—';
    if (score !== undefined) els.score.textContent = String(score);
}

function toISODateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function daysBetween(a, b) {
    const ms = 24 * 60 * 60 * 1000;
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((end - start) / ms);
}

async function fetchDailyAdjusted(apiKey, symbol) {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=compact&apikey=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`Network error ${resp.status}`);
    }
    const data = await resp.json();
    if (data.Note) {
        throw new Error('Rate limited by Alpha Vantage. Please wait a minute and try again.');
    }
    if (data['Error Message']) {
        throw new Error('Invalid symbol. Please try another stock ticker.');
    }
    const series = data['Time Series (Daily)'];
    if (!series) {
        throw new Error('Unexpected response from API. Try again.');
    }
    // Convert to ascending array
    const items = Object.entries(series)
        .map(([date, obj]) => ({
            date,
            close: Number(obj['5. adjusted close'] || obj['4. close'])
        }))
        .filter(row => Number.isFinite(row.close))
        .sort((a, b) => a.date.localeCompare(b.date));
    return items;
}

function chooseRandomStartIndexWithinWindow(items) {
    const today = new Date();
    const minDaysAgo = 7;
    const maxDaysAgo = 100;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - maxDaysAgo);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() - minDaysAgo);

    // Find candidate indices that:
    // - fall between minDate and maxDate (inclusive)
    // - have at least 7 prior trading days (index >= 6)
    // - have at least 1 future day to predict (index + 1 < length)
    const candidateIndices = [];
    for (let i = 0; i < items.length; i++) {
        const d = new Date(items[i].date);
        if (d >= minDate && d <= maxDate && i >= 6 && i + 1 < items.length) {
            candidateIndices.push(i);
        }
    }
    if (candidateIndices.length === 0) {
        throw new Error('Not enough data in the required date window. Try another symbol.');
    }
    const idx = Math.floor(Math.random() * candidateIndices.length);
    return candidateIndices[idx];
}

function initChart() {
    if (chart) {
        chart.destroy();
    }
    const ctx = els.canvas.getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Adj Close',
                data: [],
                tension: 0.2,
                borderColor: '#60a5fa',
                backgroundColor: 'rgba(96, 165, 250, 0.15)',
                pointRadius: 2,
                pointHoverRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: { color: '#cbd5e1', maxRotation: 0, autoSkip: true },
                    grid: { color: 'rgba(148, 163, 184, 0.15)' }
                },
                y: {
                    ticks: { color: '#cbd5e1' },
                    grid: { color: 'rgba(148, 163, 184, 0.15)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e5e7eb' } },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'nearest', intersect: false }
        }
    });
}

function seedChartWithWindow(items, endIndexInclusive) {
    // Show the 7 days leading up to and including the starting date (window size 7)
    const start = Math.max(0, endIndexInclusive - 6);
    const seed = items.slice(start, endIndexInclusive + 1);
    chart.data.labels = seed.map(row => row.date);
    chart.data.datasets[0].data = seed.map(row => row.close);
    chart.update();
}

function appendNextPoint(row) {
    chart.data.labels.push(row.date);
    chart.data.datasets[0].data.push(row.close);
    chart.update();
}

function resetGameState() {
    gameState = { apiKey: '', symbol: '', timeseries: [], startIndex: null, currentIndex: null, score: 0 };
    setInfo({ symbol: '—', startDate: '—', currentDate: '—', currentPrice: '—', score: 0 });
    enablePredictionButtons(false);
    els.restartBtn.disabled = true;
}

async function startGame(e) {
    e.preventDefault();
    setStatus('Fetching data...');
    enablePredictionButtons(false);
    els.restartBtn.disabled = true;

    const apiKey = els.apiKey.value.trim();
    const symbolInput = els.symbol.value.trim().toUpperCase();
    if (!apiKey) {
        setStatus('Please enter an Alpha Vantage API key.', true);
        return;
    }
    if (!symbolInput) {
        setStatus('Please enter a stock ticker symbol.', true);
        return;
    }

    try {
        const items = await fetchDailyAdjusted(apiKey, symbolInput);

        // Choose a valid start index in the required window
        const startIdx = chooseRandomStartIndexWithinWindow(items);

        gameState.apiKey = apiKey;
        gameState.symbol = symbolInput;
        gameState.timeseries = items;
        gameState.startIndex = startIdx;
        gameState.currentIndex = startIdx;
        gameState.score = 0;

        initChart();
        seedChartWithWindow(items, startIdx);

        setInfo({
            symbol: symbolInput,
            startDate: items[startIdx].date,
            currentDate: items[startIdx].date,
            currentPrice: items[startIdx].close.toFixed(2),
            score: 0
        });

        setStatus('Make your prediction: will it go up or down tomorrow?');
        enablePredictionButtons(true);
        els.restartBtn.disabled = false;
    } catch (err) {
        console.error(err);
        setStatus(err.message || 'Failed to start game. Try again.', true);
        enablePredictionButtons(false);
        els.restartBtn.disabled = false;
    }
}

function handlePrediction(direction) {
    if (gameState.currentIndex == null) return;

    const i = gameState.currentIndex;
    const items = gameState.timeseries;
    if (i + 1 >= items.length) {
        setStatus('No more future data available. Game over.');
        enablePredictionButtons(false);
        return;
    }

    const todayRow = items[i];
    const nextRow = items[i + 1];
    const delta = nextRow.close - todayRow.close;
    const wentUp = delta > 0;
    const wentDown = delta < 0;

    let correct = false;
    if (direction === 'up') correct = wentUp;
    if (direction === 'down') correct = wentDown;

    if (correct) {
        gameState.score += 1;
    }

    // Reveal next day
    appendNextPoint(nextRow);
    gameState.currentIndex = i + 1;

    setInfo({
        currentDate: nextRow.date,
        currentPrice: nextRow.close.toFixed(2),
        score: gameState.score
    });

    if (i + 2 >= items.length) {
        setStatus(`Revealed ${nextRow.date}. ${correct ? 'Correct!' : 'Not quite.'} No more data; game over.`);
        enablePredictionButtons(false);
    } else {
        setStatus(`Revealed ${nextRow.date}. ${correct ? 'Correct!' : 'Not quite.'} Predict the next day.`);
    }
}

function restartGame() {
    resetGameState();
    if (chart) {
        chart.destroy();
        chart = null;
    }
    setStatus('Game reset. Enter a symbol and start again.');
}

// Wire up events
els.form.addEventListener('submit', startGame);
els.btnUp.addEventListener('click', () => handlePrediction('up'));
els.btnDown.addEventListener('click', () => handlePrediction('down'));
els.restartBtn.addEventListener('click', restartGame);

// Keyboard shortcuts for convenience
window.addEventListener('keydown', (e) => {
    if (els.btnUp.disabled) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); handlePrediction('up'); }
    if (e.key === 'ArrowDown') { e.preventDefault(); handlePrediction('down'); }
});

// Initial
resetGameState();

