(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.src) return;
  var embedOrigin = new URL(script.src, document.baseURI).origin;
  var messageType = "inboundr:recruitment:v1";

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function start(root) {
    if (root.dataset.inboundrWidgetReady === "true") return;
    var organization = text(root.dataset.organization);
    if (!organization) {
      console.error(
        "[Inboundr Recruitment] data-organization is required.",
        root,
      );
      return;
    }
    root.dataset.inboundrWidgetReady = "true";

    var parentOrigin = window.location.origin;
    var params = new URLSearchParams({
      embed: "1",
      widget: "1",
      parentOrigin: parentOrigin,
    });
    ["department", "location", "theme"].forEach(function (key) {
      var value = text(root.dataset[key]);
      if (value) params.set(key, value);
    });
    var frame = document.createElement("iframe");
    frame.title = text(root.dataset.title) || "Open jobs";
    frame.src =
      embedOrigin +
      "/careers/" +
      encodeURIComponent(organization) +
      "?" +
      params.toString();
    frame.loading = "lazy";
    frame.style.cssText =
      "display:block;width:100%;height:420px;border:0;border-radius:12px;background:transparent;overflow:hidden;";
    frame.setAttribute("allow", "clipboard-write");
    root.appendChild(frame);

    var modalHost = document.createElement("div");
    var shadow = modalHost.attachShadow({ mode: "closed" });
    shadow.innerHTML =
      '<style>:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;justify-content:center;padding:clamp(8px,3vw,32px);background:rgba(15,15,15,.72);font-family:ui-sans-serif,system-ui,sans-serif}.backdrop.open{display:flex}.dialog{position:relative;width:min(1100px,100%);height:min(900px,calc(100vh - clamp(16px,6vw,64px)));overflow:hidden;border-radius:16px;background:#fff;box-shadow:0 24px 80px rgba(0,0,0,.35)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}iframe{display:block;width:100%;height:100%;border:0}.close{position:absolute;z-index:2;top:12px;right:12px;display:grid;width:40px;height:40px;place-items:center;border:1px solid rgba(0,0,0,.14);border-radius:999px;background:#fff;color:#171717;font:700 22px/1 system-ui;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.12)}.close:focus-visible{outline:3px solid #2563eb;outline-offset:2px}@media(max-width:640px){.backdrop{padding:0}.dialog{width:100%;height:100%;border-radius:0}}</style><div class="backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="inboundr-job-dialog-title"><h2 id="inboundr-job-dialog-title" class="sr-only">Job details and application</h2><button class="close" type="button" aria-label="Close job details">&times;</button></div></div>';
    document.body.appendChild(modalHost);
    var backdrop = shadow.querySelector(".backdrop");
    var dialog = shadow.querySelector(".dialog");
    var closeButton = shadow.querySelector(".close");
    var detailFrame = null;
    var returnFocus = null;
    var previousOverflow = "";

    function close() {
      if (!backdrop.classList.contains("open")) return;
      backdrop.classList.remove("open");
      document.documentElement.style.overflow = previousOverflow;
      if (detailFrame) {
        detailFrame.remove();
        detailFrame = null;
      }
      if (returnFocus && typeof returnFocus.focus === "function")
        returnFocus.focus();
    }

    function open(path) {
      var url;
      try {
        url = new URL(path, embedOrigin);
      } catch (_) {
        return;
      }
      if (
        url.origin !== embedOrigin ||
        !url.pathname.startsWith(
          "/careers/" + encodeURIComponent(organization) + "/",
        )
      )
        return;
      returnFocus = document.activeElement;
      detailFrame = document.createElement("iframe");
      url.searchParams.set("embed", "1");
      url.searchParams.set("widget", "1");
      url.searchParams.set("parentOrigin", parentOrigin);
      if (text(root.dataset.theme))
        url.searchParams.set("theme", text(root.dataset.theme));
      detailFrame.src = url.toString();
      detailFrame.title = "Job details and application";
      detailFrame.tabIndex = 0;
      dialog.appendChild(detailFrame);
      backdrop.classList.add("open");
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      closeButton.focus();
    }

    closeButton.addEventListener("click", close);
    backdrop.addEventListener("click", function (event) {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && backdrop.classList.contains("open"))
        close();
      if (
        event.key === "Tab" &&
        backdrop.classList.contains("open") &&
        detailFrame
      ) {
        var active = shadow.activeElement;
        if (event.shiftKey && active === closeButton) {
          event.preventDefault();
          detailFrame.focus();
        } else if (!event.shiftKey && active === detailFrame) {
          event.preventDefault();
          closeButton.focus();
        }
      }
    });
    window.addEventListener("message", function (event) {
      if (
        event.origin !== embedOrigin ||
        !event.data ||
        event.data.channel !== messageType
      )
        return;
      if (
        event.source !== frame.contentWindow &&
        (!detailFrame || event.source !== detailFrame.contentWindow)
      )
        return;
      if (
        event.data.type === "height" &&
        event.source === frame.contentWindow
      ) {
        var height = Number(event.data.height);
        if (Number.isFinite(height))
          frame.style.height = Math.max(240, Math.min(2400, height)) + "px";
      } else if (
        event.data.type === "navigate" &&
        event.source === frame.contentWindow &&
        typeof event.data.path === "string"
      ) {
        open(event.data.path);
      } else if (
        event.data.type === "close" &&
        detailFrame &&
        event.source === detailFrame.contentWindow
      ) {
        close();
      }
    });
  }

  function scan() {
    document.querySelectorAll("[data-inboundr-recruitment]").forEach(start);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  else scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
