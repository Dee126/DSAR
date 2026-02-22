"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

/* ── Types ────────────────────────────────────────────────────────────── */

interface Owner { id: string; name: string; email: string }
interface DataCategoryItem {
  id: string; category: string; customCategoryName: string | null;
  processingPurpose: string | null; lawfulBasis: string;
  retentionPeriod: string | null; retentionDays: number | null;
  dsarRelevanceAccess: boolean; dsarRelevanceErasure: boolean;
  notes: string | null;
}
interface ProcessorItem {
  id: string; vendorName: string; role: string;
  contractReference: string | null; dpaOnFile: boolean; contactEmail: string | null;
}
interface RuleItem {
  id: string; name: string; dsarTypes: string[]; weight: number;
  dataSubjectTypes: string[]; identifierTypes: string[];
}
interface CaseLinkItem {
  id: string; collectionStatus: string; discoveryScore: number | null;
  discoveryReason: string | null;
  case: { id: string; caseNumber: string; type: string; status: string };
}
interface SystemDetail {
  id: string; name: string; description: string | null; criticality: string;
  systemStatus: string; automationReadiness: string; connectorType: string;
  exportFormats: string[]; estimatedCollectionTimeMinutes: number | null;
  inScopeForDsar: boolean; containsSpecialCategories: boolean;
  notes: string | null; contactEmail: string | null;
  dataResidencyPrimary: string | null; processingRegions: string[];
  thirdCountryTransfers: boolean; thirdCountryTransferDetails: string | null;
  identifierTypes: string[]; ownerUserId: string | null;
  confidenceScore: number;
  ownerUser: Owner | null;
  dataCategories: DataCategoryItem[];
  processors: ProcessorItem[];
  discoveryRules: RuleItem[];
  caseSystemLinks: CaseLinkItem[];
  _count: { discoveryRules: number; caseSystemLinks: number; tasks: number };
}

/* ── Constants ────────────────────────────────────────────────────────── */

const CRIT_COLORS: Record<string, string> = { LOW: "bg-gray-100 text-gray-700", MEDIUM: "bg-blue-100 text-blue-700", HIGH: "bg-red-100 text-red-700" };
const DC_STATUS_COLORS: Record<string, string> = { PENDING: "bg-gray-100 text-gray-700", IN_PROGRESS: "bg-yellow-100 text-yellow-700", COMPLETED: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700", NOT_APPLICABLE: "bg-gray-100 text-gray-500" };
const STATUS_COLORS: Record<string, string> = { NEW: "bg-blue-100 text-blue-800", IDENTITY_VERIFICATION: "bg-yellow-100 text-yellow-800", INTAKE_TRIAGE: "bg-orange-100 text-orange-800", DATA_COLLECTION: "bg-purple-100 text-purple-800", REVIEW_LEGAL: "bg-indigo-100 text-indigo-800", RESPONSE_PREPARATION: "bg-cyan-100 text-cyan-800", RESPONSE_SENT: "bg-green-100 text-green-800", CLOSED: "bg-gray-100 text-gray-800", REJECTED: "bg-red-100 text-red-800" };
const AUTO_LABELS: Record<string, string> = { MANUAL: "Manual", SEMI_AUTOMATED: "Semi-automated", API_AVAILABLE: "API Available" };

const DATA_CATEGORIES = ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION", "HR", "CREDITWORTHINESS", "ONLINE_TECHNICAL", "HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY", "OTHER"];
const LAWFUL_BASES = ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS", "PUBLIC_INTEREST", "LEGITIMATE_INTERESTS"];

type Tab = "overview" | "categories" | "locations" | "vendors" | "automation" | "discovery";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "categories", label: "Data Categories" },
  { id: "locations", label: "Locations" },
  { id: "vendors", label: "Vendors" },
  { id: "automation", label: "Automation" },
  { id: "discovery", label: "Discovery" },
];

const MANAGE_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "DPO", "CASE_MANAGER"];

