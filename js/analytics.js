(function () {
  const QUESTIONS = [
    { key: "taste_of_the_food", label: "Taste of the food", short: "Taste" },
    { key: "quality_and_freshness", label: "Quality & freshness", short: "Quality" },
    { key: "hygiene_and_packaging", label: "Hygiene & packaging", short: "Hygiene" },
    { key: "service_and_delivery", label: "Service & delivery", short: "Service" },
    { key: "overall_experience", label: "Overall experience", short: "Overall" }
  ];

  const errorEl = document.getElementById("dash-error");
  const emptyEl = document.getElementById("dash-empty");
  const statGrid = document.getElementById("stat-grid");
  const averagesPanel = document.getElementById("averages-panel");
  const distributionPanel = document.getElementById("distribution-panel");
  const responsesPanel = document.getElementById("responses-panel");
  const refreshBtn = document.getElementById("refresh-btn");

  function hideError() {
    errorEl.hidden = true;
  }

  function showError(message) {
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function avg(nums) {
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return iso || "—";
    }
  }

  function scoreClass(n) {
    if (n >= 8) return "high";
    if (n >= 5) return "mid";
    return "low";
  }

  async function loadResponses() {
    const res = await fetch("../data/responses.json?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load responses.json");
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Invalid responses file");
    return data.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  function renderStats(rows) {
    document.getElementById("stat-total").textContent = String(rows.length);

    const overallAvg = avg(rows.map((r) => Number(r.overall_experience)).filter(Number.isFinite));
    document.getElementById("stat-overall").textContent =
      overallAvg == null ? "—" : overallAvg.toFixed(1);

    const withSuggestion = rows.filter((r) => String(r.suggestion || "").trim()).length;
    document.getElementById("stat-suggestions").textContent = String(withSuggestion);

    document.getElementById("stat-latest").textContent = rows[0]
      ? formatWhen(rows[0].timestamp)
      : "—";
  }

  function renderAverages(rows) {
    const root = document.getElementById("averages");
    root.innerHTML = "";

    QUESTIONS.forEach((q) => {
      const values = rows.map((r) => Number(r[q.key])).filter((n) => n >= 1 && n <= 10);
      const mean = avg(values);
      const pct = mean == null ? 0 : (mean / 10) * 100;

      const row = document.createElement("div");
      row.className = "avg-row";
      row.innerHTML = `
        <div class="avg-label">${q.label}</div>
        <div class="avg-track"><div class="avg-fill" style="width:${pct}%"></div></div>
        <div class="avg-score">${mean == null ? "—" : mean.toFixed(1)}</div>
      `;
      root.appendChild(row);
    });
  }

  function renderDistributions(rows) {
    const root = document.getElementById("distributions");
    root.innerHTML = "";

    QUESTIONS.forEach((q) => {
      const counts = Array.from({ length: 10 }, () => 0);
      rows.forEach((r) => {
        const n = Number(r[q.key]);
        if (n >= 1 && n <= 10) counts[n - 1] += 1;
      });
      const max = Math.max(1, ...counts);

      const block = document.createElement("div");
      block.className = "dist-block";

      const title = document.createElement("h3");
      title.textContent = q.label;
      block.appendChild(title);

      const bars = document.createElement("div");
      bars.className = "dist-bars";

      counts.forEach((count, i) => {
        const height = Math.max(3, Math.round((count / max) * 56));
        const col = document.createElement("div");
        col.className = "dist-col";
        col.innerHTML = `
          <span class="dist-count">${count ? count : ""}</span>
          <div class="dist-bar-wrap"><div class="dist-bar" style="height:${count ? height : 3}px;opacity:${count ? 1 : 0.25}"></div></div>
          <span class="dist-n">${i + 1}</span>
        `;
        bars.appendChild(col);
      });

      block.appendChild(bars);
      root.appendChild(block);
    });
  }

  function renderTable(rows) {
    const body = document.getElementById("responses-body");
    body.innerHTML = "";

    rows.forEach((r, index) => {
      const tr = document.createElement("tr");

      const num = document.createElement("td");
      num.textContent = String(rows.length - index);
      tr.appendChild(num);

      const when = document.createElement("td");
      when.textContent = formatWhen(r.timestamp);
      tr.appendChild(when);

      QUESTIONS.forEach((q) => {
        const td = document.createElement("td");
        const pill = document.createElement("span");
        pill.className = "score-pill " + scoreClass(Number(r[q.key]));
        pill.textContent = r[q.key] != null ? String(r[q.key]) : "—";
        td.appendChild(pill);
        tr.appendChild(td);
      });

      const suggestionTd = document.createElement("td");
      suggestionTd.className = "suggestion-cell";
      const suggestion = String(r.suggestion || "").trim();
      if (suggestion) {
        suggestionTd.textContent = suggestion;
      } else {
        const muted = document.createElement("span");
        muted.className = "muted";
        muted.textContent = "None";
        suggestionTd.appendChild(muted);
      }
      tr.appendChild(suggestionTd);

      body.appendChild(tr);
    });
  }

  function showDashboard(hasData) {
    emptyEl.hidden = hasData;
    statGrid.hidden = !hasData;
    averagesPanel.hidden = !hasData;
    distributionPanel.hidden = !hasData;
    responsesPanel.hidden = !hasData;
  }

  async function refresh() {
    hideError();
    refreshBtn.disabled = true;
    try {
      const rows = await loadResponses();
      if (!rows.length) {
        showDashboard(false);
        return;
      }
      showDashboard(true);
      renderStats(rows);
      renderAverages(rows);
      renderDistributions(rows);
      renderTable(rows);
    } catch (err) {
      console.error(err);
      showDashboard(false);
      showError("Could not load analytics data. Check data/responses.json.");
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener("click", refresh);
  refresh();
})();
