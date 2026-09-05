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

  function onGitHubPages() {
    return /\.github\.io$/i.test(location.hostname);
  }

  function hasDispatchToken() {
    const token = String(cfg.feedbackToken || "");
    return token && token !== "REPLACE_FEEDBACK_TOKEN";
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

  async function saveToGitHub(payload) {
    const owner = cfg.githubOwner;
    const repo = cfg.githubRepo;
    const token = cfg.feedbackToken;
    if (!owner || !repo || !hasDispatchToken()) {
      throw new Error("Missing GitHub feedback token");
    }

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          event_type: "feedback_submitted",
          client_payload: payload
        })
      }
    );

    // GitHub returns 204 No Content on success
    if (res.status !== 204 && !res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error("GitHub save failed (" + res.status + ") " + detail);
    }
    return { ok: true };
  }

  async function saveToInbox(payload) {
    if (!cfg.inboxUrl) throw new Error("Missing inbox URL");
    const res = await fetch(cfg.inboxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Inbox save failed (" + res.status + ")");
    return res.json().catch(() => ({ ok: true }));
  }

  async function saveFeedback(payload) {
    if (onGitHubPages()) {
      // Prefer direct GitHub write so responses.csv updates within ~30s
      if (hasDispatchToken()) {
        try {
          return await saveToGitHub(payload);
        } catch (err) {
          console.warn("GitHub dispatch failed, trying inbox", err);
        }
      }
      return saveToInbox(payload);
    }

    try {
      return await saveToServer(payload);
    } catch (_) {
      if (hasDispatchToken()) {
        try {
          return await saveToGitHub(payload);
        } catch (err) {
          console.warn("GitHub dispatch failed, trying inbox", err);
        }
      }
      return saveToInbox(payload);
    }
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
      await saveFeedback(payload);
      showSuccess("Thank you! Your feedback has been submitted.");
      resetForm();
    } catch (err) {
      console.error(err);
      showError("Could not save feedback. Please try again.");
    } finally {
      submitBtn.disabled = false;
    }
  });

  buildScales();
})();
