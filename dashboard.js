const CSV_PATH = "./WDI Data Extract API-209 - PS 1 - 2022.csv";

const state = {
  rows: [],
  region: "all",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

document.getElementById("refreshBtn").addEventListener("click", loadAndRender);
document.getElementById("regionFilter").addEventListener("change", (e) => {
  state.region = e.target.value;
  renderTable();
});

loadAndRender();

async function loadAndRender() {
  const raw = await fetch(CSV_PATH).then((r) => r.text());
  state.rows = parseCsv(raw);
  renderKpis();
  renderCharts();
  hydrateRegionFilter();
  renderTable();
}

function parseCsv(csv) {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",").map((c) => c.trim());

  return lines.map((line) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(cols.map((c, i) => [c, values[i] ?? ""]));

    return {
      country: row.country,
      region: row.region,
      incomeGroup: row.income_group,
      gdp1993: num(row.gdp_1993),
      gdp2019: num(row.gdp_2019),
      pop2019: num(row.pop_2019),
    };
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }

  out.push(cur);
  return out;
}

function num(value) {
  if (!value || value === "NA") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function renderKpis() {
  const rows = state.rows;
  const withGdp = rows.filter((r) => r.gdp2019 != null);
  const withGrowth = rows.filter((r) => r.gdp1993 != null && r.gdp2019 != null && r.gdp2019 > r.gdp1993);

  const population = rows.reduce((acc, r) => acc + (r.pop2019 ?? 0), 0);
  const avgGdp = withGdp.length
    ? withGdp.reduce((acc, r) => acc + r.gdp2019, 0) / withGdp.length
    : 0;

  document.getElementById("kpiCountries").textContent = compact.format(rows.length);
  document.getElementById("kpiPopulation").textContent = compact.format(population);
  document.getElementById("kpiAvgGdp").textContent = currency.format(avgGdp);
  document.getElementById("kpiGrowth").textContent = compact.format(withGrowth.length);
}

function renderCharts() {
  const topGdp = [...state.rows]
    .filter((r) => r.gdp2019 != null)
    .sort((a, b) => b.gdp2019 - a.gdp2019)
    .slice(0, 10)
    .map((r) => ({ label: r.country, value: r.gdp2019 }));

  const regionAgg = Object.values(
    state.rows.reduce((acc, row) => {
      if (!acc[row.region]) {
        acc[row.region] = { label: row.region, value: 0 };
      }
      acc[row.region].value += row.pop2019 ?? 0;
      return acc;
    }, {})
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  drawBars(document.getElementById("gdpChart"), topGdp, false);
  drawBars(document.getElementById("regionChart"), regionAgg, true);
}

function drawBars(svg, data, soft) {
  svg.innerHTML = "";
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = 800 / data.length;
  const barWidth = Math.max(16, step - 12);

  data.forEach((d, idx) => {
    const x = idx * step + 6;
    const h = (d.value / max) * 180;
    const y = 210 - h;

    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", String(x));
    bar.setAttribute("y", String(y));
    bar.setAttribute("width", String(barWidth));
    bar.setAttribute("height", String(h));
    bar.setAttribute("rx", "4");
    bar.setAttribute("class", soft ? "bar-soft" : "bar");

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", "252");
    text.setAttribute("class", "label");
    text.textContent = d.label.length > 11 ? `${d.label.slice(0, 11)}...` : d.label;

    svg.appendChild(bar);
    svg.appendChild(text);
  });
}

function hydrateRegionFilter() {
  const select = document.getElementById("regionFilter");
  const current = state.region;
  const regions = [...new Set(state.rows.map((r) => r.region))].sort((a, b) => a.localeCompare(b));

  select.innerHTML = '<option value="all">All regions</option>';
  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    select.appendChild(option);
  });
  select.value = current;
}

function renderTable() {
  const tbody = document.getElementById("countryRows");
  const filtered = state.region === "all"
    ? state.rows
    : state.rows.filter((r) => r.region === state.region);

  const sorted = [...filtered].sort((a, b) => (b.gdp2019 ?? 0) - (a.gdp2019 ?? 0)).slice(0, 40);

  tbody.innerHTML = sorted
    .map((r) => {
      const delta = r.gdp1993 != null && r.gdp2019 != null ? r.gdp2019 - r.gdp1993 : null;
      return `
        <tr>
          <td>${r.country}</td>
          <td>${r.region}</td>
          <td>${r.incomeGroup}</td>
          <td>${r.gdp2019 != null ? currency.format(r.gdp2019) : "N/A"}</td>
          <td>${r.pop2019 != null ? compact.format(r.pop2019) : "N/A"}</td>
          <td>${delta != null ? currency.format(delta) : "N/A"}</td>
        </tr>
      `;
    })
    .join("");
}
