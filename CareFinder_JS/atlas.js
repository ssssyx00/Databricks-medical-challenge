/* Map viewport and search origin are independent. Only an intentional background tap
   calls onOrigin. Changes to the result list update marker layers in place. */
class FacilityAtlas {
  constructor(origin, radius, onOrigin, onFacility) {
    this.onOrigin = onOrigin;
    this.onFacility = onFacility;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.pins = new Map();
    this.rows = [];
    this.rankKey = "fused_rank";
    this.selectedId = null;
    this.clickTimer = 0;
    this.gestureUntil = 0;
    this.map = L.map("map", {
      center: [origin.latitude, origin.longitude],
      zoom: window.innerWidth <= 740 ? 11.25 : 11.75,
      minZoom: 2,
      maxZoom: 19,
      zoomSnap: 0.25,
      zoomDelta: 1,
      zoomControl: false,
      scrollWheelZoom: true,
      touchZoom: true,
      wheelDebounceTime: 18,
      wheelPxPerZoomLevel: 80,
      attributionControl: true,
      zoomAnimation: !this.reducedMotion.matches,
      fadeAnimation: false,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 0.85,
    });
    this.map.attributionControl.setPrefix(false);
    this.addBasemap();
    L.control.scale({ imperial: false, maxWidth: 85 }).addTo(this.map);
    this.range = L.circle([origin.latitude, origin.longitude], {
      radius: radius * 1000,
      color: "#346ca0",
      weight: 1.8,
      dashArray: "6 5",
      fillColor: "#548ec5",
      fillOpacity: 0.055,
      interactive: false,
    }).addTo(this.map);
    this.originPin = L.marker([origin.latitude, origin.longitude], {
      interactive: false,
      keyboard: false,
      zIndexOffset: 400,
      icon: L.divIcon({ className: "map-origin", html: "<i></i>", iconSize: [22, 22], iconAnchor: [11, 11] }),
    }).addTo(this.map);
    this.facilityLayer = L.layerGroup().addTo(this.map);
    this.leaders = L.layerGroup().addTo(this.map);
    this.installGestures();
    document.getElementById("zoom-in").addEventListener("click", () => {
      this.cancelTap();
      this.map.zoomIn();
    });
    document.getElementById("zoom-out").addEventListener("click", () => {
      this.cancelTap();
      this.map.zoomOut();
    });
    document.getElementById("fit").addEventListener("click", () => this.showArea());
    this.map.on("zoomend", () => this.positionPins());
    this.resize = new ResizeObserver(() => this.map.invalidateSize({ pan: false }));
    this.resize.observe(this.map.getContainer());
    this.origin = origin;
    this.radius = radius;
    this.map.on("dragstart", () => { this.exploring = true; });
    this.map.on("moveend", () => {
      if (!this.exploring) return;
      const a = this.map.latLngToContainerPoint([this.origin.latitude,this.origin.longitude]);
      document.getElementById("search-area").hidden = a.distanceTo(this.map.getSize().divideBy(2)) < 30;
    });
    document.getElementById("search-area").addEventListener("click", () => {
      const c = this.map.getCenter().wrap();
      this.onOrigin({latitude:+c.lat.toFixed(6), longitude:+c.lng.toFixed(6), label:"Selected map center"});
    });
  }

  addBasemap() {
    CareGeography.addTo(this.map);
    CareStreets.addTo(this.map, message => {
      const note=document.getElementById("tile-note");
      note.textContent=message;note.hidden=!message;
    });
  }

