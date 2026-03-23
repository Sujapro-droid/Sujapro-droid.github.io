(function () {
  var storageKey = "site_lang";
  var buttons = document.querySelectorAll("[data-set-lang]");

  if (!buttons.length) {
    return;
  }

  function setLanguage(lang) {
    document.body.setAttribute("data-lang", lang);
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-label-fr][data-label-en]").forEach(function (element) {
      element.setAttribute("aria-label", element.getAttribute("data-label-" + lang));
    });

    document.querySelectorAll("[data-title-fr][data-title-en]").forEach(function (element) {
      document.title = element.getAttribute("data-title-" + lang);
    });

    document.querySelectorAll("[data-placeholder-fr][data-placeholder-en]").forEach(function (element) {
      element.setAttribute("placeholder", element.getAttribute("data-placeholder-" + lang));
    });

    document.querySelectorAll("[data-fr][data-en]").forEach(function (element) {
      element.textContent = element.getAttribute("data-" + lang);
    });

    buttons.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-set-lang") === lang));
    });

    try {
      localStorage.setItem(storageKey, lang);
    } catch (error) {
      /* ignore storage failures */
    }

    document.dispatchEvent(new CustomEvent("languagechange", { detail: { lang: lang } }));
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      setLanguage(button.getAttribute("data-set-lang"));
    });
  });

  var preferredLang = document.body.getAttribute("data-lang") || "en";

  try {
    preferredLang = localStorage.getItem(storageKey) || preferredLang;
  } catch (error) {
    /* ignore storage failures */
  }

  setLanguage(preferredLang);
})();
