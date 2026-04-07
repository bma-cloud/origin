import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ficheApi, formatApiError } from '../lib/api';
import {
  ArrowLeft, User, Building2, Calendar, CheckCircle2,
  Clock, Circle, Pencil, Save, X, Loader2, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUTS = ['non_commence', 'en_cours', 'termine'];

const STATUT_CONFIG = {
  non_commence: {
    label: 'Non commencé',
    icon: Circle,
    className: 'text-zinc-500 border-zinc-700 bg-zinc-800/50',
    iconClass: 'text-zinc-500',
  },
  en_cours: {
    label: 'En cours',
    icon: Clock,
    className: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    iconClass: 'text-amber-400',
  },
  termine: {
    label: 'Terminé',
    icon: CheckCircle2,
    className: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    iconClass: 'text-emerald-400',
  },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function nextStatut(current) {
  const idx = STATUTS.indexOf(current);
  return STATUTS[(idx + 1) % STATUTS.length];
}

function progressPercent(etapes) {
  if (!etapes?.length) return 0;
  const done = etapes.filter(e => e.statut === 'termine').length;
  return Math.round((done / etapes.length) * 100);
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</span>
      <span className="text-sm text-white">{value || '—'}</span>
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
          <span className="flex items-center gap-2">
            <User size={15} />
            {titre}
          </span>
          {editable && !editing && (
            <button
              onClick={handleEdit}
              className="p-1 rounded text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-zinc-500 mb-1">Nom complet</Label>
              <Input
                value={form.nom_complet}
                onChange={e => setForm(f => ({ ...f, nom_complet: e.target.value }))}
                placeholder="Prénom Nom"
                className="bg-white/[0.04] border-white/[0.10] h-8 text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500 mb-1">Initiales</Label>
              <Input
                value={form.initiales}
                onChange={e => setForm(f => ({ ...f, initiales: e.target.value.toUpperCase().slice(0, 3) }))}
                placeholder="AB"
                className="bg-white/[0.04] border-white/[0.10] h-8 text-sm w-24"
                maxLength={3}
              />
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
            <div className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-white">{initiales}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {personne?.nom_complet || <span className="text-zinc-500 italic">Non renseigné</span>}
              </p>
              {personne?.fonction && (
                <p className="text-xs text-zinc-500">{personne.fonction}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EtapeItem({ etape, onToggle, disabled }) {
  const config  = STATUT_CONFIG[etape.statut] || STATUT_CONFIG.non_commence;
  const Icon    = config.icon;
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (disabled || busy) return;
    setBusy(true);
    try {
      await onToggle(etape.numero, nextStatut(etape.statut));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || busy}
      className={`
        flex items-center gap-3 p-3 rounded-lg border text-left w-full
        transition-all duration-150 hover:brightness-110 active:scale-[0.98]
        ${config.className}
        ${busy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
      `}
    >
      {busy
        ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
        : <Icon size={16} className={`flex-shrink-0 ${config.iconClass}`} />
      }
      <span className="text-sm font-medium">Étape {etape.numero}</span>
      <span className="ml-auto text-xs opacity-70">{config.label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function FicheChefDeFile() {
  const { code } = useParams();
  const navigate  = useNavigate();
  const [fiche, setFiche]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchFiche = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ficheApi.get(code);
      setFiche(res.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { fetchFiche(); }, [fetchFiche]);

  const handleSaveCf = async (data) => {
    await ficheApi.updateCf(code, data);
    setFiche(f => ({ ...f, cf: data }));
  };

  const handleToggleEtape = async (numero, statut) => {
    await ficheApi.updateEtape(code, numero, statut);
    setFiche(f => ({
      ...f,
      etapes: f.etapes.map(e => e.numero === numero ? { ...e, statut } : e),
    }));
  };

  // --- Loading ---
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#FF3B30]" />
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <p className="text-zinc-400">{error}</p>
        <Button variant="outline" onClick={fetchFiche} className="gap-2">
          <RefreshCw size={16} /> Réessayer
        </Button>
      </div>
    );
  }

  const progress = progressPercent(fiche?.etapes);
  const etapesTerminees = fiche?.etapes?.filter(e => e.statut === 'termine').length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* En-tête */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-white truncate">{fiche.nom}</h1>
            <Badge variant="outline" className="text-xs font-mono text-zinc-400 border-zinc-700">
              {fiche.code}
            </Badge>
          </div>
          <p className="text-sm text-zinc-500 mt-0.5">Fiche Chef de File</p>
        </div>
      </div>

      {/* Progression globale */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-400">Avancement</span>
            <span className="text-sm font-semibold text-white">
              {etapesTerminees} / {fiche.etapes?.length ?? 13} étapes
            </span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF3B30] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-right text-xs text-zinc-500 mt-1">{progress}%</p>
        </CardContent>
      </Card>

      {/* Informations générales + Personnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Infos Optim */}
        <Card className="lg:col-span-2 bg-white/[0.03] border-white/[0.08]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-400 flex items-center gap-2">
              <Building2 size={15} />
              Informations générales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoRow label="Code chantier" value={fiche.code} />
              <InfoRow label="Nom" value={fiche.nom} />
              <InfoRow label="Début prévu"   value={formatDate(fiche.date_debut_prevue)} />
              <InfoRow label="Fin prévue"    value={formatDate(fiche.date_fin_prevue)} />
              <InfoRow label="Début réel"    value={formatDate(fiche.date_debut_reelle)} />
              <InfoRow label="Fin réelle"    value={formatDate(fiche.date_fin_reelle)} />
            </div>
            {fiche.synced_at && (
              <p className="text-[11px] text-zinc-600 mt-4 flex items-center gap-1">
                <Calendar size={11} />
                Données Optim · {new Date(fiche.synced_at).toLocaleString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Personnes */}
        <div className="space-y-4">
          <PersonneCard
            titre="Chargé d'Affaire (CA)"
            personne={fiche.ca}
            editable={false}
          />
          <PersonneCard
            titre="Chef de File (CF)"
            personne={fiche.cf}
            editable={true}
            onSave={handleSaveCf}
          />
        </div>
      </div>

      {/* Étapes */}
      <Card className="bg-white/[0.03] border-white/[0.08]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-400">
            Suivi des étapes — cliquer pour faire avancer le statut
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {fiche.etapes?.map(etape => (
              <EtapeItem
                key={etape.numero}
                etape={etape}
                onToggle={handleToggleEtape}
              />
            ))}
          </div>
          {/* Légende */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <span key={key} className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <Icon size={13} className={cfg.iconClass} />
                  {cfg.label}
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
