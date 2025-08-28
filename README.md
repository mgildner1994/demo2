# Stock Prediction Game (GitHub Pages)

Predict whether a stock's price will go up or down using real historical data from Alpha Vantage.

## Features

- User enters any stock ticker (e.g., MSFT, AAPL, COF)
- Validates using Alpha Vantage Daily Adjusted data (no demo data)
- Randomly selects a starting trading date within 7–100 days before today
- Shows the 7 trading days leading up to and including the starting date on a line chart
- User predicts next-day direction; app reveals actual next day, updates score, and continues

## Local Development

This is a static site. Open `index.html` with a local server.

For example with Python 3 (from the project directory):

```bash
python3 -m http.server 5500
```

Then visit `http://localhost:5500`.

## Alpha Vantage API Key

The app requires a valid Alpha Vantage API key. You can:

- Enter your key directly in the page input when starting the game, or
- Replace the default placeholder in `index.html` (the `value` attribute of the API key input).

Note: When deploying to GitHub Pages, the key is exposed client-side. Consider usage limits and rotate keys if needed.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. In your repo settings, enable GitHub Pages for the main branch (root).
3. Visit the published URL. The app is fully static and will work from Pages.

## Implementation Notes

- Uses `TIME_SERIES_DAILY_ADJUSTED` with `outputsize=compact` (~100 most recent trading days)
- Chart rendered with Chart.js via CDN
- "Starting date" is the latest point initially shown on the chart; the chart shows the 6 prior trading days plus the starting date (7 points total) to satisfy the requirement of showing the previous 7 days context

# demo2