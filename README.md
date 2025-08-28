# Stock Direction Game

A static web game that uses real stock market data from Alpha Vantage. Pick any real ticker, see the prior 7 trading days up to a random start day, then predict whether the next day closes up or down. Your score increments by 1 for correct guesses; 0 otherwise. After each guess, the next day's actual price is revealed, the chart advances, and the current date updates.

## Live Data

- Data source: Alpha Vantage (`TIME_SERIES_DAILY_ADJUSTED`)
- API key is embedded for demo: `1C1CEFGJ0I8O85E7`
- Respect Alpha Vantage free tier limits (typically 5 requests/min, 500/day). If you hit rate limits, you'll see an informational message; wait and try again.

## Local Development

Open `index.html` directly in a browser or serve the folder with a static server:

```bash
npx serve .
```

## GitHub Pages Deployment

1. Create a new GitHub repository and push these files to the repository root (so `index.html` is at the root).
2. In GitHub, go to Settings → Pages.
3. Under "Build and deployment", choose:
   - Source: "Deploy from a branch"
   - Branch: `main` (or `master`), folder `/root`.
4. Save. Your site will be published at `https://<your-username>.github.io/<your-repo>/` after a short delay.

If you prefer a `docs/` folder, move all files into `docs/`, commit, and then select `docs/` as the Pages folder.

## How It Works

- User enters a ticker. The app validates it by fetching daily adjusted data from Alpha Vantage.
- The app selects a random non-weekend trading date between 7 and 100 days before today as the "start date" and displays the prior 7 trading days including that date on a Chart.js line chart.
- The user predicts up or down for the following day. The app checks the guess, updates the score, reveals the next day's close, and advances the chart and current date.
- Repeat until the user ends the game or no further data exists.

## Notes

- This app is entirely client-side and suitable for GitHub Pages.
- Holidays are implicitly handled because only trading days from the API are used. Weekends are filtered when choosing the start date.
- Prices use the daily adjusted close (`4. close`).

# demo2