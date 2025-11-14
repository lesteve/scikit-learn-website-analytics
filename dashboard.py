# %%
""" """

import pandas as pd
import panel as pn
import plotly.express as px

pn.extension("tabulator", "plotly")

DATA_PATH = "data_1000pages_28days.json"


@pn.cache()
def load_data(path=DATA_PATH):
    df = pd.read_json(path)
    df = df[["name", "visitors"]]
    # Remove some weird entries like /scikit-learn/...
    mask = df['name'].str.match(r'^/(dev|stable|\d\.\d)')
    df = df[mask]

    # TODO remove API index.html pages
    # TODO Should we remove internal stuff like base class or sklearn.utils?

    # Group different versions
    df['name'] = df['name'].str.extract(r'/(?:dev|stable|\d\.\d)/(.+)')
    df_grouped = df[['name', 'visitors']].groupby('name').sum().sort_values('visitors', ascending=False).reset_index()

    return df_grouped


def make_table(df):
    df_sorted = df.sort_values("visitors", ascending=False)
    return pn.widgets.Tabulator(
        df_sorted,
        width=800,
        height=2000,
        name="Top pages",
        page_size=100,
        editors={"name": None, "visitors": None},
    )


def make_histogram(df):
    df_plot = df.copy()
    df_plot = df_plot.sort_values("visitors", ascending=True).tail(100)

    def label_func(match):
        # TODO there are still some duplicates e.g.
        # /stable/modules/preprocessing.html (preprocessing user guide)
        # /stable/api/sklearn.preprocessing.html (API page for preprocessing module)
        page_name = match.group(1)
        if page_name == "index":
            # avoid duplication plenty of pages named "index" ...
            return match.string
        else:
            return page_name

    df_plot["label"] = df_plot["name"].str.replace(
        r".+?([^/]+)\.html", label_func, regex=True
    )

    fig = px.bar(
        df_plot,
        x="visitors",
        y="label",
        orientation="h",
        hover_data={"name": True},
        # title='Unique visitors by page'
    )

    # Hacky way to adapt size based on number of rows
    fig.update_layout(height=20 * len(df_plot) + 200, width=1400)

    return pn.pane.Plotly(fig, sizing_mode="fixed")


df = load_data()

search = pn.widgets.TextInput(
    name=r"Regex to filter page if the buttons above are not enough",
    placeholder="Enter regex to filter pages",
    width=400,
)

# Preset quick-filter buttons placed on top of the search input
btn_generated = pn.widgets.Button(name="API", button_type="default", width=180)
btn_modules = pn.widgets.Button(
    name="User guide (doc/modules only)", button_type="default", width=180
)
btn_examples = pn.widgets.Button(name="Examples", button_type="default", width=180)


def _on_generated(event):
    search.value = "generated"
    btn_generated.button_type = "primary"
    for btn in [btn_modules, btn_examples]:
        btn.button_type = "default"


def _on_modules(event):
    search.value = r"modules/\w+\.html"
    btn_modules.button_type = "primary"
    for btn in [btn_generated, btn_examples]:
        btn.button_type = "default"


def _on_examples(event):
    search.value = "auto_examples"
    btn_examples.button_type = "primary"
    for btn in [btn_generated, btn_modules]:
        btn.button_type = "default"


btn_generated.on_click(_on_generated)
btn_modules.on_click(_on_modules)
btn_examples.on_click(_on_examples)


def _on_search_change(event):
    for b in (btn_generated, btn_modules, btn_examples):
        b.button_type = "default"


search.param.watch(_on_search_change, "value")


def filtered_df(pattern):
    if not pattern:
        return df
    try:
        return df[df["name"].str.contains(pattern, regex=True)]
    except Exception:
        # likely an invalid regex => return empty DataFrame
        return df.iloc[0:0]


# Bind the histogram and table to the filtered dataframe so they update automatically
filt = pn.bind(filtered_df, search)
hist = pn.bind(make_histogram, filt)
table = pn.bind(make_table, filt)

header = pn.pane.Markdown("# Unique visitors over 28 days")

search_buttons = pn.Row(btn_generated, btn_modules, btn_examples)
search_row = pn.Row(search)
layout = pn.Column(header, search_buttons, search_row, pn.Row(hist, table))

# initialize with API pages
_on_generated(None)

pn.panel(layout).servable()
