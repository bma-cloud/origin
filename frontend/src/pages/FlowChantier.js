import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ficheApi, formatApiError } from '../lib/api';
import {
  ArrowLeft, Search, Building2, User, MapPin, Calendar,
  CheckCircle2, Clock, Circle, Pencil, Save, X,
  Loader2, ChevronRight, RefreshCw, Filter, Phone,
  ArrowRight, ChevronLeft, HardHat, Briefcase,
  Users, FileText, Plus, Trash2, Lock, Edit3,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Configuration des 13 étapes
// ---------------------------------------------------------------------------
const ETAPES_CONFIG = {
  1:  { label: "Planification et affectation initiale",        description: "Mise au planning · définition des rôles · vérification dossier" },
  2:  { label: "Contre-étude technique",                       description: "Validation technique avant lancement" },
  3:  { label: "Préparation administrative et documentaire",   description: "PPSPS · fiche chantier · Fieldwire · points d'arrêt" },
  4:  { label: "Visite chantier et cadrage opérationnel",      description: "Visite CF · définition besoins · préparation chantier" },
  5:  { label: "Quantification et expression des besoins",     description: "EPI · matériel · quantitatif" },
  6:  { label: "Planification détaillée d'exécution",          description: "Planning · jalons · affectation des tâches" },
  7:  { label: "Approvisionnement et commandes",               description: "Commandes EPI / matériel / matériaux" },
  8:  { label: "Préparation finale et contre-visite",          description: "Contrôle terrain · préparation logistique finale" },
  9:  { label: "Installation et lancement du chantier",        description: "Installation · livraisons · réception matériel" },
  10: { label: "Exécution et suivi chantier",                  description: "Autocontrôles · suivi · problèmes · avancement · Fieldwire" },
  11: { label: "Réception des travaux et clôture documentaire",description: "PV · DOE · tamponné signé" },
  12: { label: "Retour d'expérience et amélioration continue", description: "REX technique / appro / TU" },
};

// ---------------------------------------------------------------------------
// Filtres de période
// ---------------------------------------------------------------------------
const DATE_FILTERS = [
  { id: 'tout',  label: 'Tout',   days: null },
  { id: '2026',  label: '2026',   year: 2026 },
  { id: '2025',  label: '2025',   year: 2025 },
  { id: '3mois', label: '3 mois', days: 90 },
];

// ---------------------------------------------------------------------------
// Statuts
// ---------------------------------------------------------------------------
const STATUTS = ['non_commence', 'en_cours', 'termine'];

const STATUT_CONFIG = {
  non_commence: {
    label: 'Non commencé',
    icon: Circle,
    badgeClass: 'bg-[#f4f4f5] text-[#71717a] border-[#e4e4e7]',
    dotClass: 'bg-[#d4d4d8]',
    rowClass: 'border-[#e4e4e7] bg-white hover:bg-[#fafafa]',
    textClass: 'text-[#09090b]',
  },
  en_cours: {
    label: 'En cours',
    icon: Clock,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-400',
    rowClass: 'border-amber-200 bg-amber-50/60 hover:bg-amber-50',
    textClass: 'text-amber-800',
  },
  termine: {
    label: 'Terminé',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    rowClass: 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50',
    textClass: 'text-emerald-800',
  },
};


function progressPercent(etapes) {
  if (!etapes?.length) return 0;
  return Math.round(etapes.filter(e => e.statut === 'termine').length / etapes.length * 100);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value || 0);
}

function filterByPeriod(fiches, filter) {
  if (!filter) return fiches;
  if (filter.year) {
    return fiches.filter(f => {
      const d = f.date_debut_prevue ? new Date(f.date_debut_prevue) : null;
      return d && d.getFullYear() === filter.year;
    });
  }
  if (filter.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filter.days);
    return fiches.filter(f => {
      const d = f.date_debut_prevue ? new Date(f.date_debut_prevue) : null;
      return d && d >= cutoff;
    });
  }
  return fiches;
}

