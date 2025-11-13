importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.2/pyc/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide...");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded pyodide!");
  const data_archives = ['dashboard.resources.zip'];
  for (const archive of data_archives) {
    let zipResponse = await fetch(archive);
    let zipBinary = await zipResponse.arrayBuffer();
    self.postMessage({type: 'status', msg: `Unpacking ${archive}`})
    self.pyodide.unpackArchive(zipBinary, "zip");
  }
  await self.pyodide.loadPackage("micropip");
  self.postMessage({type: 'status', msg: `Installing environment`})
  try {
    await self.pyodide.runPythonAsync(`
      import micropip
      await micropip.install(['https://cdn.holoviz.org/panel/wheels/bokeh-3.8.1-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.8.3/dist/wheels/panel-1.8.3-py3-none-any.whl', 'pyodide-http', 'pandas', 'plotly']);
    `);
  } catch(e) {
    console.log(e)
    self.postMessage({
      type: 'status',
      msg: `Error while installing packages`
    });
  }
  console.log("Environment loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(`\nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\n# %%\n"""\n"""\n\nimport pandas as pd\nimport panel as pn\nimport plotly.express as px\n\npn.extension('tabulator', 'plotly')\n\nDATA_PATH = 'data_1000pages_28days.json'\n\n@pn.cache()\ndef load_data(path=DATA_PATH):\n    df = pd.read_json(path)\n    df = df[['name', 'visitors']]\n    return df\n\n\ndef make_table(df):\n    df_sorted = df.sort_values('visitors', ascending=False)\n    return pn.widgets.Tabulator(df_sorted, width=800, height=2000, name='Top pages', page_size=100, editors={'name': None, 'visitors': None})\n\n\ndef make_histogram(df):\n    df_plot = df.copy()\n    df_plot = df_plot.sort_values('visitors', ascending=True).tail(100)\n\n    def label_func(match):\n        # TODO there are still some duplicates e.g.\n        # /stable/modules/preprocessing.html (preprocessing user guide)\n        # /stable/api/sklearn.preprocessing.html (API page for preprocessing module)\n        version = match.group(1)\n        page_name = match.group(2)\n        if page_name == "index":\n            # avoid duplication plenty of pages named "index" ...\n            return match.string\n        else:\n            return f"{page_name} ({version})"\n\n    df_plot['label'] = df_plot['name'].str.replace(r"/(stable|\\d\\.\\d).+?(\\w+)\\.html", label_func, regex=True)\n\n    # create the figure with Plotly Express\n    fig = px.bar(\n        df_plot,\n        x='visitors',\n        y='label',\n        orientation='h',\n        hover_data={'name': True},\n        # title='Unique visitors by page'\n    )\n\n    # Hacky way to adapt size based on number of rows\n    fig.update_layout(height=20*len(df_plot) + 200, width=1400)\n\n    return pn.pane.Plotly(fig, sizing_mode='fixed')\n\n\ndf = load_data()\n\n# Regex search input\nsearch = pn.widgets.TextInput(name=r'Regex to filter page if the buttons above are not enough', placeholder='Enter regex to filter pages', width=400)\n\n# Preset quick-filter buttons placed on top of the search input\nbtn_generated = pn.widgets.Button(name='API', button_type='default', width=180)\nbtn_modules = pn.widgets.Button(name='User guide (doc/modules only)', button_type='default', width=180)\nbtn_examples = pn.widgets.Button(name='Examples', button_type='default', width=180)\n\n\ndef _on_generated(event):\n    search.value = 'generated'\n    btn_generated.button_type = 'primary'\n    for btn in [btn_modules, btn_examples]:\n        btn.button_type = 'default'\n\n\ndef _on_modules(event):\n    search.value = r'modules/\\w+\\.html'\n    btn_modules.button_type = 'primary'\n    for btn in [btn_generated, btn_examples]:\n        btn.button_type = 'default'\n\n\ndef _on_examples(event):\n    search.value = 'auto_examples'\n    btn_examples.button_type = 'primary'\n    for btn in [btn_generated, btn_modules]:\n        btn.button_type = 'default'\n\n\nbtn_generated.on_click(_on_generated)\nbtn_modules.on_click(_on_modules)\nbtn_examples.on_click(_on_examples)\n\n\ndef _on_search_change(event):\n    for b in (btn_generated, btn_modules, btn_examples):\n        b.button_type = 'default'\n\n\nsearch.param.watch(_on_search_change, 'value')\n\ndef filtered_df(pattern):\n    if not pattern:\n        return df\n    try:\n        return df[df['name'].str.contains(pattern, regex=True)]\n    except Exception:\n        # likely an invalid regex => return empty DataFrame\n        return df.iloc[0:0]\n\n# Bind the histogram and table to the filtered dataframe so they update automatically\nfilt = pn.bind(filtered_df, search)\nhist = pn.bind(make_histogram, filt)\ntable = pn.bind(make_table, filt)\n\nheader = pn.pane.Markdown('# Unique visitors dashboard')\n# desc = pn.pane.Markdown('Simple dashboard with table and histogram views of unique visitorscounts.')\n\n# Place the buttons to the right of the search input using a Row with sizing\nsearch_buttons = pn.Row(btn_generated, btn_modules, btn_examples)\nsearch_row = pn.Row(search)\nlayout = pn.Column(header, search_buttons, search_row, pn.Row(hist, table))\n\n# pn.panel(layout)\n# pn.serve(layout, show=True)\n# initialize with API pages\n_on_generated(None)\n\npn.panel(layout).servable()\n\n\nawait write_doc()`)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    from panel.io.pyodide import _convert_json_patch
    state.curdoc.apply_json_patch(_convert_json_patch(patch), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()