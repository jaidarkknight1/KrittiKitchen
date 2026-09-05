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

  function buildWhatsAppMessage(payload) {
    const lines = [
      "Kritti Kitchen Feedback",
      "",
      `Taste of the food: ${payload.taste_of_the_food}/10`,
      `Quality & freshness: ${payload.quality_and_freshness}/10`,
      `Hygiene & packaging: ${payload.hygiene_and_packaging}/10`,
      `Service & delivery: ${payload.service_and_delivery}/10`,
      `Overall experience: ${payload.overall_experience}/10`
    ];

    if (payload.suggestion) {
      lines.push("", `Suggestion: ${payload.suggestion}`);
    }

    return lines.join("\n");
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

  async function saveToServer(payload) {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Could not save response");
    }
    return res.json();
  }

  async function githubGetFile(path) {
    const url = `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cfg.githubToken}`
      }
    });
    if (res.status === 404) return { sha: null, text: null };
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub write failed (${res.status})`);
    }
  }

  async function saveToGitHub(payload) {
    if (!cfg.githubToken) throw new Error("No GitHub token");

    const jsonFile = await githubGetFile("data/responses.json");
    let list = [];
    if (jsonFile.text) {
      try {
        list = JSON.parse(jsonFile.text);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
    }
    list.push(payload);
    const jsonContent = JSON.stringify(list, null, 2) + "\n";
    await githubPutFile(
      "data/responses.json",
      jsonContent,
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
  }

  function openWhatsApp(payload) {
    const number = cfg.whatsappNumber || "";
    const text = encodeURIComponent(buildWhatsAppMessage(payload));
    const url = number
      ? `https://wa.me/${number}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function backupLocal(payload) {
    try {
      const key = "kritti_feedback_backup";
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(payload);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (_) {
      /* ignore */
    }
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

    let saved = false;
    try {
      await saveToServer(payload);
      saved = true;
      showSuccess("Saved to responses file. Opening WhatsApp…");
    } catch (_) {
      if (cfg.githubToken) {
        try {
          await saveToGitHub(payload);
          saved = true;
          showSuccess("Saved to GitHub tracking file. Opening WhatsApp…");
        } catch (ghErr) {
          console.warn(ghErr);
        }
      }
    }

    if (!saved) {
      backupLocal(payload);
      showSuccess("Opening WhatsApp… (tracking file updates when the server is running)");
    }

    openWhatsApp(payload);
    submitBtn.disabled = false;
  });

  buildScales();
})();