// ---------------------------------------------------------------------------
// ProgressBar
// ---------------------------------------------------------------------------
function ProgressBar({ percent, className = '' }) {
  const color = percent === 100 ? 'bg-emerald-500'
              : percent > 0    ? 'bg-[#D32F2F]'
              :                  'bg-[#e4e4e7]';
  return (
    <div className={`h-1.5 bg-[#f4f4f5] rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// PersonneCard (éditable ou lecture)
// ---------------------------------------------------------------------------
function PersonneCard({ titre, personne, editable, onSave, icon: Icon = User }) {
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
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs font-semibold text-[#71717a]">{initiales}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-[#a1a1aa] mb-0.5 flex items-center gap-1.5">
          <Icon size={10} />
          {titre}
          {editable && !editing && (
            <button onClick={handleEdit} className="ml-1 p-0.5 rounded text-[#a1a1aa] hover:text-[#D32F2F] transition-colors">
              <Pencil size={10} />
            </button>
          )}
        </p>
        {editing ? (
          <div className="space-y-2 mt-1">
            <Input
              value={form.nom_complet}
              onChange={e => setForm(f => ({ ...f, nom_complet: e.target.value }))}
              placeholder="Prénom Nom"
              className="h-7 text-sm border-[#e4e4e7] focus:border-[#D32F2F]"
              autoFocus
            />
            <Input
              value={form.initiales}
              onChange={e => setForm(f => ({ ...f, initiales: e.target.value.toUpperCase().slice(0, 3) }))}
              placeholder="AB"
              className="h-7 text-sm w-20 border-[#e4e4e7] focus:border-[#D32F2F]"
              maxLength={3}
            />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleSave} disabled={saving}
                className="h-6 text-xs px-2 bg-[#D32F2F] hover:bg-[#B71C1C] text-white">
                {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}
                className="h-6 text-xs px-2 text-[#71717a]">
                <X size={10} />
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-[#09090b]">
              {personne?.nom_complet || <span className="text-[#a1a1aa] font-normal italic">Non renseigné</span>}
            </p>
            {personne?.fonction && (
              <p className="text-xs text-[#71717a]">{personne.fonction}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉTAPE 1 — Planification et affectation initiale
// ---------------------------------------------------------------------------
function EtapePlanification({ fiche, onUpdate }) {
  const [conducteurs, setConducteurs] = useState([]);
  const [chefsDeFile, setChefsDeFile] = useState([]);
  const [formData, setFormData] = useState({
    planifie: false,
    conducteur: '',
    chef_de_file: '',
    dossier: { acompte: false, os: false, contrat: false },
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewConducteurDialog, setShowNewConducteurDialog] = useState(false);
  const [showNewChefDialog, setShowNewChefDialog] = useState(false);
  const [newConducteur, setNewConducteur] = useState('');
  const [newChef, setNewChef] = useState('');

  // Charger les référentiels
  useEffect(() => {
    ficheApi.getConducteurs()
      .then(r => setConducteurs(r.data || []))
      .catch(() => {});
    ficheApi.getChefsDeFile()
      .then(r => setChefsDeFile(r.data || []))
      .catch(() => {});
  }, []);

  // Initialiser depuis fiche
  useEffect(() => {
    if (fiche?.planification) {
      setFormData({
        planifie:     fiche.planification.planifie || false,
        conducteur:   fiche.planification.conducteur || '',
        chef_de_file: fiche.planification.chef_de_file || '',
        dossier: {
          acompte: fiche.planification.dossier?.acompte || false,
          os:      fiche.planification.dossier?.os || false,
          contrat: fiche.planification.dossier?.contrat || false,
        },
      });
    }
  }, [fiche]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheApi.updatePlanification(fiche.code, formData);
      if (onUpdate) await onUpdate();
      toast.success('Planification enregistrée');
      setHasChanges(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddConducteur = () => {
    if (!newConducteur.trim()) return;
    const entry = { id: `c-${Date.now()}`, nom: newConducteur.trim() };
    setConducteurs(prev => [...prev, entry]);
    setFormData(prev => ({ ...prev, conducteur: entry.nom }));
    setNewConducteur('');
    setShowNewConducteurDialog(false);
    setHasChanges(true);
    toast.success('Conducteur ajouté');
  };

  const handleAddChef = () => {
    if (!newChef.trim()) return;
    const entry = { id: `cf-${Date.now()}`, nom: newChef.trim() };
    setChefsDeFile(prev => [...prev, entry]);
    setFormData(prev => ({ ...prev, chef_de_file: entry.nom }));
    setNewChef('');
    setShowNewChefDialog(false);
    setHasChanges(true);
    toast.success('Chef de file ajouté');
  };

  const isDossierComplet =
    formData.dossier.acompte && formData.dossier.os && formData.dossier.contrat;

  return (
    <div className="space-y-5">
      {/* Bandeau modifications */}
      {hasChanges && (
        <div className="bg-red-50 border border-red-200 p-3 flex items-center justify-between">
          <p className="text-sm text-red-700">Modifications non enregistrées</p>
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {saving ? '...' : 'Enregistrer'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card Équipe */}
        <Card className="border border-neutral-200 bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-neutral-400" />
              Équipe chantier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Conducteur */}
            <div className="space-y-2">
              <Label htmlFor="conducteur"
                className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Conducteur de travaux *
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.conducteur}
                  onValueChange={v => { setFormData(p => ({ ...p, conducteur: v })); setHasChanges(true); }}
                >
                  <SelectTrigger id="conducteur" className="flex-1">
                    <SelectValue placeholder="Sélectionner un conducteur" />
                  </SelectTrigger>
                  <SelectContent>
                    {conducteurs.map(c => (
                      <SelectItem key={c.id} value={c.nom}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Dialog open={showNewConducteurDialog} onOpenChange={setShowNewConducteurDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon"
                      className="shrink-0 border-neutral-300 hover:border-neutral-400">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Nouveau conducteur</DialogTitle>
                      <DialogDescription>Ajoutez un nouveau conducteur de travaux</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="new-conducteur">Nom complet</Label>
                      <Input id="new-conducteur" value={newConducteur}
                        onChange={e => setNewConducteur(e.target.value)}
                        placeholder="Ex: Jean Dupont" className="mt-2"
                        onKeyDown={e => e.key === 'Enter' && handleAddConducteur()} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewConducteurDialog(false)}>Annuler</Button>
                      <Button onClick={handleAddConducteur} disabled={!newConducteur.trim()}
                        className="bg-neutral-900 hover:bg-red-600 text-white">Ajouter</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Chef de file */}
            <div className="space-y-2">
              <Label htmlFor="chef-de-file"
                className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Chef de file
              </Label>
              <div className="flex gap-2">
                <Select
                  value={formData.chef_de_file}
                  onValueChange={v => { setFormData(p => ({ ...p, chef_de_file: v })); setHasChanges(true); }}
                >
                  <SelectTrigger id="chef-de-file" className="flex-1">
                    <SelectValue placeholder="Sélectionner un chef de file" />
                  </SelectTrigger>
                  <SelectContent>
                    {chefsDeFile.map(c => (
                      <SelectItem key={c.id} value={c.nom}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Dialog open={showNewChefDialog} onOpenChange={setShowNewChefDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon"
                      className="shrink-0 border-neutral-300 hover:border-neutral-400">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                      <DialogTitle>Nouveau chef de file</DialogTitle>
                      <DialogDescription>Ajoutez un nouveau chef de file</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label htmlFor="new-chef">Nom complet</Label>
                      <Input id="new-chef" value={newChef}
                        onChange={e => setNewChef(e.target.value)}
                        placeholder="Ex: Sophie Leroy" className="mt-2"
                        onKeyDown={e => e.key === 'Enter' && handleAddChef()} />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewChefDialog(false)}>Annuler</Button>
                      <Button onClick={handleAddChef} disabled={!newChef.trim()}
                        className="bg-neutral-900 hover:bg-red-600 text-white">Ajouter</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Checkbox planifié */}
            <div className="flex items-center space-x-2">
              <Checkbox id="planifie" checked={formData.planifie}
                onCheckedChange={checked => { setFormData(p => ({ ...p, planifie: checked })); setHasChanges(true); }} />
              <Label htmlFor="planifie" className="cursor-pointer text-sm font-medium">
                Chantier planifié
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Card Dossier */}
        <Card className="border border-neutral-200 bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-medium flex items-center gap-2">
              <FileText className="h-5 w-5 text-neutral-400" />
              Dossier complet
              {isDossierComplet && (
                <Badge className="bg-green-100 text-green-800 font-medium text-xs ml-2">Complet</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-neutral-600">Vérifiez que tous les documents sont présents</p>
            <div className="space-y-3 mt-4">
              {[
                { key: 'acompte', label: 'Acompte reçu' },
                { key: 'os',      label: 'Ordre de Service (OS)' },
                { key: 'contrat', label: 'Contrat signé' },
              ].map(({ key, label }) => (
                <div key={key}
                  className={`flex items-center justify-between p-4 border transition-colors ${
                    formData.dossier[key] ? 'border-green-200 bg-green-50' : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox id={key} checked={formData.dossier[key]}
                      onCheckedChange={checked => {
                        setFormData(p => ({ ...p, dossier: { ...p.dossier, [key]: checked } }));
                        setHasChanges(true);
                      }} />
                    <Label htmlFor={key} className="cursor-pointer text-sm font-medium">{label}</Label>
                  </div>
                  {formData.dossier[key] && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bouton enregistrer bas de page */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}
          className={`transition-colors ${
            hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
          }`}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉTAPE 2 — Contre-étude technique
// ---------------------------------------------------------------------------
function EtapeContreEtude({ fiche, onUpdate }) {
  const [activeTab, setActiveTab] = useState('devis');
  const [contreEtude, setContreEtude] = useState({
    lignes: [], total_ht: 0, ecart_devis: 0, commentaire_global: '',
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devis, setDevis] = useState({ lignes: [], total_ht: 0, tva: 0, total_ttc: 0 });
  const [loadingDevis, setLoadingDevis] = useState(true);

  // Charger le devis depuis Optim
  useEffect(() => {
    setLoadingDevis(true);
    ficheApi.getDevis(fiche.code)
      .then(r => setDevis(r.data))
      .catch(() => {})
      .finally(() => setLoadingDevis(false));
  }, [fiche.code]);

  useEffect(() => {
    if (fiche?.contre_etude) {
      setContreEtude({
        lignes:            fiche.contre_etude.lignes || [],
        total_ht:          fiche.contre_etude.total_ht || 0,
        ecart_devis:       fiche.contre_etude.ecart_devis || 0,
        commentaire_global: fiche.contre_etude.commentaire_global || '',
      });
    }
  }, [fiche]);

  const calculateTotals = (lignes) => {
    const total_ht = lignes.reduce((sum, l) => sum + (l.montant || 0), 0);
    const ecart_devis = total_ht - (devis.total_ht || 0);
    return { total_ht, ecart_devis };
  };

  const handleUpdateLigne = (index, field, value) => {
    const newLignes = [...contreEtude.lignes];
    newLignes[index] = { ...newLignes[index], [field]: value };
    if (field === 'quantite' || field === 'prix_unitaire') {
      const q  = field === 'quantite'     ? parseFloat(value) || 0 : parseFloat(newLignes[index].quantite) || 0;
      const pu = field === 'prix_unitaire' ? parseFloat(value) || 0 : parseFloat(newLignes[index].prix_unitaire) || 0;
      newLignes[index].montant = q * pu;
    }
    setContreEtude({ ...contreEtude, lignes: newLignes, ...calculateTotals(newLignes) });
    setHasChanges(true);
  };

  const handleDeleteLigne = (index) => {
    const newLignes = contreEtude.lignes.filter((_, i) => i !== index);
    setContreEtude({ ...contreEtude, lignes: newLignes, ...calculateTotals(newLignes) });
    setHasChanges(true);
  };

  const handleAddLigne = () => {
    const newLigne = { id: `ce-${Date.now()}`, designation: '', unite: '', quantite: 0, prix_unitaire: 0, montant: 0, commentaire: '' };
    const newLignes = [...contreEtude.lignes, newLigne];
    setContreEtude({ ...contreEtude, lignes: newLignes, ...calculateTotals(newLignes) });
    setHasChanges(true);
  };

  const handleCopyFromDevis = () => {
    if (!devis.lignes?.length) { toast.error('Aucune ligne de devis à copier'); return; }
    const copied = devis.lignes.map(l => ({
      ...l, id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`, commentaire: '',
    }));
    setContreEtude({ ...contreEtude, lignes: copied, ...calculateTotals(copied) });
    setHasChanges(true);
    toast.success('Lignes copiées depuis le devis');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheApi.updateContreEtude(fiche.code, contreEtude);
      if (onUpdate) await onUpdate();
      toast.success('Contre-étude enregistrée');
      setHasChanges(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Bandeau modifications */}
      {hasChanges && (
        <div className="bg-red-50 border border-red-200 p-3 flex items-center justify-between">
          <p className="text-sm text-red-700">Modifications non enregistrées</p>
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {saving ? '...' : 'Enregistrer'}
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Header tabs */}
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-neutral-100 border border-neutral-200 p-1">
            <TabsTrigger value="devis" className="px-6 py-2 flex items-center gap-2">
              <Lock className="h-4 w-4" /> Devis
            </TabsTrigger>
            <TabsTrigger value="contre-etude" className="px-6 py-2 flex items-center gap-2">
              <Edit3 className="h-4 w-4" /> Contre-étude
            </TabsTrigger>
          </TabsList>
          {activeTab === 'contre-etude' && (
            <Button variant="outline" onClick={handleCopyFromDevis}
              className="border-neutral-300 text-neutral-700 hover:bg-neutral-100">
              Copier depuis devis
            </Button>
          )}
        </div>

        {/* Tab Devis (lecture seule) */}
        <TabsContent value="devis">
          <Card className="border border-neutral-200 bg-neutral-50">
            {loadingDevis && (
              <div className="flex items-center justify-center py-10 gap-2 text-neutral-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement du devis Optim…
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-xl font-medium flex items-center gap-2">
                <FileText className="h-5 w-5 text-neutral-400" />
                Devis initial
                <Badge className="bg-neutral-200 text-neutral-600 font-medium text-xs ml-2">Lecture seule</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-100">
                    {['Désignation', 'Unité', 'Qté', 'P.U.', 'Montant'].map(h => (
                      <TableHead key={h} className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!devis.lignes?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-neutral-500">Aucune ligne de devis</TableCell>
                    </TableRow>
                  ) : devis.lignes.map(ligne => (
                    <TableRow key={ligne.id} className="bg-neutral-50">
                      <TableCell className="text-sm">{ligne.designation}</TableCell>
                      <TableCell className="text-sm">{ligne.unite}</TableCell>
                      <TableCell className="text-sm text-right">{ligne.quantite}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(ligne.prix_unitaire)}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{formatCurrency(ligne.montant)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-neutral-200">
                    <span className="text-neutral-600">Total HT</span>
                    <span className="font-bold text-neutral-900">{formatCurrency(devis.total_ht)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-neutral-200">
                    <span className="text-neutral-600">TVA (20%)</span>
                    <span className="text-neutral-700">{formatCurrency(devis.tva)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="font-bold text-neutral-900">Total TTC</span>
                    <span className="font-bold text-lg text-neutral-900">{formatCurrency(devis.total_ttc)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Contre-étude (éditable) */}
        <TabsContent value="contre-etude">
          <Card className="border border-neutral-200 bg-white">
            <CardHeader>
              <CardTitle className="text-xl font-medium flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-red-600" />
                Contre-étude
                <Badge className="bg-red-100 text-red-700 font-medium text-xs ml-2">Éditable</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Désignation</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500 w-20">Unité</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500 w-24 text-right">Qté</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500 w-28 text-right">P.U.</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500 w-28 text-right">Montant</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Note</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!contreEtude.lignes.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-neutral-500">
                        Aucune ligne — Ajoutez ou copiez depuis le devis
                      </TableCell>
                    </TableRow>
                  ) : contreEtude.lignes.map((ligne, index) => (
                    <TableRow key={ligne.id}>
                      <TableCell>
                        <Input value={ligne.designation}
                          onChange={e => handleUpdateLigne(index, 'designation', e.target.value)}
                          className="h-8 text-sm" placeholder="Désignation..." />
                      </TableCell>
                      <TableCell>
                        <Input value={ligne.unite}
                          onChange={e => handleUpdateLigne(index, 'unite', e.target.value)}
                          className="h-8 text-sm" placeholder="m²" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={ligne.quantite}
                          onChange={e => handleUpdateLigne(index, 'quantite', e.target.value)}
                          className="h-8 text-sm text-right" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" value={ligne.prix_unitaire}
                          onChange={e => handleUpdateLigne(index, 'prix_unitaire', e.target.value)}
                          className="h-8 text-sm text-right" />
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(ligne.montant)}
                      </TableCell>
                      <TableCell>
                        <Input value={ligne.commentaire || ''}
                          onChange={e => handleUpdateLigne(index, 'commentaire', e.target.value)}
                          className="h-8 text-sm" placeholder="Note..." />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteLigne(index)}
                          className="h-8 w-8 text-neutral-400 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Button variant="outline" onClick={handleAddLigne}
                className="mt-4 border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                <Plus className="h-4 w-4 mr-2" /> Ajouter une ligne
              </Button>

              <Separator className="my-6" />

              {/* Commentaire + Totaux */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                    Commentaire global
                  </Label>
                  <Textarea
                    value={contreEtude.commentaire_global || ''}
                    onChange={e => { setContreEtude({ ...contreEtude, commentaire_global: e.target.value }); setHasChanges(true); }}
                    placeholder="Notes sur la contre-étude..."
                    className="mt-2" rows={3}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-neutral-200">
                    <span className="text-neutral-600">Contre-étude HT</span>
                    <span className="font-bold text-neutral-900">{formatCurrency(contreEtude.total_ht)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-neutral-200">
                    <span className="text-neutral-600">Devis HT</span>
                    <span className="text-neutral-500">{formatCurrency(devis.total_ht)}</span>
                  </div>
                  <div className={`flex justify-between py-3 px-3 -mx-3 ${
                    contreEtude.ecart_devis < 0 ? 'bg-green-50' :
                    contreEtude.ecart_devis > 0 ? 'bg-red-50' : 'bg-neutral-50'
                  }`}>
                    <span className="font-bold flex items-center gap-2">
                      {contreEtude.ecart_devis < 0
                        ? <TrendingDown className="h-4 w-4 text-green-600" />
                        : contreEtude.ecart_devis > 0
                        ? <TrendingUp className="h-4 w-4 text-red-600" />
                        : null}
                      Écart
                    </span>
                    <span className={`font-bold ${
                      contreEtude.ecart_devis < 0 ? 'text-green-600' :
                      contreEtude.ecart_devis > 0 ? 'text-red-600' : 'text-neutral-600'
                    }`}>
                      {contreEtude.ecart_devis >= 0 ? '+' : ''}{formatCurrency(contreEtude.ecart_devis)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bouton enregistrer bas de page */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}
          className={`transition-colors ${
            hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
          }`}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VUE ÉTAPE — détail d'une étape avec fil d'Ariane
// ---------------------------------------------------------------------------
function VueEtape({ fiche, etapeNum, onBack, onUpdateEtape, onNavigate, onRefreshFiche }) {
  const etape  = fiche.etapes?.find(e => e.numero === etapeNum);
  const meta   = ETAPES_CONFIG[etapeNum] || { label: `Étape ${etapeNum}`, description: '' };
  const config = STATUT_CONFIG[etape?.statut || 'non_commence'];
  const Icon   = config.icon;
  const [busy, setBusy] = useState(false);

  // Auto-set to "en_cours" on mount if "non_commence"
  const autoSetRef = useRef(false);
  useEffect(() => {
    autoSetRef.current = false;
  }, [etapeNum]);
  useEffect(() => {
    if (autoSetRef.current) return;
    autoSetRef.current = true;
    if (etape?.statut === 'non_commence') {
      onUpdateEtape(etapeNum, 'en_cours').catch(() => {});
    }
  }, [etape, etapeNum, onUpdateEtape]);

  const handleSetStatut = async (statut) => {
    if (busy) return;
    setBusy(true);
    try {
      await onUpdateEtape(etapeNum, statut);
    } finally {
      setBusy(false);
    }
  };

  const hasPrev = etapeNum > 1;
  const hasNext = etapeNum < 12;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-[#71717a]">
        <button onClick={() => onBack('list')} className="hover:text-[#D32F2F] transition-colors font-medium">
          FlowChantier
        </button>
        <ChevronRight size={14} className="text-[#a1a1aa]" />
        <button onClick={() => onBack('fiche')} className="hover:text-[#D32F2F] transition-colors font-medium truncate max-w-[120px]">
          {fiche.code}
        </button>
        <ChevronRight size={14} className="text-[#a1a1aa]" />
        <span className="text-[#09090b] font-semibold">Étape {etapeNum}</span>
      </nav>

      {/* Header card */}
      <Card className="border-[#e4e4e7]">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">
                  Étape {etapeNum} / 13
                </span>
                <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                  <Icon size={11} className="mr-1" />
                  {config.label}
                </Badge>
              </div>
              <h2 className="text-xl font-bold text-[#09090b]">{meta.label}</h2>
              {meta.description && (
                <p className="text-sm text-[#71717a] mt-1">{meta.description}</p>
              )}
            </div>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
              etape?.statut === 'termine' ? 'bg-emerald-100' :
              etape?.statut === 'en_cours' ? 'bg-amber-100' :
              'bg-[#f4f4f5]'
            }`}>
              <Icon size={24} className={
                etape?.statut === 'termine' ? 'text-emerald-600' :
                etape?.statut === 'en_cours' ? 'text-amber-600' :
                'text-[#a1a1aa]'
              } />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions statut */}
      <Card className="border-[#e4e4e7]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-[#09090b]">Avancement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {STATUTS.map(s => {
              const cfg = STATUT_CONFIG[s];
              const SI  = cfg.icon;
              const active = etape?.statut === s;
              return (
                <button
                  key={s}
                  onClick={() => handleSetStatut(s)}
                  disabled={busy || active}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all
                    ${active
                      ? `${cfg.badgeClass} cursor-default`
                      : 'bg-white border-[#e4e4e7] text-[#71717a] hover:border-[#D32F2F] hover:text-[#D32F2F]'
                    } ${busy ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {busy && active ? <Loader2 size={14} className="animate-spin" /> : <SI size={14} />}
                  {cfg.label}
                  {active && <span className="text-[10px] opacity-70 ml-1">(actuel)</span>}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Contenu spécifique selon l'étape */}
      {etapeNum === 1 && <EtapePlanification fiche={fiche} onUpdate={onRefreshFiche} />}
      {etapeNum === 2 && <EtapeContreEtude fiche={fiche} onUpdate={onRefreshFiche} />}

      {/* Progress bar du chantier */}
      <Card className="border-[#e4e4e7]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#71717a] font-medium">Avancement global — {fiche.nom}</span>
            <span className="text-xs font-semibold text-[#09090b]">
              {fiche.etapes?.filter(e => e.statut === 'termine').length ?? 0} / 12
            </span>
          </div>
          <ProgressBar percent={progressPercent(fiche.etapes)} />
        </CardContent>
      </Card>

      {/* Navigation entre étapes */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => hasPrev && onNavigate(etapeNum - 1)}
          disabled={!hasPrev}
          className="flex items-center gap-2 border-[#e4e4e7] text-[#71717a] hover:text-[#09090b] hover:border-[#D32F2F]"
        >
          <ChevronLeft size={16} />
          {hasPrev ? `Étape ${etapeNum - 1}` : 'Première étape'}
        </Button>
        <span className="text-xs text-[#a1a1aa]">{etapeNum} / 12</span>
        <Button
          variant="outline"
          onClick={() => hasNext && onNavigate(etapeNum + 1)}
          disabled={!hasNext}
          className="flex items-center gap-2 border-[#e4e4e7] text-[#71717a] hover:text-[#09090b] hover:border-[#D32F2F]"
        >
          {hasNext ? `Étape ${etapeNum + 1}` : 'Dernière étape'}
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VUE FICHE — détail d'un chantier (Address Book 2 style)
// ---------------------------------------------------------------------------
function VueFiche({ fiche: initialFiche, onBack, onOpenEtape }) {
  const [fiche, setFiche] = useState(initialFiche);

  const handleSaveCf = async (data) => {
    await ficheApi.updateCf(fiche.code, data);
    setFiche(f => ({ ...f, cf: data }));
  };

  const pct      = progressPercent(fiche.etapes);
  const termines = fiche.etapes?.filter(e => e.statut === 'termine').length ?? 0;

  const clientLabel = fiche.client?.nom_reduit || fiche.client?.raison_sociale || '';
  const adresseLabel = [fiche.adresse?.ligne1, fiche.adresse?.cp, fiche.adresse?.ville]
    .filter(Boolean).join(', ');

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-[#71717a]">
        <button onClick={onBack} className="hover:text-[#D32F2F] transition-colors font-medium">
          FlowChantier
        </button>
        <ChevronRight size={14} className="text-[#a1a1aa]" />
        <span className="text-[#09090b] font-semibold">{fiche.code}</span>
      </nav>

      {/* Header chantier */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {clientLabel && (
            <p className="text-sm font-medium text-[#D32F2F] mb-0.5">{clientLabel}</p>
          )}
          <h1 className="text-2xl font-bold text-[#09090b] leading-tight">
            {fiche.nom_complet || fiche.nom}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            <code className="text-xs bg-[#f4f4f5] border border-[#e4e4e7] px-2 py-0.5 rounded font-mono text-[#71717a]">
              {fiche.code_marche || fiche.code}
            </code>
            {fiche.code_marche && (
              <code className="text-xs text-[#a1a1aa] font-mono">{fiche.code}</code>
            )}
            {fiche.societe?.libelle && (
              <span className="text-xs text-[#71717a]">{fiche.societe.libelle}</span>
            )}
          </div>
        </div>
        <Badge variant="outline" className={
          pct === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
          pct > 0     ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-[#f4f4f5] text-[#71717a] border-[#e4e4e7]'
        }>
          {pct === 100 ? 'Terminé' : pct > 0 ? `${pct}%` : 'Non démarré'}
        </Badge>
      </div>

      {/* Progression */}
      <Card className="border-[#e4e4e7]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-[#09090b]">Avancement global</span>
            <span className="text-sm text-[#71717a]">{termines} / {fiche.etapes?.length ?? 13} étapes</span>
          </div>
          <ProgressBar percent={pct} />
        </CardContent>
      </Card>

      {/* Main layout: personnes + infos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Personnes */}
        <Card className="border-[#e4e4e7]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-[#09090b] flex items-center gap-2">
              <User size={14} className="text-[#D32F2F]" />
              Équipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <PersonneCard titre="Conducteur de travaux" personne={fiche.conducteur} editable={false} icon={HardHat} />
            <Separator className="bg-[#f4f4f5]" />
            <PersonneCard titre="Chef de File (CF)" personne={fiche.cf} editable={true} onSave={handleSaveCf} icon={Briefcase} />
            {fiche.ca?.nom_complet && (
              <>
                <Separator className="bg-[#f4f4f5]" />
                <PersonneCard titre="Chargé d'Affaire" personne={fiche.ca} editable={false} icon={Phone} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Infos chantier */}
        <Card className="lg:col-span-2 border-[#e4e4e7]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-[#09090b] flex items-center gap-2">
              <Building2 size={14} className="text-[#D32F2F]" />
              Informations chantier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                ['Client',       fiche.client?.raison_sociale],
                ['Société ITS',  fiche.societe?.raison_sociale],
                ['Début prévu',  formatDate(fiche.date_debut_prevue)],
                ['Fin prévue',   formatDate(fiche.date_fin_prevue)],
                ['Début réel',   formatDate(fiche.date_debut_reelle)],
                ['Fin réelle',   formatDate(fiche.date_fin_reelle)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-0.5">{label}</p>
                  <p className="text-sm text-[#09090b]">{value || '—'}</p>
                </div>
              ))}
            </div>
            {adresseLabel && (
              <div className="mt-5 pt-4 border-t border-[#f4f4f5]">
                <p className="text-[11px] uppercase tracking-wider text-[#a1a1aa] font-semibold mb-1 flex items-center gap-1">
                  <MapPin size={10} /> Adresse chantier
                </p>
                <p className="text-sm text-[#09090b]">{adresseLabel}</p>
              </div>
            )}
            {fiche.synced_at && (
              <p className="text-[11px] text-[#a1a1aa] mt-4 flex items-center gap-1">
                <RefreshCw size={9} />
                Optim · {new Date(fiche.synced_at).toLocaleString('fr-FR')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 13 Étapes */}
      <Card className="border-[#e4e4e7]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-[#09090b] flex items-center justify-between">
            <span>Suivi des 13 étapes</span>
            <span className="text-xs font-normal text-[#71717a]">Cliquer pour ouvrir</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[#f4f4f5]">
            {fiche.etapes?.map(etape => {
              const meta   = ETAPES_CONFIG[etape.numero] || { label: `Étape ${etape.numero}` };
              const config = STATUT_CONFIG[etape.statut || 'non_commence'];
              const Icon   = config.icon;
              return (
                <button
                  key={etape.numero}
                  onClick={() => onOpenEtape(etape.numero)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors group ${config.rowClass}`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotClass}`} />
                  <span className="text-xs font-mono text-[#a1a1aa] w-5 flex-shrink-0">{etape.numero}</span>
                  <span className="flex-1 text-sm font-medium text-[#09090b]">{meta.label}</span>
                  <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${config.badgeClass}`}>
                    <Icon size={10} className="mr-1" />
                    {config.label}
                  </Badge>
                  <ChevronRight size={14} className="text-[#a1a1aa] group-hover:text-[#D32F2F] transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VUE GLOBALE — liste des fiches (cards style Address Book 2)
// ---------------------------------------------------------------------------
function VueGlobale({ fiches, onSelect, search, setSearch }) {
  const [periodFilter, setPeriodFilter] = useState('2026');

  const activeFilter = DATE_FILTERS.find(d => d.id === periodFilter);
  const filtered = filterByPeriod(
    fiches.filter(f => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        f.code_marche?.toLowerCase().includes(q) ||
        f.code?.toLowerCase().includes(q) ||
        f.nom?.toLowerCase().includes(q) ||
        f.nom_complet?.toLowerCase().includes(q) ||
        f.client?.raison_sociale?.toLowerCase().includes(q) ||
        f.client?.nom_reduit?.toLowerCase().includes(q) ||
        f.conducteur?.nom_complet?.toLowerCase().includes(q) ||
        f.cf?.nom_complet?.toLowerCase().includes(q)
      );
    }),
    activeFilter
  );

  const stats = {
    total:    filtered.length,
    sans_cf:  filtered.filter(f => !f.cf?.nom_complet).length,
    termines: filtered.filter(f => progressPercent(f.etapes) === 100).length,
  };

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Chantiers',  value: stats.total,    color: 'text-[#09090b]' },
          { label: 'Sans CF',    value: stats.sans_cf,  color: stats.sans_cf > 0 ? 'text-[#D32F2F]' : 'text-[#09090b]' },
          { label: 'Terminés',   value: stats.termines, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label} className="border-[#e4e4e7]">
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-[#71717a] font-semibold">{s.label}</p>
              <p className={`text-3xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" size={15} />
          <Input
            placeholder="Code, nom, client, conducteur, CF…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 border-[#e4e4e7] bg-white focus:border-[#D32F2F] text-[#09090b] placeholder:text-[#a1a1aa]"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#e4e4e7] rounded-lg px-1.5 py-1.5">
          <Filter size={13} className="text-[#a1a1aa] mx-1" />
          {DATE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setPeriodFilter(f.id)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                periodFilter === f.id
                  ? 'bg-[#D32F2F] text-white'
                  : 'text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de cartes */}
      {filtered.length === 0 ? (
        <Card className="border-[#e4e4e7]">
          <CardContent className="py-16 text-center">
            <Building2 size={40} className="mx-auto mb-3 text-[#d4d4d8]" />
            <p className="text-[#a1a1aa] text-sm">Aucun chantier trouvé</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(f => {
            const pct           = progressPercent(f.etapes);
            const clientLabel   = f.client?.nom_reduit || f.client?.raison_sociale || '';
            const conducteur    = f.conducteur?.nom_complet || '';
            const cf            = f.cf?.nom_complet || '';
            const adresseVille  = f.adresse?.ville || '';

            return (
              <Card
                key={f.code}
                onClick={() => onSelect(f)}
                className="border-[#e4e4e7] hover:border-[#D32F2F]/40 hover:shadow-md cursor-pointer group transition-all duration-200 bg-white"
              >
                <CardContent className="p-0">
                  <div className="h-1 rounded-t-xl bg-gradient-to-r from-[#D32F2F] to-[#ef5350] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        {clientLabel && (
                          <p className="text-xs font-semibold text-[#D32F2F] truncate mb-0.5">{clientLabel}</p>
                        )}
                        <h3 className="font-bold text-[#09090b] text-sm leading-snug group-hover:text-[#D32F2F] transition-colors line-clamp-2">
                          {f.nom_complet || f.nom}
                        </h3>
                      </div>
                      <Badge variant="outline" className={`ml-2 flex-shrink-0 text-[10px] ${
                        pct === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        pct > 0     ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-[#f4f4f5] text-[#a1a1aa] border-[#e4e4e7]'
                      }`}>
                        {pct === 100 ? 'Terminé' : pct > 0 ? `${pct}%` : '—'}
                      </Badge>
                    </div>
                    <Separator className="my-3 bg-[#f4f4f5]" />
                    <div className="space-y-1.5 text-xs text-[#71717a]">
                      {conducteur && (
                        <div className="flex items-center gap-2">
                          <HardHat size={11} className="text-[#a1a1aa] flex-shrink-0" />
                          <span className="truncate">{conducteur}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Briefcase size={11} className={`flex-shrink-0 ${cf ? 'text-[#a1a1aa]' : 'text-[#D32F2F]'}`} />
                        {cf
                          ? <span className="truncate">{cf}</span>
                          : <span className="text-[#D32F2F] italic">CF non renseigné</span>
                        }
                      </div>
                      {adresseVille && (
                        <div className="flex items-center gap-2">
                          <MapPin size={11} className="text-[#a1a1aa] flex-shrink-0" />
                          <span className="truncate">{adresseVille}</span>
                        </div>
                      )}
                      {f.date_debut_prevue && (
                        <div className="flex items-center gap-2">
                          <Calendar size={11} className="text-[#a1a1aa] flex-shrink-0" />
                          <span>{formatDate(f.date_debut_prevue)}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <ProgressBar percent={pct} />
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <code className="text-[10px] text-[#a1a1aa] font-mono">{f.code_marche || f.code}</code>
                      <ArrowRight size={14} className="text-[#d4d4d8] group-hover:text-[#D32F2F] transition-colors" />
                    </div>
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
// COMPOSANT PRINCIPAL
// ---------------------------------------------------------------------------
export default function FlowChantier() {
  useParams();
  const { user } = useAuth();

  const [fiches,   setFiches]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);
  const [etapeNum, setEtapeNum] = useState(null);
  const [search,   setSearch]   = useState('');

  const fetchFiches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ficheApi.get('');
      setFiches(res.data?.fiches ?? []);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiches(); }, [fetchFiches]);

  const handleUpdateEtape = useCallback(async (numero, statut) => {
    await ficheApi.updateEtape(selected.code, numero, statut);
    const updated = {
      ...selected,
      etapes: selected.etapes.map(e => e.numero === numero ? { ...e, statut } : e),
    };
    setSelected(updated);
    setFiches(prev => prev.map(f => f.code === updated.code ? updated : f));
  }, [selected]);

  // Rafraîchir la fiche sélectionnée depuis l'API (après planification / contre-étude)
  const handleRefreshFiche = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await ficheApi.get(selected.code);
      const updated = res.data;
      setSelected(updated);
      setFiches(prev => prev.map(f => f.code === updated.code ? updated : f));
    } catch (err) {
      // Silently fail
    }
  }, [selected]);

  const handleEtapeBack = (dest) => {
    if (dest === 'list') { setSelected(null); setEtapeNum(null); }
    else                 { setEtapeNum(null); }
  };

  const view = etapeNum != null ? 'etape' : selected ? 'fiche' : 'list';

  const headerTitle = view === 'etape'
    ? `${selected?.code} — ${ETAPES_CONFIG[etapeNum]?.label ?? `Étape ${etapeNum}`}`
    : view === 'fiche'
    ? selected?.code
    : null;

  if (loading) return (
    <div className="min-h-screen bg-[#f4f4f5] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-[#D32F2F]/20 border-t-[#D32F2F] rounded-full animate-spin" />
        <p className="text-sm text-[#71717a]">Chargement des chantiers…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f4f5]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#e4e4e7]">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {(view === 'fiche' || view === 'etape') && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => view === 'etape' ? setEtapeNum(null) : setSelected(null)}
                className="text-[#71717a] hover:text-[#09090b] h-8 w-8 flex-shrink-0"
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded bg-[#D32F2F] flex items-center justify-center flex-shrink-0">
                <HardHat size={13} className="text-white" />
              </div>
              <h1 className="font-bold text-[#09090b]">
                <span className="text-[#D32F2F]">Flow</span>Chantier
              </h1>
              {headerTitle && (
                <span className="text-[#a1a1aa] text-sm hidden sm:inline truncate">/ {headerTitle}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {view === 'list' && (
              <button
                onClick={fetchFiches}
                className="p-1.5 rounded-lg text-[#71717a] hover:text-[#09090b] hover:bg-[#f4f4f5] transition-colors"
                title="Rafraîchir"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#D32F2F]/10 border border-[#D32F2F]/20 flex items-center justify-center text-[10px] font-bold text-[#D32F2F]">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </div>
              <span className="text-sm text-[#71717a] hidden sm:inline">{user?.prenom} {user?.nom}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
        {view === 'etape' ? (
          <VueEtape
            fiche={selected}
            etapeNum={etapeNum}
            onBack={handleEtapeBack}
            onUpdateEtape={handleUpdateEtape}
            onNavigate={setEtapeNum}
            onRefreshFiche={handleRefreshFiche}
          />
        ) : view === 'fiche' ? (
          <VueFiche
            fiche={selected}
            onBack={() => setSelected(null)}
            onOpenEtape={setEtapeNum}
          />
        ) : (
          <VueGlobale
            fiches={fiches}
            onSelect={f => { setSelected(f); setEtapeNum(null); }}
            search={search}
            setSearch={setSearch}
          />
        )}
      </main>
    </div>
  );
}
