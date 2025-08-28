/* eslint-disable no-undef */
(function () {
  const API_KEY = '1C1CEFGJ0I8O85E7';
  const API_BASE = 'https://www.alphavantage.co/query';

  const form = document.getElementById('ticker-form');
  const tickerInput = document.getElementById('ticker-input');
  const errorBox = document.getElementById('error');

  const sectionGame = document.getElementById('game-section');
  const metaTicker = document.getElementById('meta-ticker');
  const currentDateEl = document.getElementById('current-date');
  const currentCloseEl = document.getElementById('current-close');
  const scoreEl = document.getElementById('score');
  const resultEl = document.getElementById('result');

  const btnUp = document.getElementById('btn-up');
  const btnDown = document.getElementById('btn-down');
  const btnNext = document.getElementById('btn-next');
  const btnEnd = document.getElementById('btn-end');
  const btnRestart = document.getElementById('btn-restart');

  const chartCanvas = document.getElementById('price-chart');
  /** @type {import('chart.js').Chart|undefined} */
  let chart;

  let gameState = {
    ticker: '',
    series: [], // [{date: 'YYYY-MM-DD', close: number}] earliest -> latest
    startIndex: -1, // index of randomly chosen start date within series
    currentIndex: -1, // index of last revealed data point
    score: 0,
    lastPrediction: null, // 'up' | 'down' | null
  };

  function setButtonsState(enabled) {
    btnUp.disabled = !enabled;
    btnDown.disabled = !enabled;
  }

  function showError(message) {
    errorBox.textContent = message || '';
  }

  function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit', weekday: 'short' });
  }

  function isWeekend(date) {
    const d = new Date(date);
    const day = d.getUTCDay();
    return day === 0 || day === 6;
  }

  function randomInt(minInclusive, maxInclusive) {
    return Math.floor(Math.random() * (maxInclusive - minInclusive + 1)) + minInclusive;
  }

  async function fetchDailySeries(ticker) {
    const url = `${API_BASE}?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Network error (${resp.status})`);
    }
    const json = await resp.json();

    if (json['Error Message']) {
      throw new Error('Invalid ticker or API error.');
    }
    if (json['Information']) {
      throw new Error('API limit or informational response: ' + json['Information']);
    }
    const series = json['Time Series (Daily)'];
    if (!series) {
      throw new Error('No daily series available for this ticker.');
    }

    // Transform to sorted array oldest -> newest
    const points = Object.keys(series)
      .sort() // ISO date strings sort lexicographically oldest->newest
      .map((date) => ({
        date,
        close: Number(series[date]['4. close'])
      }));
    return points;
  }

  function chooseRandomStartIndex(points) {
    // pick a non-holiday weekday date between 7 and 100 days before today, inclusive
    const today = new Date();
    const minDays = 7;
    const maxDays = 100;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - maxDays);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() - minDays);

    // Among available trading dates, filter those within [minDate, maxDate]
    const candidates = [];
    for (let i = 0; i < points.length; i++) {
      const d = new Date(points[i].date + 'T00:00:00Z');
      if (d >= minDate && d <= maxDate && !isWeekend(d)) {
        candidates.push(i);
      }
    }
    if (candidates.length === 0) return -1;
    return candidates[randomInt(0, candidates.length - 1)];
  }

  function initChart(seedPoints) {
    const labels = seedPoints.map((p) => p.date);
    const data = seedPoints.map((p) => p.close);
    if (chart) chart.destroy();
    chart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Close',
          data,
          tension: 0.2,
          fill: false,
          borderColor: '#0ea5e9',
          pointBackgroundColor: '#0ea5e9',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            ticks: { callback: (val, idx) => labels[idx] },
            grid: { display: false }
          },
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(148,163,184,0.2)' }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: 'index', intersect: false }
        }
      }
    });
  }

  function updateMetaDisplay(point) {
    currentDateEl.textContent = formatDate(point.date);
    currentCloseEl.textContent = point.close.toFixed(2);
  }

  function revealPoint(point) {
    chart.data.labels.push(point.date);
    chart.data.datasets[0].data.push(point.close);
    chart.update();
    updateMetaDisplay(point);
  }

  function evalPrediction(prevClose, nextClose, prediction) {
    const wentUp = nextClose > prevClose;
    const wentDown = nextClose < prevClose;
    if (prediction === 'up' && wentUp) return true;
    if (prediction === 'down' && wentDown) return true;
    // If equal, treat as incorrect per requirement (score +0)
    return false;
  }

  function resetGameState() {
    gameState = {
      ticker: '',
      series: [],
      startIndex: -1,
      currentIndex: -1,
      score: 0,
      lastPrediction: null,
    };
    scoreEl.textContent = '0';
    resultEl.textContent = '';
    btnNext.disabled = true;
    setButtonsState(false);
    btnRestart.classList.add('hidden');
    btnEnd.disabled = false;
  }

  async function startGame(ticker) {
    resetGameState();
    showError('');
    ticker = ticker.trim().toUpperCase();
    metaTicker.textContent = ticker;

    try {
      const points = await fetchDailySeries(ticker);
      if (points.length < 30) {
        throw new Error('Insufficient data for this ticker. Try another.');
      }
      const startIndex = chooseRandomStartIndex(points);
      if (startIndex < 0) {
        throw new Error('Could not find a valid start date in range. Try again.');
      }
      // Need 7 prior trading days visible before start date
      if (startIndex - 7 < 0) {
        throw new Error('Not enough prior trading days to show. Try another ticker.');
      }

      gameState.ticker = ticker;
      gameState.series = points;
      gameState.startIndex = startIndex;
      gameState.currentIndex = startIndex; // start date is currently selected day

      const seed = points.slice(startIndex - 7, startIndex + 1); // include start date
      initChart(seed);
      updateMetaDisplay(points[startIndex]);

      // Enable predictions for the next day (if exists)
      if (startIndex + 1 < points.length) {
        setButtonsState(true);
      } else {
        setButtonsState(false);
        btnNext.disabled = true;
      }

      sectionGame.classList.remove('hidden');
    } catch (err) {
      showError(err.message || 'Failed to load data.');
      sectionGame.classList.add('hidden');
    }
  }

  function endGame() {
    setButtonsState(false);
    btnNext.disabled = true;
    btnEnd.disabled = true;
    btnRestart.classList.remove('hidden');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ticker = tickerInput.value;
    if (!ticker || !/^[A-Za-z.\-]{1,10}$/.test(ticker)) {
      showError('Please enter a valid ticker symbol.');
      return;
    }
    startGame(ticker);
  });

  btnUp.addEventListener('click', () => {
    gameState.lastPrediction = 'up';
    btnNext.disabled = false;
    setButtonsState(false);
    resultEl.textContent = 'Prediction locked: Up';
  });

  btnDown.addEventListener('click', () => {
    gameState.lastPrediction = 'down';
    btnNext.disabled = false;
    setButtonsState(false);
    resultEl.textContent = 'Prediction locked: Down';
  });

  btnNext.addEventListener('click', () => {
    const { currentIndex, series, lastPrediction } = gameState;
    if (lastPrediction == null) return;
    const prev = series[currentIndex];
    const next = series[currentIndex + 1];
    if (!next) {
      resultEl.textContent = 'No more data to reveal.';
      endGame();
      return;
    }

    const correct = evalPrediction(prev.close, next.close, lastPrediction);
    if (correct) {
      gameState.score += 1;
      resultEl.textContent = 'Correct!';
    } else {
      resultEl.textContent = 'Wrong.';
    }
    scoreEl.textContent = String(gameState.score);

    // advance day
    gameState.currentIndex += 1;
    revealPoint(next);

    // Prepare for next prediction if there is another day available
    gameState.lastPrediction = null;
    if (gameState.currentIndex + 1 < series.length) {
      setButtonsState(true);
      btnNext.disabled = true;
    } else {
      resultEl.textContent += ' End of available data.';
      endGame();
    }
  });

  btnEnd.addEventListener('click', () => {
    endGame();
  });

  btnRestart.addEventListener('click', () => {
    sectionGame.classList.add('hidden');
    resetGameState();
    chart && chart.destroy();
    chart = undefined;
    tickerInput.focus();
  });
})();

