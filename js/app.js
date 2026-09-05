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

  async function saveToMantle(payload) {
    if (!cfg.mantleUrl) throw new Error("Missing live store URL");

    let list = [];
    const getRes = await fetch(cfg.mantleUrl + "?ts=" + Date.now(), { cache: "no-store" });
    if (getRes.ok) {
      const data = await getRes.json();
      if (Array.isArray(data)) list = data;
    }

    list.push(payload);

    const putRes = await fetch(cfg.mantleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list)
    });

    if (!putRes.ok) {
      throw new Error("Could not save to live store");
    }

    return { total: list.length };
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
        /* GitHub Pages has no Express API — use live store */
      }

      await saveToMantle(payload);
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
