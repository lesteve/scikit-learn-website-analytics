Dashboard: https://lesteve.github.io/scikit-learn-website-analytics/pyodide-build/dashboard.html

To generate the dashboard:
```bash
uv run python -m panel convert dashboard.py --to pyodide-worker \
    --compile --out pyodide-build \
    --resources data_1000pages_28days.json
```

Data for 28 days and 1000 top pages was generated from:
```bash
 curl \                                                                                                             
    --request GET \
    --header 'Content-Type: application/json' \
    --url 'https://views.scientific-python.org/api/stats/scikit-learn.org/pages/?period=28d&filters=%5B%5D&with_imported=true&detailed=true&order_by=%5B%5B%22visitors%22%2C%22desc%22%5D%5D&limit=1000&page=1' \
    | jq .results > data_1000pages_28days.json
```

Getting more data than this even with an API key seems to get server internal error.
