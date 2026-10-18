/* Gartenbau Brandmeier · kleine Helfer für die Seite.
   Hier muss normalerweise nichts angepasst werden.
   1. Menü auf dem Handy
   2. Ankreuzen: Kästchen auf der ganzen Seite sind verbunden, WhatsApp-Text folgt den Haken
   3. Haken und Linien zeichnen sich, wenn der Abschnitt ins Bild kommt
   4. Google-Bewertungen (nur mit Place-ID, Laden erst nach Klick)
   5. Anfrageformular: Prüfung, Versand an data-endpoint oder E-Mail-Programm */
(function () {
  "use strict";

  var WHATSAPP_NUMMER = "4915773604385";

  /* ---------- 1. Menü ---------- */
  var menueKnopf = document.querySelector(".menue-knopf");
  var navi = document.getElementById("navi");
  if (menueKnopf && navi) {
    var schliessen = function () {
      navi.classList.remove("offen");
      menueKnopf.setAttribute("aria-expanded", "false");
    };
    menueKnopf.addEventListener("click", function () {
      var offen = navi.classList.toggle("offen");
      menueKnopf.setAttribute("aria-expanded", offen ? "true" : "false");
    });
    navi.addEventListener("click", function (e) { if (e.target.closest("a")) schliessen(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navi.classList.contains("offen")) { schliessen(); menueKnopf.focus(); }
    });
  }

  /* ---------- 2. Ankreuzen ---------- */
  var kaestchen = Array.prototype.slice.call(document.querySelectorAll("input[data-leistung]"));

  function angekreuzt() {
    var liste = [];
    kaestchen.forEach(function (k) {
      if (k.checked && liste.indexOf(k.dataset.leistung) === -1) liste.push(k.dataset.leistung);
    });
    return liste;
  }

  function whatsappText() {
    var liste = angekreuzt();
    var text = "Hallo Herr Brandmeier, ich interessiere mich für";
    text += liste.length ? ": " + liste.join(", ") + "." : " eine Arbeit an Garten, Terrasse oder Einfahrt.";
    return text;
  }

  function whatsappLinks() {
    var url = "https://wa.me/" + WHATSAPP_NUMMER + "?text=" + encodeURIComponent(whatsappText());
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) { a.href = url; });
  }

  function setzen(leistung, wert) {
    kaestchen.forEach(function (k) { if (k.dataset.leistung === leistung) k.checked = wert; });
    whatsappLinks();
  }

  kaestchen.forEach(function (k) {
    k.addEventListener("change", function () { setzen(k.dataset.leistung, k.checked); });
  });
  whatsappLinks();

  document.querySelectorAll("[data-ankreuzen]").forEach(function (a) {
    a.addEventListener("click", function () { setzen(a.dataset.ankreuzen, true); });
  });

  /* ---------- 3. Zeichnen beim Scrollen ---------- */
  var zuZeichnen = document.querySelectorAll(".pruefliste, .ablauf-rahmen");
  if ("IntersectionObserver" in window) {
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("ist-sichtbar"); beobachter.unobserve(e.target); }
      });
    }, { threshold: 0.35 });
    zuZeichnen.forEach(function (el) { beobachter.observe(el); });
  } else {
    zuZeichnen.forEach(function (el) { el.classList.add("ist-sichtbar"); });
  }

  /* ---------- 4. Google-Bewertungen ---------- */
  var bew = document.getElementById("bewertungen");
  if (bew) {
    var placeId = (bew.dataset.placeId || "").trim();
    var apiKey = (bew.dataset.apiKey || "").trim();
    if (placeId) {
      bew.hidden = false;
      var profil = "https://www.google.com/maps/place/?q=place_id:" + encodeURIComponent(placeId);
      var bewerten = "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(placeId);
      bew.querySelectorAll(".google-profil").forEach(function (a) { a.href = profil; });
      bew.querySelectorAll(".google-bewerten").forEach(function (a) { a.href = bewerten; });

      var laden = bew.querySelector(".bewertungen-laden");
      if (laden && apiKey) {
        laden.hidden = false;
        var knopf = laden.querySelector("button");
        var status = laden.querySelector(".bewertungen-status");
        var karten = bew.querySelector(".bewertungs-karten");
        var esc = function (t) { var d = document.createElement("div"); d.textContent = t || ""; return d.innerHTML; };
        var sterne = function (n) {
          n = Math.max(1, Math.min(5, Math.round(n || 5)));
          var s = '<span class="sterne" role="img" aria-label="' + n + ' von 5 Sternen">';
          for (var i = 0; i < 5; i++) s += '<svg aria-hidden="true" class="' + (i < n ? "an" : "aus") + '"><use href="#i-stern"/></svg>';
          return s + "</span>";
        };
        knopf.addEventListener("click", function () {
          knopf.disabled = true;
          status.textContent = "Bewertungen werden geladen …";
          fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId) + "?languageCode=de", {
            headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri" }
          })
            .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(function (d) {
              if (d.googleMapsUri) bew.querySelectorAll(".google-profil").forEach(function (a) { a.href = d.googleMapsUri; });
              var html = "";
              if (d.rating) {
                html += '<div class="bewertung"><span class="feldname">Gesamt auf Google</span><p class="eintrag">' +
                  d.rating.toFixed(1).replace(".", ",") + " von 5" + (d.userRatingCount ? " · " + d.userRatingCount + " Bewertungen" : "") + "</p>" + sterne(d.rating) + "</div>";
              }
              (d.reviews || []).forEach(function (r) {
                if (!r.text || !r.text.text) return;
                var name = r.authorAttribution && r.authorAttribution.displayName ? r.authorAttribution.displayName : "Google-Nutzer";
                html += '<article class="bewertung">' + sterne(r.rating) + "<blockquote>" + esc(r.text.text) + "</blockquote><footer>" +
                  esc(name) + (r.relativePublishTimeDescription ? " · " + esc(r.relativePublishTimeDescription) : "") + " · Google</footer></article>";
              });
              karten.innerHTML = html;
              laden.hidden = true;
            })
            .catch(function () {
              knopf.disabled = false;
              status.textContent = "Die Bewertungen ließen sich gerade nicht laden. Sie finden sie direkt auf Google.";
            });
        });
      }
    }
  }

  /* ---------- 5. Anfrageformular ---------- */
  var form = document.getElementById("inquiry-form");
  if (!form) return;

  var wrap = document.getElementById("form-wrap");
  var statusEl = document.getElementById("form-status");
  var successEl = document.getElementById("form-success");
  var successText = document.getElementById("form-success-text");
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitLabel = submitBtn.querySelector(".btn-label") || submitBtn;
  var idleLabel = submitLabel.textContent;
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var required = Array.prototype.slice.call(form.querySelectorAll("[required]"));

  function fieldValid(input) {
    if (input.type === "checkbox") return input.checked;
    var value = input.value.trim();
    if (!value) return false;
    if (input.type === "email") return emailPattern.test(value);
    return true;
  }

  function showError(input, show) {
    var field = input.closest(".field");
    if (field) field.classList.toggle("has-error", show);
    input.setAttribute("aria-invalid", String(show));
    var error = document.getElementById(input.id + "-error");
    if (!error) return;
    if (show) input.setAttribute("aria-describedby", error.id);
    else input.removeAttribute("aria-describedby");
  }

  required.forEach(function (input) {
    var evt = input.type === "checkbox" ? "change" : "blur";
    input.addEventListener(evt, function () {
      var field = input.closest(".field");
      if ((field && field.classList.contains("has-error")) || input.value.trim()) showError(input, !fieldValid(input));
    });
    input.addEventListener("input", function () {
      var field = input.closest(".field");
      if (field && field.classList.contains("has-error") && fieldValid(input)) showError(input, false);
    });
  });

  function collect() {
    return {
      name: form.elements.name.value.trim(),
      telefon: form.elements.telefon.value.trim(),
      email: form.elements.email.value.trim(),
      ort: form.elements.ort.value.trim(),
      leistungen: angekreuzt().join(", "),
      quelle: form.elements.quelle.value,
      message: form.elements.message.value.trim(),
      consent: form.elements.consent.checked,
      website: form.elements.website.value,
      page: window.location.href,
      submittedAt: new Date().toISOString()
    };
  }

  function mailtoLink(d) {
    var zeilen = [
      "Name: " + d.name,
      "Telefon: " + (d.telefon || "keine Angabe"),
      "E-Mail: " + d.email,
      "Ort der Fläche: " + (d.ort || "keine Angabe"),
      "Worum geht es: " + (d.leistungen || "keine Angabe"),
      "Erfahren über: " + (d.quelle || "keine Angabe"),
      "",
      "Nachricht:",
      d.message
    ];
    return "mailto:" + form.dataset.mailto +
      "?subject=" + encodeURIComponent("Anfrage über die Website: " + (d.leistungen || d.name)) +
      "&body=" + encodeURIComponent(zeilen.join("\n"));
  }

  function showSuccess(text) {
    if (text) successText.textContent = text;
    wrap.classList.add("is-sent");
    successEl.hidden = false;
    successEl.focus();
  }

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitLabel.textContent = loading ? "Wird gesendet …" : idleLabel;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";

    var firstInvalid = null;
    required.forEach(function (input) {
      var ok = fieldValid(input);
      showError(input, !ok);
      if (!ok && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) { firstInvalid.focus(); return; }

    var data = collect();
    if (data.website) { showSuccess(); return; }
    delete data.website;

    var endpoint = form.dataset.endpoint;
    if (!endpoint) {
      window.location.href = mailtoLink(data);
      showSuccess("Ihr E-Mail-Programm öffnet sich mit der vorbereiteten Nachricht. Bitte senden Sie sie dort ab.");
      return;
    }

    setLoading(true);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); showSuccess(); })
      .catch(function () {
        statusEl.className = "form-status is-error";
        statusEl.innerHTML = 'Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie an oder schreiben Sie eine E-Mail an <a href="' +
          mailtoLink(data) + '">' + form.dataset.mailto + "</a>.";
      })
      .then(function () { setLoading(false); });
  });
})();
