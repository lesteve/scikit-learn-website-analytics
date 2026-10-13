# %%
import pandas as pd

DATA_PATH = "data_1000pages_12months.json"

def load_data(path=DATA_PATH):
    df = pd.read_json(path)
    df = df[["name", "visitors"]]
    # Remove some weird entries like /scikit-learn/...
    mask = df["name"].str.match(r"^/(dev|stable|\d\.\d)")
    df = df[mask]

    # TODO remove API index.html pages
    # TODO Should we remove internal stuff like base class or sklearn.utils?

    # Group different versions
    df["name"] = df["name"].str.extract(r"/(?:dev|stable|\d\.\d)/(.+)")
    df_grouped = (
        df[["name", "visitors"]]
        .groupby("name")
        .sum()
        .sort_values("visitors", ascending=False)
        .reset_index()
    )

    return df_grouped


# %%
df = load_data()
top_estimators = df.loc[df["name"].str.contains(r"\.[A-Z]", na=False)].head(50).copy()
top_estimators["estimator"] = top_estimators["name"].str.extract(
    r"([^/]+)\.html$"
)[0].str.replace(r"^sklearn\.", "", regex=True)
# Reverse the order so the most visited estimator appears at the top.
visitors = top_estimators.set_index("estimator")["visitors"].iloc[::-1]

ax = visitors.plot.barh(
    figsize=(12, 18), xlabel="Visitors", ylabel="Estimator",
    title="Top 50 scikit-learn estimators by visitors", legend=False,
)
ax.figure.tight_layout()
ax.set_axisbelow(True)
ax.grid(axis="x", linestyle=":", alpha=0.6)
ax.figure.savefig("top-50-estimators.png", dpi=150)
ax.figure

# %%
ax_log = visitors.plot.barh(
    figsize=(12, 18), logx=True, xlabel="Visitors (log scale)", ylabel="Estimator",
    title="Top 50 scikit-learn estimators by visitors (log scale)", legend=False,
)
ax_log.figure.tight_layout()
ax_log.set_axisbelow(True)
ax_log.grid(axis="x", which="both", linestyle=":", alpha=0.6)
ax_log.figure.savefig("top-50-estimators-log.png", dpi=150)
ax_log.figure
