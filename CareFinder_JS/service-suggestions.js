// The selected service belongs to the user; refreshing groups only changes their order.
class RegionalServiceMenu {
  constructor(select) {
    this.select = select;
    this.catalog = new Map(Array.from(select.options, o => [o.value, o.text]));
    this.mode = document.querySelector('meta[name="care-suggestions"]').content;
    this.reasons = new Map();
    this.why = document.createElement("p");
    this.why.className = "suggest-why";
    this.why.style.cssText = "margin:4px 0 0;font-size:12px;line-height:1.35;color:#4d6275;max-width:340px";
    (select.closest(".control") || select.parentElement).append(this.why);
    select.addEventListener("change", () => this.explain());
  }
  explain() {
    const r = this.reasons.get(this.select.value);
    this.why.textContent = r ? "Suggested because " + r : "";
    this.why.hidden = !r;
  }
  display(items) {
    const selected = this.select.value;
    this.reasons = new Map();
    const ids = (items || []).map(x => {
      if (x && typeof x === "object") { if (x.reason) this.reasons.set(x.id, x.reason); return x.id; }
      return x;
    });
    const popular = [...new Set(ids)].filter(id => this.catalog.has(id)).slice(0, 5);
    const other = [...this.catalog.keys()].filter(id => !popular.includes(id));
    other.sort((a,b) => this.catalog.get(a).localeCompare(this.catalog.get(b), "en"));
    const groups = [];
    const group = (title, entries) => {
      if (!entries.length) return;
      const el = document.createElement("optgroup");
      el.label = title;
      for (const id of entries) {
        const o = new Option(this.catalog.get(id), id);
        if (this.reasons.has(id)) o.title = this.reasons.get(id);
        el.append(o);
      }
      groups.push(el);
    };
    group((this.mode === "demo" ? "Most searched in your area · Demo" : "Suggested for your area · local health needs (NFHS-5)"), popular);
    group("Other services · A–Z", other);
    this.select.replaceChildren(...groups);
    this.select.value = selected;
    this.explain();
  }
  async refresh(location) {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.display([]);
    if (this.mode === "off") return;
    if (mode === "standalone") {
      const areas = JSON.parse(document.getElementById("suggestion-examples").textContent);
      const area = areas.find(a => Math.abs(a.latitude-location.latitude)<0.25 && Math.abs(a.longitude-location.longitude)<0.25);
      this.display(area?.services || []);
      return;
    }
    const timeout = setTimeout(() => request.abort(), 8000);
    try {
      const response = await fetch("./api/service-suggestions", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({location}),
        signal:request.signal, cache:"no-store"
      });
      if (!response.ok) return;
      const ids = await response.json();
      if (!request.signal.aborted && this.request === request && Array.isArray(ids)) this.display(ids);
    } catch {
      // The complete alphabetical menu remains usable if regional statistics are unavailable.
    } finally {
      clearTimeout(timeout);
    }
  }
}
