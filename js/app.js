(function () {
  const QUESTIONS = [
    { key: "taste_of_the_food", label: "Taste of the food" },
    { key: "quality_and_freshness", label: "Quality & freshness" },
    { key: "hygiene_and_packaging", label: "Hygiene & packaging" },
    { key: "service_and_delivery", label: "Service & delivery" },
    { key: "overall_experience", label: "Overall experience" }
  ];

  const form = document.getElementById("feedback-form");
  const errorEl = document.getElementById("form-error");
  const successEl = document.getElementById("form-success");
  const submitBtn = document.getElementById("submit-btn");
  const ratings = Object.create(null);
  const cfg = window.KRITTI_CONFIG || {};

  function buildScales() {
    document.querySelectorAll(".question").forEach((fieldset) => {
      const key = fieldset.dataset.key;
      const scale = fieldset.querySelector(".scale");
      if (!scale || !key) return;

      for (let n = 1; n <= 10; n += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scale-btn";
        btn.textContent = String(n);
        btn.setAttribute("aria-label", `${n} out of 10`);
        btn.setAttribute("aria-pressed", "false");
        btn.addEventListener("click", () => selectRating(fieldset, key, n, btn));
        scale.appendChild(btn);
      }
    });
  }

  function selectRating(fieldset, key, value, selectedBtn) {
    ratings[key] = value;
    fieldset.querySelectorAll(".scale-btn").forEach((btn) => {
      const on = btn === selectedBtn;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    hideMessages();
  }

  function hideMessages() {
    errorEl.hidden = true;
    successEl.hidden = true;
  }

  function showError(message) {
    successEl.hidden = true;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function showSuccess(message) {
    errorEl.hidden = true;
    successEl.hidden = false;
    successEl.textContent = message;
  }

  function missingQuestions() {
    return QUESTIONS.filter((q) => ratings[q.key] == null).map((q) => q.label);
  }

  function buildPayload() {
    const suggestion = document.getElementById("suggestion").value.trim();
    return {
      timestamp: new Date().toISOString(),
      taste_of_the_food: ratings.taste_of_the_food,
      quality_and_freshness: ratings.quality_and_freshness,
      hygiene_and_packaging: ratings.hygiene_and_packaging,
      service_and_delivery: ratings.service_and_delivery,
      overall_experience: ratings.overall_experience,
      suggestion: suggestion || ""
    };
  }

  function csvEscape(value) {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  function toCsvRow(entry) {
    return [
      entry.timestamp,
      entry.taste_of_the_food,
      entry.quality_and_freshness,
      entry.hygiene_and_packaging,
      entry.service_and_delivery,
      entry.overall_experience,
      entry.suggestion || ""
    ]
      .map(csvEscape)
      .join(",");
  }

  function hasToken() {
    return cfg.githubToken && cfg.githubToken !== "__FEEDBACK_TOKEN__" && cfg.githubToken.length > 10;
  }

  async function githubGetFile(path) {
    const url = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.githubToken}`
      }
    });
    if (res.status === 404) return { sha: null, text: "" };
    if (!res.ok) throw new Error(`GitHub read failed (${res.status})`);
    const data = await res.json();
    const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
    return { sha: data.sha, text };
  }

  async function githubPutFile(path, content, sha, message) {
    const url = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}`;
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: "main"
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.githubToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.status === 409 || res.status === 422) {
      const err = new Error("conflict");
      err.code = "conflict";
      throw err;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub write failed (${res.status})`);
    }
  }

  async function saveToGitHub(payload) {
    if (!hasToken()) throw new Error("Feedback token not configured");

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const jsonFile = await githubGetFile("data/responses.json");
        let list = [];
        if (jsonFile.text) {
          try {
            const parsed = JSON.parse(jsonFile.text);
            if (Array.isArray(parsed)) list = parsed;
          } catch (_) {
            list = [];
          }
        }
        list.push(payload);
        await githubPutFile(
          "data/responses.json",
          JSON.stringify(list, null, 2) + "\n",
          jsonFile.sha,
          "chore: record customer feedback"
        );

        const csvFile = await githubGetFile("data/responses.csv");
        const header =
          "timestamp,taste_of_the_food,quality_and_freshness,hygiene_and_packaging,service_and_delivery,overall_experience,suggestion\n";
        let csv = csvFile.text && csvFile.text.trim() ? csvFile.text : header;
        if (!csv.endsWith("\n")) csv += "\n";
        csv += toCsvRow(payload) + "\n";
        await githubPutFile(
          "data/responses.csv",
          csv,
          csvFile.sha,
          "chore: record customer feedback (csv)"
        );

        return { total: list.length };
      } catch (err) {
        lastError = err;
        if (err.code !== "conflict") break;
      }
    }
    throw lastError || new Error("Could not save to GitHub");
  }

  async function dispatchAction(payload) {
    if (!hasToken()) return;
    await fetch(
      `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${cfg.githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          event_type: "feedback_submitted",
          client_payload: payload
        })
      }
    );
  }

  async function saveToServer(payload) {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Local API unavailable");
    return res.json();
  }

  function resetForm() {
    Object.keys(ratings).forEach((key) => delete ratings[key]);
    document.querySelectorAll(".scale-btn").forEach((btn) => {
      btn.classList.remove("is-selected");
      btn.setAttribute("aria-pressed", "false");
    });
    document.getElementById("suggestion").value = "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideMessages();

    const missing = missingQuestions();
    if (missing.length) {
      showError(`Please rate: ${missing.join(", ")}`);
      return;
    }

    const payload = buildPayload();
    submitBtn.disabled = true;

    try {
      try {
        await saveToServer(payload);
      } catch (_) {
        await saveToGitHub(payload);
        dispatchAction(payload).catch(() => {});
      }
      showSuccess("Thank you! Your feedback has been submitted.");
      resetForm();
    } catch (err) {
      console.error(err);
      showError("Could not save feedback to GitHub. Please try again in a moment.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  buildScales();
})();
