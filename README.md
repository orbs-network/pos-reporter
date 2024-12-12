## Development

The Project works in tandem with [github.com/orbs-network/pos-analytics-lib](orbs-network/pos-analytics-lib). 

* clone git
```
git clone https://github.com/orbs-network/pos-reporter
```

* Create a .env file with `REACT_APP_ETHEREUM_RPC` and `REACT_APP_POLYGON_RPC` entries.

In the project directory, you can run:

* Install
```
npm install
```

* Build only
Please note that the root domain needs to match the `Homepage` field in package.json.
```
npm run build
```

* Testing/Running Locally
Will open browser to http://localhost:3000/ and the reporter generator page will load.
Please Note generating report can take 15-20 minutes.
```
npm run start
```

## Deploy GitHub Pages

* Publish a version to branch gh-pages
```
npm run deploy
```

* Setting up github pages
Under setting of repository go to the github pages section and choose the branch `gh-pages` and the root directory and press `Save`. If you also published with a specific domain you can setup the Custom Domain name.



