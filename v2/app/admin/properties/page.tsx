"use client";

import { useEffect, useMemo, useState } from "react";

type Unit = {
  id: string;
  label: string;
  floorNumber: number;
  floorLabel: string;
  residentType: "OWNER" | "TENANT" | null;
  ownerName: string | null;
  ownerMobile: string | null;
  ownerEmail: string | null;
};

type Property = {
  id: string;
  type: "APARTMENT" | "TENAMENT";
  name: string;
  propertyNumber: string;
  block: string | null;
  units: Unit[];
};

const apartmentBlocks = ["A", "B", "C"];
const flatNumbers = Array.from({ length: 26 }, (_, i) => i + 1);

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/properties", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load properties");
      setProperties(data.properties || []);
    } catch (e: any) {
      setMessage(e.message || "Unable to load properties");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createProperty(type: "APARTMENT" | "TENAMENT", propertyNumber: string, block?: string) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/properties", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, propertyNumber, block, name: type === "APARTMENT" ? "Sarang Apartment" : "Pramukhpark Society" }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) throw new Error(data.error || "Unable to create property");
      await load();
    } catch (e: any) { setMessage(e.message || "Unable to create property"); }
    finally { setBusy(false); }
  }

  async function setupApartment() {
    if (!confirm("Create Sarang Apartment Blocks A, B, C with flats 1–26 in each block?")) return;
    setBusy(true); setMessage("");
    try {
      for (const block of apartmentBlocks) {
        for (const number of flatNumbers) {
          await createProperty("APARTMENT", String(number), block);
        }
      }
      setMessage("Apartment setup completed. Duplicate existing records were skipped.");
      await load();
    } finally { setBusy(false); }
  }

  async function setupTenaments() {
    if (!confirm("Create Pramukhpark Society Tenaments 1–27? Floors will be added separately.")) return;
    setBusy(true); setMessage("");
    try {
      for (let i = 1; i <= 27; i++) await createProperty("TENAMENT", String(i));
      setMessage("Tenament setup completed. Add floors to each tenament as required.");
      await load();
    } finally { setBusy(false); }
  }

  const apartments = useMemo(() => properties.filter(p => p.type === "APARTMENT"), [properties]);
  const tenaments = useMemo(() => properties.filter(p => p.type === "TENAMENT"), [properties]);

  return (
    <main className="main">
      <div className="page-header">
        <div><h1>Properties & Units</h1><p>Manage Sarang Apartment and Pramukhpark Society residences.</p></div>
      </div>

      {message && <div className="alert">{message}</div>}

      <section className="card">
        <h2>Initial Property Setup</h2>
        <p>Create the known property structure without creating resident accounts.</p>
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={setupApartment}>Setup Sarang Apartment · 78 Flats</button>
          <button className="btn btn-secondary" disabled={busy} onClick={setupTenaments}>Setup Pramukhpark · 27 Tenaments</button>
        </div>
      </section>

      <section className="card">
        <h2>Sarang Apartment</h2>
        {loading ? <p>Loading…</p> : <div className="property-grid">
          {apartmentBlocks.map(block => {
            const blockItems = apartments.filter(p => p.block === block).sort((a,b) => Number(a.propertyNumber)-Number(b.propertyNumber));
            return <div className="property-group" key={block}><h3>Block {block}</h3><div className="unit-grid">
              {flatNumbers.map(n => { const p = blockItems.find(x => x.propertyNumber === String(n)); return <button key={n} className={p ? "unit-chip" : "unit-chip missing"} onClick={() => p && setSelectedId(p.id)}>{n}</button>; })}
            </div></div>;
          })}
        </div>}
      </section>

      <section className="card">
        <h2>Pramukhpark Society</h2>
        {loading ? <p>Loading…</p> : <div className="property-grid">
          {tenaments.sort((a,b) => Number(a.propertyNumber)-Number(b.propertyNumber)).map(p => <button key={p.id} className="property-row" onClick={() => setSelectedId(p.id)}>
            <strong>Tenament {p.propertyNumber}</strong><span>{p.units.length} floor{p.units.length === 1 ? "" : "s"}</span>
          </button>)}
        </div>}
      </section>

      {selectedId && <UnitManager property={properties.find(p => p.id === selectedId)!} onClose={() => setSelectedId(null)} onChanged={load} />}
    </main>
  );
}

