Dashboard: https://lesteve.github.io/scikit-learn-website-analytics/pyodide-build/dashboard.html

To generate the dashboard:
```bash
uv run python -m panel convert dashboard.py --to pyodide-worker \
    --compile --out pyodide-build \
    --resources data_1000pages_91days.json
```

Data for 91 days and 1000 top pages was generated from:
```bash
 curl \
    --request GET \
    --header 'Content-Type: application/json' \
    --url 'https://views.scientific-python.org/api/stats/scikit-learn.org/pages/?period=91d&date=2025-11-14&order_by=%5B%5B%22visitors&limit=1000' \
    | jq .results > data_1000pages_91days.json
```