  cancelTap() {
    clearTimeout(this.clickTimer);
    if (this.previewPoint) {
      this.previewPoint = null;
      this.paintOrigin(this.origin);
    }
  }
  paintOrigin(origin) {
    const p=[origin.latitude,origin.longitude];
    this.originPin.setLatLng(p);this.range.setLatLng(p);
    document.getElementById("map-origin-readout").textContent =
      "Starting point · "+origin.latitude.toFixed(5)+"°, "+origin.longitude.toFixed(5)+"°";
  }
  installGestures() {
    const active = new Set();
    const host = this.map.getContainer();
    host.addEventListener(
      "pointerdown",
      (e) => {
        active.add(e.pointerId);
        if (active.size > 1) {
          this.cancelTap();
          this.gestureUntil = performance.now() + 650;
        }
      },
      { capture: true },
    );
    // Safari on a Mac can deliver gesture events instead of wheel events.
    let gestureZoom=null;
    host.addEventListener("gesturestart", e=>{
      if(active.size>1)return;
      e.preventDefault();this.cancelTap();gestureZoom=this.map.getZoom();
    },{passive:false});
    host.addEventListener("gesturechange", e=>{
      if(gestureZoom===null||!Number.isFinite(e.scale)||e.scale<=0)return;
      e.preventDefault();
      const point=Number.isFinite(e.clientX)?this.map.mouseEventToContainerPoint(e):this.map.getSize().divideBy(2);
      this.map.setZoomAround(point,gestureZoom+Math.log2(e.scale),{animate:false});
    },{passive:false});
    host.addEventListener("gestureend", e=>{
      if(gestureZoom!==null){e.preventDefault();gestureZoom=null;this.gestureUntil=performance.now()+180;}
    },{passive:false});
    const release = (e) => {
      if (active.size > 1 && active.has(e.pointerId)) this.gestureUntil = performance.now() + 500;
      active.delete(e.pointerId);
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    this.map.on("dragstart zoomstart dblclick", () => this.cancelTap());
    this.map.on("dragend", () => {
      this.gestureUntil = performance.now() + 110;
    });
    this.map.on("click", (e) => {
      const original = e.originalEvent;
      if (
        performance.now() < this.gestureUntil ||
        original?.detail > 1 ||
        original?.target?.closest?.(".leaflet-marker-icon,.leaflet-control,.leaflet-tooltip")
      )
        return;
      this.cancelTap();
      const pos = e.latlng.wrap();
      const origin={latitude:+pos.lat.toFixed(6),longitude:+pos.lng.toFixed(6),label:"Selected map point"};
      this.previewPoint=origin;
      this.paintOrigin(origin);
      this.clickTimer=setTimeout(()=>{
        this.previewPoint=null;
        this.lastTap={time:performance.now(), previous:this.origin, next:origin};
        this.onOrigin(origin);
      },230);

    });
    this.map.on("dblclick", e=>{
      this.cancelTap();
      const last=this.lastTap;
      if(last && performance.now()-last.time<500 && this.origin===last.next &&
         this.map.latLngToContainerPoint(e.latlng).distanceTo(this.map.latLngToContainerPoint([last.next.latitude,last.next.longitude]))<15)
        this.onOrigin(last.previous);
      this.lastTap=null;
    });
  }

  showArea() {
    this.cancelTap();
    this.map.fitBounds(this.range.getBounds(), { padding: [19, 19], maxZoom: 15, animate: false });
  }
  setArea(origin, radius) {
    this.cancelTap();
    this.origin=origin;this.radius=radius;this.exploring=false;
    document.getElementById("search-area").hidden=true;
    this.paintOrigin(origin);this.range.setRadius(radius*1000);
  }
  pan(point) {
    this.cancelTap();this.exploring=false;document.getElementById("search-area").hidden=true;
    const nearby=this.map.getBounds().pad(.7).contains(point);
    this.map.panTo(point,{animate:nearby&&!this.reducedMotion.matches,duration:.22});
  }
  streetDetail(row) {
    this.cancelTap();this.exploring=false;document.getElementById("search-area").hidden=true;
    this.map.setView([row.latitude,row.longitude],Math.max(15,this.map.getZoom()),{animate:false});
  }
  clear() {
    this.facilityLayer.clearLayers();
    this.leaders.clearLayers();
    this.pins.clear();
    this.rows = [];
    this.selectedId = null;
  }
  setRows(rows) {
    this.clear();
    this.rows = rows;
    for (const row of rows) {
      if (!row.hasCoordinates) continue;
      const pin = L.marker([row.latitude, row.longitude], {
        icon: this.icon(row, false),
        bubblingMouseEvents: false,
        keyboard: true,
        title: row.facility_name,
        riseOnHover: false,
        autoPanOnFocus: false,
      });
      const label = document.createElement("span");
      label.textContent = row.facility_name;
      pin.bindTooltip(label, { direction: "top", offset: [0, -28], className: "selected-label" });
      pin.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
        this.cancelTap();
        this.onFacility(row.facility_id);
      });
      this.pins.set(row.facility_id, pin);
      pin.addTo(this.facilityLayer);
      const el = pin.getElement();
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", row.facility_name);
      el.addEventListener("keydown", (event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.onFacility(row.facility_id);
        }
      });
    }
    this.positionPins();
  }
  icon(row, picked) {
    const rank = row[this.rankKey];
    return L.divIcon({
      className: "pin-icon" + (picked ? " is-selected" : ""),
      iconSize: [44, 44],
      iconAnchor: [22, 37],
      html: '<svg class="pin-shape" viewBox="0 0 32 40" aria-hidden="true"><path d="M16 1C7.7 1 2.3 7 2.3 14.7c0 9.3 13.7 23.2 13.7 23.2s13.7-13.9 13.7-23.2C29.7 7 24.3 1 16 1z"/><text x="16" y="19">'+(Number.isInteger(rank)?rank:"+")+'</text></svg>',
    });
  }
  positionPins() {
    // Offset coincident symbols and connect them to their reported coordinate.
    const groups = new Map(),
      zoom = this.map.getZoom();
    this.leaders.clearLayers();
    for (const row of this.rows) {
      if (!row.hasCoordinates) continue;
      const point = this.map.project([row.latitude, row.longitude], zoom);
      const cell = Math.floor(point.x / 20) + ":" + Math.floor(point.y / 20);
      if (!groups.has(cell)) groups.set(cell, []);
      groups.get(cell).push({ row, point });
    }
    for (const group of groups.values()) {
      group.forEach(({ row, point }, i) => {
        let pos = L.latLng(row.latitude, row.longitude);
        if (group.length > 1) {
          const angle = (2 * Math.PI * i) / group.length,
            // Cap the ring so crowded cities (e.g. Hyderabad at an all-India zoom) stay at their
            // real location instead of spilling pins hundreds of km across neighbouring states.
            spread = Math.min(Math.max(18, 5 * group.length), 44);
          const target = this.map.unproject(
            point.add(L.point(spread * Math.cos(angle), spread * Math.sin(angle))),
            zoom,
          );
          L.polyline([pos, target], {
            interactive: false,
            color: "#416890",
            weight: 1,
            opacity: 0.55,
          }).addTo(this.leaders);
          pos = target;
        }
        this.pins.get(row.facility_id).setLatLng(pos);
      });
    }
  }
  highlight(id, key) {
    this.selectedId = id;
    this.rankKey = key;
    for (const row of this.rows) {
      const pin = this.pins.get(row.facility_id);
      if (!pin) continue;
      const picked = row.facility_id === id;
      const el = pin.getElement();
      el.classList.toggle("is-selected", picked);
      el.setAttribute("aria-pressed", String(picked));
      el.querySelector("text").textContent = Number.isInteger(row[key]) ? String(row[key]) : "+";
      pin.setZIndexOffset(picked ? 5000 : 0);
      if (picked) pin.openTooltip();
      else pin.closeTooltip();
    }
  }
}