function UnitManager({ property, onClose, onChanged }: { property: Property; onClose: () => void; onChanged: () => void }) {
  const [floorLabel, setFloorLabel] = useState("Ground");
  const [floorNumber, setFloorNumber] = useState(0);
  const [residentType, setResidentType] = useState<"OWNER" | "TENANT">("OWNER");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function addFloor() {
    if (!mobile.trim()) return alert("Mobile number is required.");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/properties/${property.id}/units`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: floorLabel, floorNumber, floorLabel, residentType, ownerName: name || null, ownerMobile: mobile, ownerEmail: email || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to add floor");
      setName(""); setMobile(""); setEmail(""); onChanged();
    } catch (e: any) { alert(e.message || "Unable to add floor"); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop"><div className="modal card">
    <div className="modal-header"><div><h2>{property.type === "TENAMENT" ? `Tenament ${property.propertyNumber}` : `${property.block}-${property.propertyNumber}`}</h2><p>{property.name}</p></div><button className="icon-btn" onClick={onClose}>×</button></div>
    <h3>Existing Floors / Unit</h3>
    <div className="floor-list">{property.units.map(u => <div className="floor-row" key={u.id}><span><strong>{u.floorLabel}</strong> · {u.residentType || "Unassigned"}</span><span>{u.ownerName || "No resident"} · {u.ownerMobile || "No mobile"}</span></div>)}</div>
    <h3>Add Floor / Unit</h3>
    <div className="form-grid">
      <label>Floor label<input value={floorLabel} onChange={e => setFloorLabel(e.target.value)} /></label>
      <label>Floor number<input type="number" min="0" value={floorNumber} onChange={e => setFloorNumber(Number(e.target.value))} /></label>
      <label>Resident type<select value={residentType} onChange={e => setResidentType(e.target.value as any)}><option value="OWNER">Owner</option><option value="TENANT">Tenant / Rental</option></select></label>
      <label>Name<input value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Mobile *<input required value={mobile} onChange={e => setMobile(e.target.value)} /></label>
      <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    </div>
    <div className="actions"><button className="btn btn-secondary" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={busy} onClick={addFloor}>{busy ? "Saving…" : "Add Floor / Unit"}</button></div>
  </div></div>;
}

// Page-local fallback styling; existing project styles remain untouched.
const style = `
.property-grid{display:grid;gap:18px}.property-group{padding:16px;border:1px solid #eadfce;border-radius:12px}.unit-grid{display:grid;grid-template-columns:repeat(13,minmax(36px,1fr));gap:8px}.unit-chip,.property-row{border:1px solid #ddcfbd;background:#fffaf2;border-radius:8px;padding:10px;cursor:pointer}.unit-chip.missing{opacity:.4}.property-row{display:flex;justify-content:space-between;text-align:left;width:100%}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.42);display:grid;place-items:center;padding:20px;z-index:50}.modal{width:min(850px,100%);max-height:90vh;overflow:auto}.modal-header{display:flex;justify-content:space-between}.floor-list{display:grid;gap:8px;margin-bottom:20px}.floor-row{display:flex;justify-content:space-between;gap:12px;padding:10px;border:1px solid #eadfce;border-radius:8px}.icon-btn{border:0;background:transparent;font-size:28px;cursor:pointer}@media(max-width:700px){.unit-grid{grid-template-columns:repeat(6,1fr)}.floor-row{flex-direction:column}}
`;
if (typeof document !== "undefined" && !document.getElementById("property-page-style")) { const s=document.createElement("style"); s.id="property-page-style"; s.textContent=style; document.head.appendChild(s); }
