(function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Tabs: shared by the hero demo and the Sammy summary mockup (WAI-ARIA tabs pattern, arrow keys move focus)
  function setupTabs(tablist, onChange) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
      if (onChange) onChange(document.getElementById(tab.getAttribute("aria-controls")));
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        // RTL: the left arrow moves to the next tab
        var next = { ArrowLeft: i + 1, ArrowRight: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select(tabs[(next + tabs.length) % tabs.length], true);
      });
    });
  }

  // Chat demo: messages appear one by one, with a typing indicator before each agent reply. Plays once per run (no endless loop).
  var demo = document.querySelector("[data-demo]");
  var runId = 0;
  function playChat(panel) {
    var id = ++runId;
    var msgs = Array.prototype.slice.call(panel.querySelectorAll(".msg"));
    var old = panel.querySelector(".typing");
    if (old) old.remove();
    if (reduceMotion) {
      msgs.forEach(function (m) { m.classList.add("is-shown"); });
      return;
    }
    msgs.forEach(function (m) { m.classList.remove("is-shown"); });
    var t = 300;
    msgs.forEach(function (m) {
      if (m.classList.contains("msg-agent")) {
        var typing;
        setTimeout(function () {
          if (id !== runId) return;
          typing = document.createElement("p");
          typing.className = "msg msg-agent typing is-shown";
          typing.setAttribute("aria-hidden", "true");
          typing.innerHTML = "<span></span><span></span><span></span>";
          panel.insertBefore(typing, m);
        }, t);
        t += 1100;
        setTimeout(function () {
          if (id !== runId) return;
          if (typing) typing.remove();
          m.classList.add("is-shown");
        }, t);
      } else {
        setTimeout(function () { if (id === runId) m.classList.add("is-shown"); }, t);
      }
      t += 700;
    });
  }

  if (demo) {
    var visiblePanel = function () { return demo.querySelector('[role="tabpanel"]:not([hidden])'); };
    setupTabs(demo.querySelector('[role="tablist"]'), playChat);
    demo.querySelector(".demo-replay").addEventListener("click", function () { playChat(visiblePanel()); });
    if ("IntersectionObserver" in window) {
      var started = false;
      new IntersectionObserver(function (entries, obs) {
        if (entries[0].isIntersecting && !started) { started = true; playChat(visiblePanel()); obs.disconnect(); }
      }, { threshold: 0.35 }).observe(demo);
    } else {
      playChat(visiblePanel());
    }
  }

  // Rotating word in the hero: loops through the words and a closing line. Endless motion needs a pause control (WCAG 2.2.2), so there is a pause button and hover also pauses.
  var pill = document.querySelector(".rot-pill");
  if (pill) {
    var wordEl = pill.querySelector(".rot-word");
    var leadEl = pill.parentNode.querySelector(".rot-lead");
    var lead = leadEl.textContent;
    var states = pill.getAttribute("data-words").split("|").map(function (w) { return [lead, w]; });
    states.push([pill.getAttribute("data-final-lead"), pill.getAttribute("data-final")]);
    var show = function (st) { leadEl.textContent = st[0]; wordEl.textContent = st[1]; };
    if (reduceMotion) {
      show(states[states.length - 1]);
    } else {
      var idx = 0, hover = false, stopped = false;
      var toggle = pill.parentNode.querySelector(".rot-toggle");
      toggle.hidden = false;
      toggle.addEventListener("click", function () {
        stopped = !stopped;
        toggle.textContent = stopped ? "▶" : "⏸";
        toggle.setAttribute("aria-label", stopped ? "להפעיל שוב את החלפת המילים" : "לעצור את החלפת המילים");
      });
      pill.addEventListener("mouseenter", function () { hover = true; });
      pill.addEventListener("mouseleave", function () { hover = false; });
      setInterval(function () {
        if (hover || stopped) return;
        idx = (idx + 1) % states.length;
        wordEl.classList.add("is-out");
        setTimeout(function () { show(states[idx]); wordEl.classList.remove("is-out"); }, 280);
      }, 2200);
    }
  }

  // Section titles: words rise one by one, then the last word types itself with a caret.
  // The visible pieces are aria-hidden; the h2 keeps its full text for screen readers via aria-label.
  if (!reduceMotion && "IntersectionObserver" in window) {
    document.querySelectorAll("h2.big-title").forEach(function (h) {
      var text = h.textContent.trim();
      var words = text.split(/\s+/);
      h.setAttribute("aria-label", text);
      var last = words.pop();
      h.textContent = "";
      words.forEach(function (w, i) {
        var outer = document.createElement("span");
        outer.className = "rw";
        outer.setAttribute("aria-hidden", "true");
        var inner = document.createElement("span");
        inner.className = "rw-in";
        inner.style.transitionDelay = (i * 0.08) + "s";
        inner.textContent = w;
        outer.appendChild(inner);
        h.appendChild(outer);
        h.appendChild(document.createTextNode(" "));
      });
      var typed = document.createElement("span");
      typed.className = "tw";
      typed.setAttribute("aria-hidden", "true");
      var sizer = document.createElement("span");
      sizer.className = "tw-sizer";
      sizer.textContent = last;
      var live = document.createElement("span");
      live.className = "tw-live";
      typed.appendChild(sizer);
      typed.appendChild(live);
      h.appendChild(typed);
      var typedDelay = words.length * 80 + 350;
      new IntersectionObserver(function (entries, obs) {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        h.classList.add("is-in");
        var n = 0;
        setTimeout(function step() {
          live.textContent = last.slice(0, ++n);
          if (n < last.length) setTimeout(step, 90);
          else setTimeout(function () { typed.classList.add("tw-done"); }, 1600);
        }, typedDelay);
      }, { threshold: 0.6 }).observe(h);
    });
  }

  // Photo cards in the hero: hover fans them out on desktop; on touch screens a tap does the same
  var stack = document.querySelector(".stack");
  if (stack) stack.addEventListener("click", function () { stack.classList.toggle("is-open"); });

  var docTabs = document.querySelector(".doc-tabs");
  if (docTabs) setupTabs(docTabs);

  // Scroll reveal: sections fade up the first time they enter the viewport
  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }
})();
