/* Each submission has one stable key across retries, including an ambiguous network failure. */
const FIELD_LABELS = { procedure: "listed procedure", equipment: "equipment list", capability: "listed capability",
  description: "description", specialties: "specialty tag", admin_correction: "administrator note" };
const fieldLabel = (f) => FIELD_LABELS[f] || String(f || "record").replace(/_/g, " ");
const PLACEHOLDERS = {
  "": "Describe the problem and what the correct information is.",
  service: "e.g. This hospital no longer offers this service; I called them on 20 Nov.",
  location: "e.g. The pin is on the wrong street. The hospital is at 12 MG Road, near the bus stand.",
  facility_details: "e.g. The hospital was renamed to …, or this is a duplicate of another listing.",
  evidence: "e.g. This statement is about a different branch of the hospital.",
  other: "e.g. The map does not show my area, or search results look wrong.",
};
class FacilityReportForm {
  constructor() {
    this.mode = document.querySelector('meta[name="care-reports"]').content;
    this.drafts = new Map();
    this.form = document.getElementById("report-form");
    this.dialog = document.getElementById("report-dialog");
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submit();
    });
    this.form.addEventListener("input", () => {
      if (this.current) this.current.values = this.readValues();
      $("report-error").hidden = true;
    });
    $("report-kind").addEventListener("change", () => { if (this.current) this.draw(); });
  }
  choose(rows, selected, service, serviceLabel) {
    const general={facility_id:null, facility_name:"Map or search experience", evidence:[]};
    const options=[general,...rows];
    const picker=$("report-target");
    picker.replaceChildren(...options.map((r,i)=>new Option(r.facility_name,String(i))));
    picker.value=String(Math.max(0,options.findIndex(r=>r.facility_id===selected)));
    const pick=()=>this.open(options[Number(picker.value)],service,serviceLabel,true);
    picker.onchange=pick;pick();
  }
  open(row, service, serviceLabel, choosing=false) {
    $("report-target-wrap").hidden=!choosing;
    const key = JSON.stringify([row.facility_id, service]);
    const draft = this.drafts.get(key) || { key, row, service, serviceLabel, values: {}, busy: false };
    this.drafts.set(key, draft);
    this.current = draft;
    this.draw();
    if(!this.dialog.open)this.dialog.showModal();
  }
  readValues() {
    return {
      issue_type: $("report-kind").value,
      evidence_index: $("report-record").value,          // which quoted statement (optional)
      suggested_change: $("report-change").value.trim(),
      source_url: $("report-source").value.trim() || null,
    };
  }
  /* The report contract keeps record_id; users pick a quoted statement instead of an ID. */
  payloadFor(d, values) {
    const ev = values.evidence_index !== "" ? d.row.evidence[Number(values.evidence_index)] : null;
    let change = values.suggested_change;
    if (ev) {
      const quote = ev.quote.length > 200 ? ev.quote.slice(0, 197) + "…" : ev.quote;
      change = ("About the statement “" + quote + "” (" + fieldLabel(ev.field) + "): " + change).slice(0, 2000);
    }
    return { facility_id: d.row.facility_id, service_id: d.service,
             record_id: ev && ev.record_id != null ? String(ev.record_id) : null,
             issue_type: values.issue_type, suggested_change: change, source_url: values.source_url };
  }
  draw() {
    const d = this.current;
    this.form.hidden = Boolean(d.receipt);
    $("report-facility").textContent = d.row.facility_name + " · " + d.serviceLabel;
    const preview = ["preview", "unconfigured"].includes(this.mode);
    $("report-scope").textContent = this.mode === "preview" ? "This file previews the report. The hosted app sends it to the review team."
        : this.mode === "unconfigured" ? "The review inbox is not connected. You can download a draft."
        : this.mode === "local" ? "Reports are saved in this app’s local review queue."
        : "The review team will check your correction before updating this record.";
    for (const o of $("report-kind").options) o.hidden=!d.row.facility_id && !["","location","other"].includes(o.value);
    $("report-kind").value = d.values.issue_type || "";
    $("report-change").value = d.values.suggested_change || "";
    $("report-source").value = d.values.source_url || "";
    const picker = $("report-record");
    picker.replaceChildren(new Option("Not about a specific statement", ""));
    d.row.evidence.forEach((e, i) => {
      const q = e.quote.length > 90 ? e.quote.slice(0, 87) + "…" : e.quote;
      const o = new Option("“" + q + "” · " + fieldLabel(e.field), String(i));
      o.title = e.quote;
      picker.add(o);
    });
    picker.value = d.values.evidence_index || "";
    const kind = $("report-kind").value;
    $("report-record-wrap").hidden = !d.row.evidence.length || kind === "location";
    $("report-change").placeholder = PLACEHOLDERS[kind] || PLACEHOLDERS[""];
    $("report-fields").disabled = d.busy;
    $("report-submit").textContent = d.busy ? "Sending…" : preview ? "Preview report" : "Submit report";
    $("report-error").hidden = !d.error;
    $("report-error").textContent = d.error || "";
    const outcome = $("report-outcome");
    outcome.replaceChildren();
    outcome.hidden = !d.receipt;
    if (!d.receipt) return;
    const title = node("h3", "", preview ? "Report preview" : "Report received");
    outcome.append(title, node("p", "", preview ? "Your draft is ready. It has not been submitted." : "Pending administrator review."));
    if (preview) {
      const details=node("pre","report-preview");details.textContent=JSON.stringify(d.receipt.payload,null,2);
      const download=action("Download draft JSON",()=>{
        const blob = new Blob([details.textContent],{type:"application/json"});
        const href = URL.createObjectURL(blob), link = document.createElement("a");
        link.href=href;link.download="carefinder-report.json";link.click();setTimeout(()=>URL.revokeObjectURL(href),500);
      },"secondary");
      outcome.append(details,download);
    } else outcome.append(node("p","receipt-id","Report ID · "+d.receipt.report_id));
    outcome.append(action(preview ? "Edit draft" : "Report another issue", () => {
      d.receipt = null; d.signature = null;
      if (!preview) d.values = {};
      this.draw(); $("report-kind").focus();
    }, "textbtn"));
  }
  async submit() {
    const d = this.current;
    if (!d || d.busy || d.receipt) return;
    const values=this.readValues();
    d.values=values;
    d.error=null;
    if (!values.suggested_change || (values.source_url && !urlFor(values.source_url))) {
      d.error = !values.suggested_change ? "Describe what should be corrected." : "Use an http or https source link.";
      this.draw(); return;
    }
    const payload=this.payloadFor(d, values);
    if (this.mode==="preview" || this.mode==="unconfigured") {
      d.receipt={payload};this.draw();return;
    }
    const signature=JSON.stringify(payload);
    if (signature!==d.signature){
      d.signature=signature;
      d.id=typeof crypto.randomUUID==="function"?crypto.randomUUID():"10000000-1000-4000-8000-100000000000".replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
    }
    d.busy=true;
    this.draw();
    const timeout = new AbortController();
    const timer=setTimeout(()=>timeout.abort(),20000);
    try {
      const response=await fetch("./api/reports",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":d.id},
        body:signature,signal:timeout.signal,cache:"no-store"});
      const ack=await response.json();
      if (!response.ok) throw Error(ack.error || "The review inbox could not confirm receipt.");
      if (ack.report_id!==d.id || ack.status!=="pending") throw Error("The review inbox did not confirm receipt.");
      d.receipt=ack;
    } catch (error) {
      d.error=(error.name==="AbortError" ? "The request timed out." : error.message || "The report could not be sent.")+" Your draft is here. You can retry.";
    } finally {
      clearTimeout(timer);
      d.busy=false;
      if(this.current===d) this.draw();
    }
  }
}
