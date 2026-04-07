import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ficheApi, formatApiError } from '../lib/api';
import {
  ArrowLeft, Search, Building2, User, Calendar,
  CheckCircle2, Clock, Circle, Pencil, Save, X,
  Loader2, ChevronRight, RefreshCw, Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Configuration des 13 étapes de la Fiche Chef de File
// Étapes 1-4 : nommées. Étapes 5-13 : à compléter par le métier.
// ---------------------------------------------------------------------------
const ETAPES_CONFIG = {
  1:  { label: "Ouverture d'affaire",         description: "Réception et enregistrement du dossier" },
  2:  { label: "Constitution du dossier",      description: "Rassemblement des pièces administratives et techniques" },
  3:  { label: "Étude technique & chiffrage",  description: "Analyse des plans, quantitatifs et estimation" },
  4:  { label: "Lancement des travaux",         description: "Planification des ressources et démarrage terrain" },
  5:  { label: "Étape 5",                       description: "À définir" },
  6:  { label: "Étape 6",                       description: "À définir" },
  7:  { label: "Étape 7",                       description: "À définir" },
  8:  { label: "Étape 8",                       description: "À définir" },
  9:  { label: "Étape 9",                       description: "À définir" },
  10: { label: "Étape 10",                      description: "À définir" },
  11: { label: "Étape 11",                      description: "À définir" },
  12: { label: "Étape 12",                      description: "À définir" },
  13: { label: "Clôture d'affaire",             description: "À définir" },
};

// ---------------------------------------------------------------------------
// Filtres de période (appliqués sur date_debut_prevue)
// ---------------------------------------------------------------------------
const DATE_FILTERS = [
  { id: 'semaine', label: 'Cette semaine', days: 7 },
  { id: 'mois',    label: 'Ce mois',       days: 30 },
  { id: '3mois',   label: '3 mois',        days: 90 },
  { id: '6mois',   label: '6 mois',        days: 180 },
  { id: 'tout',    label: 'Tout',           days: null },
];

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------
const STATUTS = ['non_commence', 'en_cours', 'termine'];

const STATUT_CONFIG = {
  non_commence: {
    label: 'Non commencé', icon: Circle,
    className: 'text-zinc-500 border-zinc-700 bg-zinc-800/50', iconClass: 'text-zinc-500',
  },
  en_cours: {
    label: 'En cours', icon: Clock,
    className: 'text-amber-400 border-amber-500/40 bg-amber-500/10', iconClass: 'text-amber-400',
  },
  termine: {
    label: 'Terminé', icon: CheckCircle2,
    className: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', iconClass: 'text-emerald-400',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nextStatut(current) {
  const idx = STATUTS.indexOf(current);
  return STATUTS[(idx + 1) % STATUTS.length];
}

function progressPercent(etapes) {
  if (!etapes?.length) return 0;
  return Math.round(etapes.filter(e => e.statut === 'termine').length / etapes.length * 100);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function filterByPeriod(fiches, days) {
  if (!days) return fiches;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return fiches.filter(f => {
    const d = f.date_debut_prevue ? new Date(f.date_debut_prevue) : null;
    return d && d >= cutoff;
  });
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------
function ProgressBar({ percent, className = '' }) {
  const color = percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-amber-500' : 'bg-zinc-700';
  return (
    <div className={`h-1.5 bg-white/[0.06] rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function PersonneCard({ titre, personne, editable, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ nom_complet: '', initiales: '' });
  const [saving, setSaving]   = useState(false);

  const handleEdit = () => {
    setForm({ nom_complet: personne?.nom_complet || '', initiales: personne?.initiales || '' });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      setEditing(false);
      toast.success(`${titre} mis à jour`);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const initiales = personne?.nom_complet
    ? personne.nom_complet.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <Card className="bg-white/[0.03] border-white/[0.08]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-zinc-400 flex items-center justify-between">
          <span className="flex items-center gap-2"><User size={14} />{titre}</span>
          {editable && !editing && (
            <button onClick={handleEdit} className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors">
              <Pencil size={13} />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-zinc-500 mb-1">Nom complet</Label>
              <Input value={form.nom_complet} onChange={e => setForm(f => ({ ...f, nom_complet: e.target.value }))}
                placeholder="Prénom Nom" className="bg-white/[0.04] border-white/[0.10] h-8 text-sm" autoFocus />
            </div>
            <div>
              <Label className="text-xs text-zinc-500 mb-1">Initiales</Label>
              <Input value={form.initiales}
                onChange={e => setForm(f => ({ ...f, initiales: e.target.value.toUpperCase().slice(0, 3) }))}
                placeholder="AB" className="bg-white/[0.04] border-white/[0.10] h-8 text-sm w-24" maxLength={3} />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-[#FF3B30] hover:bg-[#FF3B30]/90">
                {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                Enregistrer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs text-zinc-400">
                <X size={12} className="mr-1" /> Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white">{initiales}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {personne?.nom_complet || <span className="text-zinc-500 italic">Non renseigné</span>}
              </p>
              {personne?.fonction && <p className="text-xs text-zinc-500">{personne.fonction}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EtapeItem({ etape, onToggle }) {
  const config = STATUT_CONFIG[etape.statut] || STATUT_CONFIG.non_commence;
  const Icon   = config.icon;
  const meta   = ETAPES_CONFIG[etape.numero] || { label: `Étape ${etape.numero}`, description: '' };
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try { await onToggle(etape.numero, nextStatut(etape.statut)); }
    finally { setBusy(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left w-full transition-all duration-150
        hover:brightness-110 active:scale-[0.98] ${config.className} ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      {busy
        ? <Loader2 size={15} className="animate-spin flex-shrink-0 mt-0.5" />
        : <Icon size={15} className={`flex-shrink-0 mt-0.5 ${config.iconClass}`} />
      }
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{meta.label}</p>
        {meta.description && meta.description !== 'À définir' && (
          <p className="text-xs opacity-60 mt-0.5 truncate">{meta.description}</p>
        )}
      </div>
      <span className="text-[10px] opacity-60 flex-shrink-0 mt-0.5">{etape.numero}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// VUE GLOBALE — liste des fiches avec filtres
// ---------------------------------------------------------------------------
function VueGlobale({ fiches, onSelect, search, setSearch }) {
  const [periodFilter, setPeriodFilter] = useState('3mois');

  const filtered = filterByPeriod(
    fiches.filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        f.code?.toLowerCase().includes(q) ||
        f.nom?.toLowerCase().includes(q) ||
        f.ca?.nom_complet?.toLowerCase().includes(q) ||
        f.cf?.nom_complet?.toLowerCase().includes(q)
      );
    }),
    DATE_FILTERS.find(d => d.id === periodFilter)?.days
  );

  const stats = {
    total:    filtered.length,
    sans_cf:  filtered.filter(f => !f.cf?.nom_complet).length,
    termines: filtered.filter(f => progressPercent(f.etapes) === 100).length,
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: stats.total,    color: 'text-white' },
          { label: 'Sans CF',  value: stats.sans_cf,  color: 'text-[#FF3B30]' },
          { label: 'Terminés', value: stats.termines, color: 'text-emerald-400' },
        ].map(s => (
          <Card key={s.label} className="bg-white/[0.03] border-white/[0.08]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recherche + filtres période */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <Input
            placeholder="Rechercher code, nom, CA, CF…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.08] focus:border-white/20"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-lg px-1.5 py-1.5">
          <Filter size={14} className="text-zinc-500 mx-1.5" />
          {DATE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setPeriodFilter(f.id)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                periodFilter === f.id
                  ? 'bg-[#FF3B30] text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Building2 size={48} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-zinc-500">Aucun chantier trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(f => {
            const pct = progressPercent(f.etapes);
            return (
              <Card
                key={f.code}
                onClick={() => onSelect(f)}
                className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] cursor-pointer group transition-all"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <code className="text-xs text-zinc-500">{f.code}</code>
                    <Badge
                      variant="outline"
                      className={pct === 100
                        ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px]'
                        : pct > 0
                        ? 'text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px]'
                        : 'text-zinc-500 border-zinc-700 text-[10px]'
                      }
                    >
                      {pct === 100 ? 'Terminé' : pct > 0 ? `${pct}%` : 'Non démarré'}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-white text-base mb-3 group-hover:text-[#FF3B30] transition-colors line-clamp-1">
                    {f.nom}
                  </h3>

                  <div className="space-y-1 text-xs text-zinc-500 mb-3">
                    {f.ca?.nom_complet && (
                      <div className="flex items-center gap-1.5">
                        <User size={11} /> CA : {f.ca.nom_complet}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <User size={11} />
                      {f.cf?.nom_complet
                        ? <span className="text-zinc-400">CF : {f.cf.nom_complet}</span>
                        : <span className="italic text-zinc-600">CF non renseigné</span>
                      }
                    </div>
                    {f.date_debut_prevue && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} /> {formatDate(f.date_debut_prevue)}
                      </div>
                    )}
                  </div>

                  <ProgressBar percent={pct} />

                  <div className="mt-3 flex justify-end">
                    <ChevronRight size={16} className="text-zinc-600 group-hover:text-[#FF3B30] transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VUE DÉTAIL — Fiche Chef de File
// ---------------------------------------------------------------------------
function VueFiche({ fiche: initialFiche }) {
  const [fiche, setFiche] = useState(initialFiche);

  const handleSaveCf = async (data) => {
    await ficheApi.updateCf(fiche.code, data);
    setFiche(f => ({ ...f, cf: data }));
  };

  const handleToggleEtape = async (numero, statut) => {
    await ficheApi.updateEtape(fiche.code, numero, statut);
    setFiche(f => ({
      ...f,
      etapes: f.etapes.map(e => e.numero === numero ? { ...e, statut } : e),
    }));
  };

  const pct      = progressPercent(fiche.etapes);
  const termines = fiche.etapes?.filter(e => e.statut === 'termine').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Progression globale */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Avancement global</span>
            <span className="text-sm font-semibold text-white">{termines} / {fiche.etapes?.length ?? 13} étapes</span>
          </div>
          <ProgressBar percent={pct} />
          <p className="text-right text-xs text-zinc-500 mt-1">{pct}%</p>
        </CardContent>
      </Card>

      {/* Infos + Personnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Infos Optim */}
        <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Building2 size={14} /> Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ['Code',         fiche.code],
                ['Nom',          fiche.nom],
                ['Début prévu',  formatDate(fiche.date_debut_prevue)],
                ['Fin prévue',   formatDate(fiche.date_fin_prevue)],
                ['Début réel',   formatDate(fiche.date_debut_reelle)],
                ['Fin réelle',   formatDate(fiche.date_fin_reelle)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</p>
                  <p className="text-sm text-white">{value || '—'}</p>
                </div>
              ))}
            </div>
            {fiche.synced_at && (
              <p className="text-[11px] text-zinc-600 mt-4 flex items-center gap-1">
                <Calendar size={10} /> Optim · {new Date(fiche.synced_at).toLocaleString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Personnes */}
        <div className="space-y-3">
          <PersonneCard titre="Chargé d'Affaire (CA)" personne={fiche.ca} editable={false} />
          <PersonneCard titre="Chef de File (CF)" personne={fiche.cf} editable={true} onSave={handleSaveCf} />
        </div>
      </div>

      {/* 13 Étapes */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-400">
            Suivi des étapes — cliquer pour faire avancer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fiche.etapes?.map(etape => (
              <EtapeItem key={etape.numero} etape={etape} onToggle={handleToggleEtape} />
            ))}
          </div>
          {/* Légende */}
          <div className="flex items-center gap-5 mt-4 pt-4 border-t border-white/[0.06]">
            {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <span key={key} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Icon size={13} className={cfg.iconClass} /> {cfg.label}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPOSANT PRINCIPAL
// ---------------------------------------------------------------------------
export default function FlowChantier() {
  useParams(); // outilId disponible si besoin futur
  const { user } = useAuth();

  const [fiches,   setFiches]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState('');

  const fetchFiches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ficheApi.get('');          // GET /api/fiches (liste)
      setFiches(res.data?.fiches ?? []);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiches(); }, [fetchFiches]);

  // Mise à jour locale après retour depuis VueFiche (CF ou étapes modifiés)
  const handleBack = (updatedFiche) => {
    if (updatedFiche) {
      setFiches(prev => prev.map(f => f.code === updatedFiche.code ? updatedFiche : f));
    }
    setSelected(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#FF3B30]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header fixe */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selected && (
              <Button variant="ghost" size="icon" onClick={() => handleBack(null)}>
                <ArrowLeft size={20} />
              </Button>
            )}
            <h1 className="text-xl font-bold">
              <span className="text-[#FF3B30]">Flow</span>Chantier
            </h1>
            {selected && (
              <span className="text-zinc-500 hidden sm:inline">
                / <code className="text-zinc-400">{selected.code}</code> — {selected.nom}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!selected && (
              <button
                onClick={fetchFiches}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw size={16} />
              </button>
            )}
            <span className="text-sm text-zinc-500 hidden sm:inline">{user?.prenom} {user?.nom}</span>
            <div className="w-8 h-8 rounded-full bg-[#FF3B30] flex items-center justify-center text-xs font-bold">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {selected ? (
          <VueFiche fiche={selected} onBack={handleBack} />
        ) : (
          <VueGlobale fiches={fiches} onSelect={setSelected} search={search} setSearch={setSearch} />
        )}
      </main>
    </div>
  );
}
