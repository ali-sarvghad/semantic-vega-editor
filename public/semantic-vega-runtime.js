(function (global) {
  function elementChildrenForPath(el) {
    return Array.prototype.filter.call(el.children || [], function (child) {
      return String(child.tagName || '').toLowerCase() !== 'metadata';
    });
  }
  function resolveDomPath(svg, path, expectedTag) {
    var current = svg;
    if (!Array.isArray(path)) return null;
    for (var i = 0; i < path.length; i += 1) {
      var children = elementChildrenForPath(current);
      current = children[path[i]];
      if (!current) return null;
    }
    if (expectedTag && current && String(current.tagName || '').toLowerCase() !== String(expectedTag).toLowerCase()) return null;
    return current || null;
  }
  function resolveSelectorIndex(svg, entry) {
    if (!entry || !entry.selector) return null;
    try {
      var candidates = svg.querySelectorAll(entry.selector);
      var candidate = candidates[Math.max(0, Number(entry.indexInSelector) || 0)];
      if (candidate && entry.svgTag && String(candidate.tagName || '').toLowerCase() !== String(entry.svgTag).toLowerCase()) return null;
      return candidate || null;
    } catch (error) {
      return null;
    }
  }
  function setAttributes(el, attributes) {
    if (!el || !attributes) return 0;
    var count = 0;
    Object.keys(attributes).forEach(function (name) {
      if (!name || !name.indexOf || name.indexOf('p3-') !== 0) return;
      var value = attributes[name];
      if (value === null || value === undefined) return;
      if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
        count += 1;
      }
    });
    return count;
  }
  function ensureMetadata(svg, metadataJson) {
    if (!svg || !metadataJson || svg.querySelector('metadata[p3-kind="ssvg-metadata"]')) return;
    var metadata = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
    metadata.setAttribute('p3-kind', 'ssvg-metadata');
    metadata.setAttribute('type', 'application/json');
    metadata.textContent = JSON.stringify(metadataJson, null, 2);
    svg.insertBefore(metadata, svg.firstChild || null);
  }
  function applyEntries(svg, entries) {
    var applied = 0;
    var missed = [];
    (entries || []).forEach(function (entry) {
      var target = resolveDomPath(svg, entry.domPath, entry.svgTag) || resolveSelectorIndex(svg, entry);
      if (!target) {
        missed.push(entry.semanticElementId || entry.containerId || entry.cohortId || entry.selector || 'unknown-entry');
        return;
      }
      applied += setAttributes(target, entry.attributes);
    });
    return { applied: applied, missed: missed };
  }
  function applySemanticVegaRehydration(svg, sva) {
    if (!svg || !sva || !sva.rehydration) return { applied: 0, missed: ['missing-svg-or-rehydration'] };
    var rehydration = sva.rehydration;
    setAttributes(svg, rehydration.rootAttributes || {});
    ensureMetadata(svg, rehydration.metadataJson);
    var containerResult = applyEntries(svg, rehydration.containers || []);
    var elementResult = applyEntries(svg, rehydration.elements || []);
    var missed = containerResult.missed.concat(elementResult.missed);
    svg.setAttribute('p3-live-rehydrated', 'true');
    svg.setAttribute('p3-live-rehydrated-at', new Date().toISOString());
    svg.setAttribute('p3-live-rehydration-missed', String(missed.length));
    return { applied: containerResult.applied + elementResult.applied, missed: missed };
  }
  async function loadSva(svaUrlOrObject) {
    if (typeof svaUrlOrObject === 'string') {
      var response = await fetch(svaUrlOrObject);
      if (!response.ok) throw new Error('Could not load SVA: ' + response.status + ' ' + response.statusText);
      return response.json();
    }
    return svaUrlOrObject;
  }
  function chooseSpec(sva) {
    return (sva.compiled && sva.compiled.spec) || (sva.source && (sva.source.normalizedSpec || sva.source.spec));
  }
  async function SemanticVegaEmbed(container, svaUrlOrObject, options) {
    if (!global.vegaEmbed) throw new Error('SemanticVegaEmbed requires vegaEmbed to be loaded first.');
    var sva = await loadSva(svaUrlOrObject);
    var root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) throw new Error('SemanticVegaEmbed container not found.');
    var spec = chooseSpec(sva);
    if (!spec) throw new Error('SVA does not contain a renderable Vega/Vega-Lite specification.');
    var embedOptions = Object.assign({}, (sva.runtime && sva.runtime.embedOptions) || {}, options || {}, { renderer: 'svg' });
    if (!embedOptions.bind) embedOptions.bind = root.querySelector('[data-semantic-vega-controls]') || undefined;
    var result = await global.vegaEmbed(root, spec, embedOptions);
    var scheduled = false;
    function rehydrate() {
      var svg = root.querySelector('svg');
      return applySemanticVegaRehydration(svg, sva);
    }
    var first = rehydrate();
    var observer = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        rehydrate();
      }, 0);
    });
    observer.observe(root, { childList: true, subtree: true });
    return { sva: sva, vegaResult: result, view: result.view, rehydrate: rehydrate, observer: observer, initialRehydration: first, getSvg: function () { return root.querySelector('svg'); } };
  }
  global.SemanticVegaEmbed = SemanticVegaEmbed;
  global.SemanticVegaRuntime = { embed: SemanticVegaEmbed, applySemanticVegaRehydration: applySemanticVegaRehydration };
})(window);