function confidenceColor(s: number) { return s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-600" : "text-red-500"; }

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function SystemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role && MANAGE_ROLES.includes(user.role);

  const [system, setSystem] = useState<SystemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [saving, setSaving] = useState(false);

  const fetchSystem = useCallback(async () => {
    try {
      const res = await fetch(`/api/data-inventory/systems/${id}`);
      if (res.ok) setSystem(await res.json());
      else if (res.status === 404) router.push("/data-inventory");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchSystem(); }, [fetchSystem]);

  async function updateField(field: string, value: unknown) {
    if (!system) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/data-inventory/systems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) fetchSystem();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-500">Loading...</div>;
  if (!system) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/data-inventory" className="text-sm text-gray-500 hover:text-gray-700">&larr; Data Inventory</Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{system.name}</h1>
            {system.description && <p className="mt-1 text-sm text-gray-500">{system.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CRIT_COLORS[system.criticality] ?? ""}`}>
              {system.criticality}
            </span>
            <span className={`font-semibold text-sm ${confidenceColor(system.confidenceScore)}`}>
              {system.confidenceScore}%
            </span>
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab system={system} canManage={!!canManage} onUpdate={updateField} />}
      {activeTab === "categories" && <CategoriesTab system={system} canManage={!!canManage} onRefresh={fetchSystem} />}
      {activeTab === "locations" && <LocationsTab system={system} canManage={!!canManage} onUpdate={updateField} />}
      {activeTab === "vendors" && <VendorsTab system={system} canManage={!!canManage} onRefresh={fetchSystem} />}
      {activeTab === "automation" && <AutomationTab system={system} canManage={!!canManage} onUpdate={updateField} />}
      {activeTab === "discovery" && <DiscoveryTab system={system} />}
    </div>
  );
}

/* ── Overview Tab ──────────────────────────────────────────────────────── */

function OverviewTab({ system, canManage, onUpdate }: { system: SystemDetail; canManage: boolean; onUpdate: (f: string, v: unknown) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">General</h3>
        <dl className="space-y-3 text-sm">
          <Row label="Status">
            {canManage ? (
              <select value={system.systemStatus} onChange={(e) => onUpdate("systemStatus", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
                <option value="ACTIVE">Active</option>
                <option value="RETIRED">Retired</option>
              </select>
            ) : (
              <span>{system.systemStatus}</span>
            )}
          </Row>
          <Row label="Criticality">
            {canManage ? (
              <select value={system.criticality} onChange={(e) => onUpdate("criticality", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CRIT_COLORS[system.criticality] ?? ""}`}>{system.criticality}</span>
            )}
          </Row>
          <Row label="In scope for DSAR">
            {canManage ? (
              <input type="checkbox" checked={system.inScopeForDsar} onChange={(e) => onUpdate("inScopeForDsar", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
            ) : (
              <span>{system.inScopeForDsar ? "Yes" : "No"}</span>
            )}
          </Row>
          <Row label="Special categories (Art. 9)">
            {canManage ? (
              <input type="checkbox" checked={system.containsSpecialCategories} onChange={(e) => onUpdate("containsSpecialCategories", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
            ) : (
              <span>{system.containsSpecialCategories ? "Yes" : "No"}</span>
            )}
          </Row>
          <Row label="Owner">{system.ownerUser?.name ?? "Not assigned"}</Row>
          <Row label="Contact">{system.contactEmail ?? "—"}</Row>
          <Row label="Identifier types">
            {system.identifierTypes.length > 0
              ? system.identifierTypes.map((t) => <span key={t} className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{t}</span>)
              : <span className="text-gray-400">None defined</span>}
          </Row>
        </dl>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-900">Stats</h3>
        <dl className="space-y-3 text-sm">
          <Row label="Confidence score">
            <span className={`font-semibold ${confidenceColor(system.confidenceScore)}`}>{system.confidenceScore}%</span>
          </Row>
          <Row label="Data categories">{system.dataCategories.length}</Row>
          <Row label="Vendors / processors">{system.processors.length}</Row>
          <Row label="Discovery rules">{system._count.discoveryRules}</Row>
          <Row label="Linked cases">{system._count.caseSystemLinks}</Row>
          <Row label="Tasks">{system._count.tasks}</Row>
        </dl>

        {/* Recent cases */}
        {system.caseSystemLinks.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase text-gray-400">Recent Cases</h4>
            <ul className="mt-2 space-y-1.5">
              {system.caseSystemLinks.slice(0, 5).map((link) => (
                <li key={link.id} className="flex items-center justify-between text-xs">
                  <Link href={`/cases/${link.case.id}`} className="font-medium text-brand-600 hover:underline">
                    {link.case.caseNumber}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[link.case.status] ?? ""}`}>
                      {link.case.status.replace(/_/g, " ")}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${DC_STATUS_COLORS[link.collectionStatus] ?? ""}`}>
                      {link.collectionStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Categories Tab ────────────────────────────────────────────────────── */

function CategoriesTab({ system, canManage, onRefresh }: { system: SystemDetail; canManage: boolean; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("IDENTIFICATION");
  const [newPurpose, setNewPurpose] = useState("");
  const [newBasis, setNewBasis] = useState("LEGITIMATE_INTERESTS");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/data-inventory/systems/${system.id}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCat, processingPurpose: newPurpose || undefined, lawfulBasis: newBasis }),
      });
      if (res.ok) { onRefresh(); setNewPurpose(""); }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(categoryId: string) {
    await fetch(`/api/data-inventory/systems/${system.id}/categories?categoryId=${categoryId}`, { method: "DELETE" });
    onRefresh();
  }

  const existingCategories = system.dataCategories.map((c) => c.category);

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            {DATA_CATEGORIES.filter((c) => !existingCategories.includes(c)).map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input type="text" value={newPurpose} onChange={(e) => setNewPurpose(e.target.value)} placeholder="Processing purpose" className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <select value={newBasis} onChange={(e) => setNewBasis(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            {LAWFUL_BASES.map((b) => <option key={b} value={b}>{b.replace(/_/g, " ")}</option>)}
          </select>
          <button type="submit" disabled={adding} className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
        </form>
      )}

      {system.dataCategories.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No data categories linked yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Purpose</th>
                <th className="px-4 py-3 text-left">Lawful Basis</th>
                <th className="px-4 py-3 text-left">Retention</th>
                <th className="px-4 py-3 text-left">DSAR Relevance</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {system.dataCategories.map((cat) => (
                <tr key={cat.id}>
                  <td className="px-4 py-3 font-medium">{cat.category.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-gray-600">{cat.processingPurpose ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{cat.lawfulBasis.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-gray-600">{cat.retentionPeriod ?? (cat.retentionDays ? `${cat.retentionDays}d` : "—")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {cat.dsarRelevanceAccess && <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700">Access</span>}
                      {cat.dsarRelevanceErasure && <span className="rounded bg-red-100 px-1 py-0.5 text-[10px] text-red-700">Erasure</span>}
                    </div>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleRemove(cat.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Locations Tab ─────────────────────────────────────────────────────── */

function LocationsTab({ system, canManage, onUpdate }: { system: SystemDetail; canManage: boolean; onUpdate: (f: string, v: unknown) => void }) {
  const [primary, setPrimary] = useState(system.dataResidencyPrimary ?? "");
  const [regions, setRegions] = useState(system.processingRegions.join(", "));

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Data Residency & Processing Locations</h3>
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-gray-500">Primary Data Residency</dt>
          {canManage ? (
            <input
              type="text" value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              onBlur={() => onUpdate("dataResidencyPrimary", primary || null)}
              placeholder="e.g., EU, US, Germany"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          ) : (
            <dd className="mt-1">{system.dataResidencyPrimary ?? "Not specified"}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500">Processing Regions</dt>
          {canManage ? (
            <input
              type="text" value={regions}
              onChange={(e) => setRegions(e.target.value)}
              onBlur={() => onUpdate("processingRegions", regions.split(",").map((r) => r.trim()).filter(Boolean))}
              placeholder="e.g., EU, US-East, APAC (comma-separated)"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          ) : (
            <dd className="mt-1">{system.processingRegions.length > 0 ? system.processingRegions.join(", ") : "Not specified"}</dd>
          )}
        </div>
        <Row label="Third-country transfers">
          {canManage ? (
            <input type="checkbox" checked={system.thirdCountryTransfers} onChange={(e) => onUpdate("thirdCountryTransfers", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          ) : (
            <span>{system.thirdCountryTransfers ? "Yes" : "No"}</span>
          )}
        </Row>
        {system.thirdCountryTransfers && system.thirdCountryTransferDetails && (
          <Row label="Transfer details">{system.thirdCountryTransferDetails}</Row>
        )}
      </dl>
    </div>
  );
}

/* ── Vendors Tab ───────────────────────────────────────────────────────── */

function VendorsTab({ system, canManage, onRefresh }: { system: SystemDetail; canManage: boolean; onRefresh: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("PROCESSOR");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/data-inventory/systems/${system.id}/processors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorName: name.trim(), role }),
      });
      if (res.ok) { onRefresh(); setName(""); }
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(processorId: string) {
    await fetch(`/api/data-inventory/systems/${system.id}/processors?processorId=${processorId}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor name" className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm">
            <option value="PROCESSOR">Processor</option>
            <option value="SUBPROCESSOR">Sub-processor</option>
          </select>
          <button type="submit" disabled={adding || !name.trim()} className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">Add</button>
        </form>
      )}

      {system.processors.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No vendors/processors registered.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Contract Ref</th>
                <th className="px-4 py-3 text-left">DPA</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {system.processors.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.vendorName}</td>
                  <td className="px-4 py-3 text-gray-600">{p.role}</td>
                  <td className="px-4 py-3 text-gray-600">{p.contractReference ?? "—"}</td>
                  <td className="px-4 py-3">{p.dpaOnFile ? <span className="text-green-600">Yes</span> : <span className="text-red-500">No</span>}</td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleRemove(p.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Automation Tab ────────────────────────────────────────────────────── */

function AutomationTab({ system, canManage, onUpdate }: { system: SystemDetail; canManage: boolean; onUpdate: (f: string, v: unknown) => void }) {
  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Automation Readiness</h3>
      <dl className="space-y-4 text-sm">
        <Row label="Readiness level">
          {canManage ? (
            <select value={system.automationReadiness} onChange={(e) => onUpdate("automationReadiness", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
              <option value="MANUAL">Manual</option>
              <option value="SEMI_AUTOMATED">Semi-automated</option>
              <option value="API_AVAILABLE">API Available</option>
            </select>
          ) : (
            <span>{AUTO_LABELS[system.automationReadiness]}</span>
          )}
        </Row>
        <Row label="Connector type">
          {canManage ? (
            <select value={system.connectorType} onChange={(e) => onUpdate("connectorType", e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-sm">
              {["NONE", "MOCK", "M365", "GOOGLE", "SALESFORCE", "CUSTOM"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <span>{system.connectorType}</span>
          )}
        </Row>
        <Row label="Export formats">
          {system.exportFormats.length > 0 ? system.exportFormats.join(", ") : "None configured"}
        </Row>
        <Row label="Estimated collection time">
          {system.estimatedCollectionTimeMinutes != null ? `${system.estimatedCollectionTimeMinutes} min` : "Not estimated"}
        </Row>
      </dl>
    </div>
  );
}

/* ── Discovery Tab ─────────────────────────────────────────────────────── */

function DiscoveryTab({ system }: { system: SystemDetail }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">Active Discovery Rules</h3>
      {system.discoveryRules.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No discovery rules configured for this system.</p>
      ) : (
        <div className="space-y-2">
          {system.discoveryRules.map((rule) => (
            <div key={rule.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{rule.name}</span>
                <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">Weight: {rule.weight}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rule.dsarTypes.map((t) => <span key={t} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">{t}</span>)}
                {rule.dataSubjectTypes.map((t) => <span key={t} className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">{t}</span>)}
                {rule.identifierTypes.map((t) => <span key={t} className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Link href="/data-inventory" className="text-sm text-brand-600 hover:underline">
          Manage discovery rules &rarr;
        </Link>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right text-gray-900">{children}</dd>
    </div>
  );
}
