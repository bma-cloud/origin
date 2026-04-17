import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  AlertTriangle, Settings, Truck, Paperclip, Image, ClipboardList, Camera,
  Download, Droplet, Waves, Building, Layers, Package, GripVertical,
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
// Configuration des 11 étapes
// ---------------------------------------------------------------------------
const ETAPES_CONFIG = {
  1:  { label: "Planification et affectation initiale",        description: "Mise au planning · définition des rôles · vérification dossier" },
  2:  { label: "Contre-étude / Débourser",                     description: "Contre devis · planning prévisionnel · affectation tâches · besoin humain · sous-traitance · Fieldwire" },
  3:  { label: "Préparation administrative et documentaire",   description: "PPSPS · fiche chantier · Fieldwire · points d'arrêt" },
  4:  { label: "Préparation de chantier",                      description: "Fiche prépa · installations · logistique · tâches — S-3 à S-2" },
  5:  { label: "Visite chantier et cadrage opérationnel",      description: "Visite CF · définition besoins · cadrage terrain" },
  6:  { label: "Approvisionnement et commandes",               description: "Checklist matériel · EPI · commandes dépôt" },
  7:  { label: "Planification détaillée d'exécution",          description: "Planning · jalons · affectation des tâches" },
  8:  { label: "Préparation finale et contre-visite",          description: "Contrôle terrain · préparation logistique finale" },
  9:  { label: "Installation et lancement du chantier",        description: "Installation · livraisons · réception matériel" },
  10: { label: "Exécution et suivi chantier",                  description: "Autocontrôles · suivi · problèmes · avancement · Fieldwire" },
  11: { label: "Réception des travaux et clôture documentaire",description: "PV · DOE · tamponné signé" },
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

// Ordre d'affichage et labels des catégories déboursé
const CATEGORIE_ORDER = ['MO', 'MAT', 'ST', 'LOC', 'VTE', 'FR', ''];
const CATEGORIE_LABELS = {
  MO:  "Main d'Œuvre",
  MAT: 'Matériaux',
  ST:  'Sous-Traitance',
  LOC: 'Location',
  VTE: 'Vente',
  FR:  'Frais',
  '':  'Autres',
};

// Composants stables définis au niveau module pour éviter les remounts React
// (définir un composant à l'intérieur d'un render crée une nouvelle référence
//  à chaque render, ce qui force React à démonter/remonter les nœuds DOM)
function TH({ children, right }) {
  return (
    <TableHead className={`text-xs font-semibold uppercase tracking-widest text-neutral-500 ${right ? 'text-right' : ''}`}>
      {children}
    </TableHead>
  );
}
function THCompact({ children, right }) {
  return (
    <TableHead className={`text-[10px] font-semibold uppercase tracking-widest text-neutral-400 py-2 ${right ? 'text-right' : ''}`}>
      {children}
    </TableHead>
  );
}

function DevisGroupedView({ lignes, total_ht, tva, total_ttc }) {
  if (!lignes?.length) {
    return <p className="text-center py-8 text-neutral-500 text-sm">Aucune ligne de déboursé</p>;
  }

  // Grouper les lignes : niveau 1 = catégorie, niveau 2 = sous_famille
  // On groupe tous les types de lignes (TL=1 et TL=2) ensemble
  const groupes = {};
  for (const l of lignes) {
    const cat = l.categorie || '';
    const fam = l.sous_famille || l.famille || '—';
    if (!groupes[cat]) groupes[cat] = {};
    if (!groupes[cat][fam]) groupes[cat][fam] = [];
    groupes[cat][fam].push(l);
  }

  const categoriesPresentes = CATEGORIE_ORDER.filter(c => groupes[c]);

  // Totaux par catégorie : sommer uniquement les TL=1 (ressources) pour éviter le double-comptage
  const catTotals = {};
  for (const l of lignes) {
    if (l.type_ligne === 1 && l.categorie) {
      catTotals[l.categorie] = (catTotals[l.categorie] || 0) + (parseFloat(l.montant) || 0);
    }
    // Lignes sans type_ligne (ancien format) : compter normalement
    if (!l.type_ligne && l.categorie) {
      catTotals[l.categorie] = (catTotals[l.categorie] || 0) + (parseFloat(l.montant) || 0);
    }
  }

  return (
    <>
      {/* Pastilles résumé par catégorie */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categoriesPresentes.map(cat => (
          <div key={cat} className="px-3 py-1.5 rounded text-xs font-semibold bg-neutral-200 text-neutral-700">
            {CATEGORIE_LABELS[cat]} — {formatCurrency(catTotals[cat] || 0)}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-neutral-100">
              <TH>N°</TH>
              <TH>Désignation</TH>
              <TH>Unité</TH>
              <TH right>Qté</TH>
              <TH right>P.U. Déboursé</TH>
              <TH right>Montant</TH>
              <TH>Fournisseur</TH>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categoriesPresentes.map(cat => {
              const fams = groupes[cat];
              const cat_total = catTotals[cat] || 0;
              return (
                <React.Fragment key={cat}>
                  {/* Niveau 1 : en-tête catégorie */}
                  <TableRow className="bg-neutral-700 text-white">
                    <TableCell colSpan={5} className="py-2 font-bold text-xs uppercase tracking-wider text-white">
                      {CATEGORIE_LABELS[cat]}
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm whitespace-nowrap py-2 text-white">
                      {formatCurrency(cat_total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  {/* Niveau 2 : sous-familles */}
                  {Object.entries(fams).map(([fam, fam_lignes]) => {
                    const fam_total = fam_lignes
                      .filter(l => l.type_ligne === 1 || !l.type_ligne)
                      .reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);
                    return (
                      <React.Fragment key={`${cat}-${fam}`}>
                        {/* En-tête sous-famille */}
                        <TableRow className="bg-neutral-100">
                          <TableCell colSpan={5} className="py-1.5 pl-6 font-semibold text-xs text-neutral-600 italic">
                            {fam}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-neutral-600 whitespace-nowrap py-1.5">
                            {formatCurrency(fam_total)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                        {/* Lignes individuelles */}
                        {fam_lignes.map(l => {
                          const isOuvrage = l.type_ligne === 2;
                          return (
                            <TableRow key={l.id} className={isOuvrage ? 'bg-neutral-50' : 'hover:bg-neutral-50/80'}>
                              <TableCell className="text-xs text-neutral-400 font-mono pl-8">
                                {!isOuvrage && l.numero_ligne}
                              </TableCell>
                              <TableCell className={`text-sm max-w-xs ${isOuvrage ? 'font-semibold pl-8' : 'pl-12'}`}>
                                <div className="whitespace-pre-wrap break-words">{l.designation}</div>
                              </TableCell>
                              <TableCell className="text-sm">{!isOuvrage && l.unite}</TableCell>
                              <TableCell className="text-sm text-right">{!isOuvrage && l.quantite}</TableCell>
                              <TableCell className="text-sm text-right">{!isOuvrage && formatCurrency(l.prix_unitaire)}</TableCell>
                              <TableCell className={`text-sm text-right ${isOuvrage ? 'font-bold' : 'font-medium'}`}>
                                {formatCurrency(l.montant)}
                              </TableCell>
                              <TableCell className="text-sm text-neutral-500">{!isOuvrage && l.fournisseur}</TableCell>
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-6 flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-neutral-200">
            <span className="text-neutral-600">Total déboursé HT</span>
            <span className="font-bold">{formatCurrency(total_ht)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-neutral-200">
            <span className="text-neutral-600">TVA</span>
            <span>{formatCurrency(tva)}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="font-bold">Total TTC</span>
            <span className="font-bold text-lg">{formatCurrency(total_ttc)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// buildDevisTree — reconstruit l'arborescence depuis la liste plate
// Hiérarchie via VDL_VDL_ID (parent_id) :
//   - parent_id = null → ligne racine
//   - TypeLigne : 4=titre, 2/3=sous-titre, 1=detail, 0=entête (ignoré)
// ---------------------------------------------------------------------------
function buildDevisTree(lignes) {
  const map = {};
  lignes.forEach(l => { map[l.id] = { ...l, children: [] }; });

  const roots = [];
  lignes.forEach(l => {
    if (l.parent_id && map[l.parent_id]) {
      map[l.parent_id].children.push(map[l.id]);
    } else {
      roots.push(map[l.id]);
    }
  });
  return roots;
}

// ---------------------------------------------------------------------------
// DevisCommercialView — vue fidèle au devis Optim (vte_doc_ligne)
// Colonnes : N° | Code | Désignation | Un. | Qté | PAU | Total HT | Fixé
// Hiérarchie : titre (gras, fond sombre) → sous-titre (indenté) → detail (indenté ++)
// ---------------------------------------------------------------------------
function DevisCommercialView({ lignes, total_ht }) {
  if (!lignes?.length) {
    return <p className="text-center py-8 text-neutral-500 text-sm">Aucune ligne de devis disponible.</p>;
  }

  const tree = buildDevisTree(lignes);

  // Total PAU = somme du PAU des grands titres (type_ligne === 4)
  // Chaque titre agrège déjà le PAU de toutes ses lignes dans Optim
  const total_pau = lignes
    .filter(l => l.type_ligne === 4)
    .reduce((s, l) => s + (l.pau || 0), 0);

  const totauxJsx = (
    <div className="mt-6 flex justify-end">
      <div className="w-64 space-y-2 text-sm">
        <div className="flex justify-between py-2 border-b border-neutral-200">
          <span className="text-neutral-600">Total PAU</span>
          <span className="tabular-nums">{formatCurrency(total_pau)}</span>
        </div>
        <div className="flex justify-between py-2 border-b border-neutral-200">
          <span className="font-bold">Total HT</span>
          <span className="font-bold tabular-nums">{formatCurrency(total_ht)}</span>
        </div>
      </div>
    </div>
  );

  // Rendu récursif d'un nœud
  // TypeLigne : 0=entête doc (transparent), 1=detail, 2/3=sous-titre, 4=titre majeur
  // Indentation via node.niveau pour la colonne Désignation
  const renderNode = (node) => {
    if (node.type_ligne === 0) {
      return <React.Fragment key={node.id}>{node.children.map(renderNode)}</React.Fragment>;
    }

    const isTitre     = node.type_ligne === 4;
    const isSousTitre = node.type_ligne === 2 || node.type_ligne === 3;
    const indent      = Math.max(0, (node.niveau || 0) - 1) * 16; // px d'indentation

    if (isTitre) {
      return (
        <React.Fragment key={node.id}>
          <tr className="bg-neutral-800 border-b border-neutral-700">
            <td className="py-2.5 px-3 text-xs font-mono text-neutral-400 whitespace-nowrap">{node.numero_ligne}</td>
            <td className="py-2.5 px-3 text-xs text-neutral-400 truncate">{node.code}</td>
            <td className="py-2.5 font-bold text-sm text-white" style={{ paddingLeft: `${12 + indent}px` }}>{node.designation}</td>
            <td /><td />
            <td className="py-2.5 px-3 text-right text-xs text-neutral-300 tabular-nums whitespace-nowrap">{node.pau ? formatCurrency(node.pau) : ''}</td>
            <td className="py-2.5 px-3 text-right font-bold text-sm text-white tabular-nums whitespace-nowrap">{formatCurrency(node.montant)}</td>
            <td />
          </tr>
          {node.children.map(renderNode)}
        </React.Fragment>
      );
    }

    if (isSousTitre) {
      return (
        <React.Fragment key={node.id}>
          <tr className="bg-neutral-100 border-b border-neutral-200">
            <td className="py-2 px-3 text-xs font-mono text-neutral-400 whitespace-nowrap">{node.numero_ligne}</td>
            <td className="py-2 px-3 text-xs text-neutral-400 truncate">{node.code}</td>
            <td className="py-2 font-semibold text-sm text-neutral-700" style={{ paddingLeft: `${12 + indent}px` }}>{node.designation}</td>
            <td /><td />
            <td className="py-2 px-3 text-right text-xs text-neutral-500 tabular-nums whitespace-nowrap">{node.pau ? formatCurrency(node.pau) : ''}</td>
            <td className="py-2 px-3 text-right font-semibold text-sm text-neutral-700 tabular-nums whitespace-nowrap">{formatCurrency(node.montant)}</td>
            <td />
          </tr>
          {node.children.map(renderNode)}
        </React.Fragment>
      );
    }

    // Ligne de détail
    return (
      <tr key={node.id} className="border-b border-neutral-100 hover:bg-neutral-50">
        <td className="py-1.5 px-3 text-xs font-mono text-neutral-400 whitespace-nowrap">{node.numero_ligne}</td>
        <td className="py-1.5 px-3 text-xs text-neutral-500 truncate" title={node.code}>{node.code}</td>
        <td className="py-1.5 text-sm text-neutral-800" style={{ paddingLeft: `${12 + indent}px` }}>{node.designation}</td>
        <td className="py-1.5 px-3 text-xs text-neutral-500 text-center whitespace-nowrap">{node.unite || '—'}</td>
        <td className="py-1.5 px-3 text-xs text-right tabular-nums text-neutral-600 whitespace-nowrap">
          {node.quantite != null && node.quantite !== 0 ? node.quantite : '—'}
        </td>
        <td className="py-1.5 px-3 text-xs text-right tabular-nums text-neutral-500 whitespace-nowrap">
          {node.pau ? formatCurrency(node.pau) : '—'}
        </td>
        <td className="py-1.5 px-3 text-sm text-right font-medium tabular-nums text-neutral-800 whitespace-nowrap">
          {formatCurrency(node.montant)}
        </td>
        <td className="py-1.5 px-3 text-center">
          {node.is_fixe && <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200">F</span>}
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className="w-full text-sm border-collapse">
          <colgroup>
            <col style={{ width: '56px' }} />   {/* N° */}
            <col style={{ width: '112px' }} />  {/* Code */}
            <col />                              {/* Désignation — prend le reste */}
            <col style={{ width: '48px' }} />   {/* Un. */}
            <col style={{ width: '64px' }} />   {/* Qté */}
            <col style={{ width: '112px' }} />  {/* PAU */}
            <col style={{ width: '112px' }} />  {/* Total HT */}
            <col style={{ width: '48px' }} />   {/* Fixé */}
          </colgroup>
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-200">
              {[
                { label: 'N°',         cls: 'pl-3 text-left' },
                { label: 'Code',       cls: 'pl-3 text-left' },
                { label: 'Désignation',cls: 'pl-3 text-left' },
                { label: 'Un.',        cls: 'text-center' },
                { label: 'Qté',        cls: 'pr-3 text-right' },
                { label: 'PAU',        cls: 'pr-3 text-right' },
                { label: 'Total HT',   cls: 'pr-3 text-right' },
                { label: 'Fixé',       cls: 'text-center' },
              ].map(({ label, cls }) => (
                <th key={label} className={`py-2.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-500 ${cls}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tree.map(renderNode)}
          </tbody>
        </table>
      </div>
      {totauxJsx}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper — groupe les lignes F11 en sections [{ ouvrage, ressources }]
// type_ligne 2 = ouvrage (container/titre), type_ligne 1 = ressource (ligne)
// ---------------------------------------------------------------------------
function groupF11ByOuvrage(lignes) {
  const groups = [];
  let current = null;
  for (const l of (lignes || [])) {
    if (l.type_ligne === 2) {
      if (current) groups.push(current);
      current = { ouvrage: l, ressources: [] };
    } else if (l.type_ligne === 1) {
      if (!current) current = { ouvrage: null, ressources: [] };
      current.ressources.push(l);
    }
  }
  if (current) groups.push(current);
  return groups;
}

// ---------------------------------------------------------------------------
// ContreEtudeStructuree — vue hiérarchique éditable (onglet 2)
// Convention delta : delta = montant_devis − montant_CE
//   delta > 0 → gain (CE < devis) → vert
//   delta < 0 → perte (CE > devis) → rouge
// ---------------------------------------------------------------------------
function ContreEtudeStructuree({ devis, sections, onSectionsChange }) {
  const groups = useMemo(() => groupF11ByOuvrage(devis.lignes), [devis.lignes]);
  const [open, setOpen] = useState({});       // { [ouvrageId]: bool }
  const [dragOver, setDragOver] = useState(null); // { oid, idx } ligne survolée
  const dragSrc = useRef(null); // { oid, idx } ligne en cours de drag

  // Pour un ouvrage donné, renvoie les lignes CE ou, à défaut, les ressources Optim d'origine
  const getSectionLignes = useCallback((ouvrageId, group) => {
    if (sections[ouvrageId]) return sections[ouvrageId].lignes;
    return group.ressources;
  }, [sections]);

  const updateLigne = (ouvrageId, group, idx, field, value) => {
    const current = getSectionLignes(ouvrageId, group);
    const updated = current.map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, [field]: value };
      if (field === 'quantite' || field === 'prix_unitaire') {
        const q  = parseFloat(field === 'quantite'      ? value : l.quantite)      || 0;
        const pu = parseFloat(field === 'prix_unitaire' ? value : l.prix_unitaire) || 0;
        next.montant = q * pu;
      }
      return next;
    });
    onSectionsChange(prev => ({ ...prev, [ouvrageId]: { lignes: updated } }));
  };

  const addLigne = (ouvrageId, group) => {
    const current = getSectionLignes(ouvrageId, group);
    const newLigne = { id: `ce-${Date.now()}`, designation: '', unite: '', quantite: 0, prix_unitaire: 0, montant: 0, fournisseur: '', commentaire: '', categorie: '' };
    onSectionsChange(prev => ({ ...prev, [ouvrageId]: { lignes: [...current, newLigne] } }));
  };

  const deleteLigne = (ouvrageId, group, idx) => {
    const current = getSectionLignes(ouvrageId, group);
    onSectionsChange(prev => ({ ...prev, [ouvrageId]: { lignes: current.filter((_, i) => i !== idx) } }));
  };

  const resetSection = (ouvrageId, group) => {
    onSectionsChange(prev => {
      const next = { ...prev };
      delete next[ouvrageId];
      return next;
    });
  };

  const reorderLignes = (ouvrageId, group, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const current = [...getSectionLignes(ouvrageId, group)];
    const [moved] = current.splice(fromIdx, 1);
    current.splice(toIdx, 0, moved);
    onSectionsChange(prev => ({ ...prev, [ouvrageId]: { lignes: current } }));
  };

  const toggleOpen = (oid) => setOpen(prev => ({ ...prev, [oid]: !(prev[oid] !== false) }));


  if (!groups.length) {
    return <p className="text-center py-10 text-neutral-400 text-sm">Aucune ligne de déboursé structurée disponible.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        if (!g.ouvrage) return null;
        const oid           = g.ouvrage.id;
        const isModified    = !!sections[oid];
        const sectionLignes = getSectionLignes(oid, g);
        const originalAmt   = parseFloat(g.ouvrage.montant) || 0;
        // Non modifié → montant CE = ouvrage.montant (agrégé Optim, jamais recalculé depuis les sous-éléments)
        // Modifié     → montant CE = somme des lignes saisies par l'utilisateur
        const revisedAmt    = isModified
          ? sectionLignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0)
          : originalAmt;
        const delta         = originalAmt - revisedAmt; // positif = gain
        const isOpen        = open[oid] !== false;      // ouvert par défaut

        return (
          <div key={oid} className="border border-neutral-200 rounded-lg overflow-hidden">
            {/* En-tête section cliquable */}
            <div
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none transition-colors ${
                isModified && delta > 0.01  ? 'bg-emerald-50 hover:bg-emerald-100/60' :
                isModified && delta < -0.01 ? 'bg-red-50 hover:bg-red-100/60' :
                                              'bg-neutral-100 hover:bg-neutral-200/60'
              }`}
              onClick={() => toggleOpen(oid)}
            >
              <ChevronRight size={14} className={`text-neutral-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
              <span className="flex-1 text-sm font-semibold text-neutral-800 truncate">{g.ouvrage.designation}</span>
              {isModified && (
                <span className="text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-50 rounded border border-amber-200 flex-shrink-0">modifié</span>
              )}
              <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                <span className="text-neutral-400 tabular-nums">{formatCurrency(originalAmt)} <span className="text-neutral-300">devis</span></span>
                <span className="font-semibold tabular-nums">{formatCurrency(revisedAmt)} <span className="text-neutral-400 font-normal">CE</span></span>
                {isModified && Math.abs(delta) > 0.01 && (
                  <span className={`font-bold tabular-nums px-2 py-0.5 rounded text-[11px] ${
                    delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {delta > 0 ? '+' : ''}{formatCurrency(delta)}
                  </span>
                )}
              </div>
            </div>

            {/* Corps dépliable */}
            {isOpen && (
              <div className="p-3 bg-white border-t border-neutral-100">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-neutral-100">
                        <TableHead className="w-6" />
                        <THCompact>Désignation</THCompact>
                        <THCompact>Unité</THCompact>
                        <THCompact right>Qté</THCompact>
                        <THCompact right>P.U.</THCompact>
                        <THCompact right>Montant</THCompact>
                        <THCompact>Fournisseur</THCompact>
                        <THCompact>Note</THCompact>
                        <TableHead className="w-8" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sectionLignes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-4 text-neutral-400 text-xs">Aucune ligne</TableCell>
                        </TableRow>
                      ) : sectionLignes.map((l, li) => {
                        const isDragTarget = dragOver?.oid === oid && dragOver?.idx === li;
                        return (
                          <TableRow
                            key={l.id || li}
                            draggable
                            onDragStart={() => { dragSrc.current = { oid, idx: li }; }}
                            onDragOver={e => { e.preventDefault(); setDragOver({ oid, idx: li }); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={() => {
                              setDragOver(null);
                              if (dragSrc.current?.oid === oid) {
                                reorderLignes(oid, g, dragSrc.current.idx, li);
                              }
                              dragSrc.current = null;
                            }}
                            onDragEnd={() => { dragSrc.current = null; setDragOver(null); }}
                            className={`border-neutral-50 transition-colors ${
                              isDragTarget ? 'border-t-2 border-t-[#D32F2F] bg-red-50/30' : 'hover:bg-neutral-50/50'
                            }`}
                          >
                          <TableCell className="py-1 px-1 w-6">
                            <GripVertical size={13} className="text-neutral-300 cursor-grab active:cursor-grabbing" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input value={l.designation || ''} onChange={e => updateLigne(oid, g, li, 'designation', e.target.value)}
                              className="h-7 text-xs border-neutral-200 focus:border-[#D32F2F]" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input value={l.unite || ''} onChange={e => updateLigne(oid, g, li, 'unite', e.target.value)}
                              className="h-7 text-xs w-14 border-neutral-200" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input type="number" step="0.01" value={l.quantite} onChange={e => updateLigne(oid, g, li, 'quantite', e.target.value)}
                              className="h-7 text-xs text-right w-20 border-neutral-200" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input type="number" step="0.01" value={l.prix_unitaire} onChange={e => updateLigne(oid, g, li, 'prix_unitaire', e.target.value)}
                              className="h-7 text-xs text-right w-24 border-neutral-200" />
                          </TableCell>
                          <TableCell className="py-1 text-right text-xs font-semibold tabular-nums whitespace-nowrap">
                            {formatCurrency(parseFloat(l.montant) || 0)}
                          </TableCell>
                          <TableCell className="py-1">
                            <Input value={l.fournisseur || ''} onChange={e => updateLigne(oid, g, li, 'fournisseur', e.target.value)}
                              className="h-7 text-xs border-neutral-200" placeholder="—" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Input value={l.commentaire || ''} onChange={e => updateLigne(oid, g, li, 'commentaire', e.target.value)}
                              className="h-7 text-xs border-neutral-200" placeholder="—" />
                          </TableCell>
                          <TableCell className="py-1">
                            <Button variant="ghost" size="icon" onClick={() => deleteLigne(oid, g, li)}
                              className="h-7 w-7 text-neutral-300 hover:text-red-500 hover:bg-red-50">
                              <Trash2 size={12} />
                            </Button>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <Button variant="ghost" size="sm" onClick={() => addLigne(oid, g)}
                    className="text-xs text-neutral-500 hover:text-neutral-800 h-7 px-2">
                    <Plus size={12} className="mr-1" /> Ajouter une ligne
                  </Button>
                  {isModified && (
                    <Button variant="ghost" size="sm" onClick={() => resetSection(oid, g)}
                      className="text-xs text-neutral-400 hover:text-amber-600 h-7 px-2">
                      <RefreshCw size={12} className="mr-1" /> Réinitialiser depuis Optim
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DebourseContreEtudeView — déboursé CE avec comparaison vs devis (onglet 3)
// ---------------------------------------------------------------------------
function DebourseContreEtudeView({ devis, sections }) {
  const groups = useMemo(() => groupF11ByOuvrage(devis.lignes), [devis.lignes]);

  // Totaux CE par catégorie
  // Non modifié → contribue ouvrage.montant dans la catégorie de l'ouvrage (source Optim fiable)
  // Modifié     → agrège les montants des lignes saisies par catégorie
  const ceTotals = useMemo(() => {
    const t = {};
    for (const g of groups) {
      if (!g.ouvrage) continue;
      const oid = g.ouvrage.id;
      if (sections[oid]) {
        for (const l of (sections[oid].lignes || [])) {
          const cat = l.categorie || '';
          t[cat] = (t[cat] || 0) + (parseFloat(l.montant) || 0);
        }
      } else {
        const cat = g.ouvrage.categorie || '';
        t[cat] = (t[cat] || 0) + (parseFloat(g.ouvrage.montant) || 0);
      }
    }
    return t;
  }, [groups, sections]);

  // Totaux devis par catégorie (TL=1 uniquement pour éviter le double-comptage)
  const devisTotals = useMemo(() => {
    const t = {};
    for (const l of (devis.lignes || [])) {
      if (l.type_ligne !== 1) continue;
      const cat = l.categorie || '';
      t[cat] = (t[cat] || 0) + (parseFloat(l.montant) || 0);
    }
    return t;
  }, [devis.lignes]);

  // Les deux totaux sont calculés par agrégation de lignes (même source que ceTotals/devisTotals)
  // → jamais via le champ d'en-tête (devis.total_ht) qui peut diverger du détail lignes
  const totalDevis = Object.values(devisTotals).reduce((s, v) => s + v, 0);
  const totalCE    = Object.values(ceTotals).reduce((s, v) => s + v, 0);
  const ecartTotal = totalDevis - totalCE; // positif = gain
  const ecartPct   = totalDevis ? (ecartTotal / totalDevis * 100) : 0;

  const categories = CATEGORIE_ORDER.filter(c => ceTotals[c] || devisTotals[c]);

  return (
    <div className="space-y-5">
      {/* Bandeau résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Montant devis HT',  value: formatCurrency(totalDevis),  cls: 'text-neutral-800' },
          { label: 'Montant CE HT',     value: formatCurrency(totalCE),     cls: 'text-neutral-800' },
          { label: 'Écart total',
            value: `${ecartTotal >= 0 ? '+' : ''}${formatCurrency(ecartTotal)}`,
            cls: ecartTotal > 0.01 ? 'text-emerald-600' : ecartTotal < -0.01 ? 'text-red-500' : 'text-neutral-400' },
          { label: 'Écart %',
            value: `${ecartPct >= 0 ? '+' : ''}${ecartPct.toFixed(1)} %`,
            cls: ecartTotal > 0.01 ? 'text-emerald-600' : ecartTotal < -0.01 ? 'text-red-500' : 'text-neutral-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-lg border border-neutral-200 bg-white p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tableau par catégorie */}
      <Card className="border-neutral-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-100">
                {['Catégorie', 'Devis HT', 'CE HT', 'Écart', '% du total CE'].map((h, i) => (
                  <TableHead key={h} className={`text-xs font-semibold uppercase tracking-widest text-neutral-500 ${i > 0 ? 'text-right' : ''}`}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => {
                const devisAmt = devisTotals[cat] || 0;
                const ceAmt    = ceTotals[cat]    || 0;
                const ecart    = devisAmt - ceAmt;
                const pct      = totalCE ? (ceAmt / totalCE * 100) : 0;
                return (
                  <TableRow key={cat} className="border-neutral-100 hover:bg-neutral-50/50">
                    <TableCell className="font-semibold text-sm">{CATEGORIE_LABELS[cat] || cat || 'Autres'}</TableCell>
                    <TableCell className="text-right text-sm text-neutral-400 tabular-nums">{formatCurrency(devisAmt)}</TableCell>
                    <TableCell className="text-right text-sm font-medium tabular-nums">{formatCurrency(ceAmt)}</TableCell>
                    <TableCell className={`text-right text-sm font-bold tabular-nums ${
                      ecart > 0.01 ? 'text-emerald-600' : ecart < -0.01 ? 'text-red-500' : 'text-neutral-300'
                    }`}>
                      {Math.abs(ecart) > 0.01 ? `${ecart > 0 ? '+' : ''}${formatCurrency(ecart)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-neutral-500 tabular-nums">{pct.toFixed(1)} %</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-t-2 border-neutral-300 bg-neutral-50">
                <TableCell className="font-bold text-sm">TOTAL</TableCell>
                <TableCell className="text-right font-bold text-sm tabular-nums">{formatCurrency(totalDevis)}</TableCell>
                <TableCell className="text-right font-bold text-sm tabular-nums">{formatCurrency(totalCE)}</TableCell>
                <TableCell className={`text-right font-bold text-sm tabular-nums ${
                  ecartTotal > 0.01 ? 'text-emerald-600' : ecartTotal < -0.01 ? 'text-red-500' : 'text-neutral-300'
                }`}>
                  {Math.abs(ecartTotal) > 0.01 ? `${ecartTotal > 0 ? '+' : ''}${formatCurrency(ecartTotal)}` : '—'}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">100 %</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DevisDetail — 4 onglets : Devis | Contre-étude | Déboursé Optim | Déboursé CE
// ---------------------------------------------------------------------------
function DevisDetail({ fiche, devisInfo, onClose }) {
  const [activeTab, setActiveTab]         = useState('devis');
  // devisCommercial : lignes vte_doc_ligne (prix vente client)
  const [devisCommercial, setDevisCommercial] = useState({ lignes: [], total_ht: 0, tva: 0, total_ttc: 0 });
  // devis : lignes F11 afc_etude_prix_detail (déboursé Optim)
  const [devis, setDevis]                 = useState({ lignes: [], total_ht: 0, tva: 0, total_ttc: 0 });
  const [loadingCommercial, setLoadingCommercial] = useState(true);
  const [loadingDebourse, setLoadingDebourse]     = useState(true);
  const [sections, setSections]           = useState({});
  const [commentaire, setCommentaire]     = useState('');
  const [hasChanges, setHasChanges]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [errCommercial, setErrCommercial] = useState(null);

  // Chargement parallèle : devis commercial + F11 déboursé + contre-étude sauvegardée
  useEffect(() => {
    setLoadingCommercial(true);
    setLoadingDebourse(true);
    setErrCommercial(null);

    // Lignes commerciales (vte_doc_ligne)
    ficheApi.getDevisCommercial(fiche.code, devisInfo.vde_id)
      .then(r => setDevisCommercial(r.data))
      .catch(err => {
        const msg = err?.response?.data?.detail || err?.message || 'Erreur chargement devis';
        setErrCommercial(msg);
      })
      .finally(() => setLoadingCommercial(false));

    // Déboursé F11 (afc_etude_prix_detail)
    ficheApi.getDevisById(fiche.code, devisInfo.vde_id)
      .then(r => setDevis(r.data))
      .catch(() => {})
      .finally(() => setLoadingDebourse(false));

    // Contre-étude sauvegardée
    const saved = fiche?.contre_etudes?.[String(devisInfo.vde_id)];
    if (saved) {
      setSections(saved.sections || {});
      setCommentaire(saved.commentaire_global || '');
    }
  }, [fiche, devisInfo.vde_id]);

  // Déboursé HT de référence : somme des ouvrage.montant via groupF11ByOuvrage
  // Même source que totalCE → écart = 0 si rien n'est modifié
  const totalDevis = useMemo(() => {
    if (!devis.lignes?.length) return 0;
    return groupF11ByOuvrage(devis.lignes).reduce((sum, g) => {
      if (!g.ouvrage) return sum;
      return sum + (parseFloat(g.ouvrage.montant) || 0);
    }, 0);
  }, [devis.lignes]);

  // Total CE : non modifié → ouvrage.montant, modifié → somme des lignes saisies
  const totalCE = useMemo(() => {
    if (!devis.lignes?.length) return 0;
    return groupF11ByOuvrage(devis.lignes).reduce((sum, g) => {
      if (!g.ouvrage) return sum;
      const sec = sections[g.ouvrage.id];
      if (sec) {
        return sum + (sec.lignes || []).reduce((s, l) => s + (parseFloat(l.montant) || 0), 0);
      }
      return sum + (parseFloat(g.ouvrage.montant) || 0);
    }, 0);
  }, [sections, devis.lignes]);

  // delta = déboursé F11 - CE → positif = gain
  const ecartDevis = totalDevis - totalCE;

  const handleSectionsChange = useCallback((setter) => {
    setSections(setter);
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheApi.updateContreEtude(fiche.code, {
        vde_id:             devisInfo.vde_id,
        sections,
        commentaire_global: commentaire,
        total_ht:           totalCE,
        ecart_devis:        ecartDevis,
      });
      toast.success('Contre-étude enregistrée');
      setHasChanges(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête avec retour */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-neutral-500 hover:text-neutral-900 p-1">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">{devisInfo.etat}</p>
          <h3 className="font-semibold text-neutral-900">{devisInfo.reference}</h3>
          {devisInfo.libelle && <p className="text-xs text-neutral-500 truncate max-w-md">{devisInfo.libelle}</p>}
        </div>
      </div>

      {/* Bandeau modifications non sauvegardées */}
      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-amber-700 font-medium">Modifications non enregistrées</p>
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-amber-600 hover:bg-amber-700 text-white">
            <Save className="h-4 w-4 mr-2" />{saving ? '…' : 'Enregistrer'}
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-neutral-100 border border-neutral-200 p-1 mb-4 flex flex-wrap gap-1">
          <TabsTrigger value="devis" className="px-4 py-2 flex items-center gap-2 text-sm">
            <FileText className="h-3.5 w-3.5" /> Devis
          </TabsTrigger>
          <TabsTrigger value="contre-etude" className="px-4 py-2 flex items-center gap-2 text-sm">
            <Edit3 className="h-3.5 w-3.5" /> Contre-étude
          </TabsTrigger>
          <TabsTrigger value="debourse" className="px-4 py-2 flex items-center gap-2 text-sm">
            <Lock className="h-3.5 w-3.5" /> Déboursé Optim
          </TabsTrigger>
          <TabsTrigger value="debourse-ce" className="px-4 py-2 flex items-center gap-2 text-sm">
            <TrendingDown className="h-3.5 w-3.5" /> Déboursé CE
          </TabsTrigger>
        </TabsList>

        {/* ── Onglet 1 : Devis commercial (vte_doc_ligne, lecture seule) ── */}
        <TabsContent value="devis">
          <Card className="border border-neutral-200 bg-neutral-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-400" />
                Devis client
                <Badge className="bg-neutral-200 text-neutral-600 font-medium text-xs ml-2">Lecture seule</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCommercial ? (
                <div className="flex items-center justify-center py-10 gap-2 text-neutral-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
              ) : errCommercial ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700 mb-1">Erreur lors du chargement du devis</p>
                  <p className="text-xs text-red-600 font-mono break-all">{errCommercial}</p>
                </div>
              ) : (
                <DevisCommercialView
                  lignes={devisCommercial.lignes}
                  total_ht={devisCommercial.total_ht}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet 2 : Contre-étude hiérarchique ── */}
        <TabsContent value="contre-etude">
          {loadingDebourse ? (
            <div className="flex items-center justify-center py-12 gap-2 text-neutral-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement du déboursé…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mini-résumé en haut */}
              <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-200 bg-white text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-neutral-500">Déboursé HT : <span className="font-semibold text-neutral-800">{formatCurrency(totalDevis)}</span></span>
                  <span className="text-neutral-300">|</span>
                  <span className="text-neutral-500">CE HT : <span className="font-semibold text-neutral-800">{formatCurrency(totalCE)}</span></span>
                </div>
                <div className={`flex items-center gap-1.5 font-bold text-sm ${
                  ecartDevis > 0.01 ? 'text-emerald-600' : ecartDevis < -0.01 ? 'text-red-500' : 'text-neutral-400'
                }`}>
                  {ecartDevis > 0.01 ? <TrendingDown size={15} /> : ecartDevis < -0.01 ? <TrendingUp size={15} /> : null}
                  Écart : {ecartDevis >= 0 ? '+' : ''}{formatCurrency(ecartDevis)}
                </div>
              </div>

              <ContreEtudeStructuree
                devis={devis}
                sections={sections}
                onSectionsChange={handleSectionsChange}
              />

              {/* Commentaire global */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1.5 block">
                  Commentaire global
                </Label>
                <Textarea
                  value={commentaire}
                  onChange={e => { setCommentaire(e.target.value); setHasChanges(true); }}
                  placeholder="Notes générales sur la contre-étude…"
                  className="text-sm" rows={3}
                />
              </div>

              {/* Bouton sauvegarde */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving || !hasChanges}
                  className={`${hasChanges ? 'bg-[#D32F2F] hover:bg-[#B71C1C] text-white' : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'}`}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Enregistrement…' : 'Enregistrer la contre-étude'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Onglet 3 : Déboursé Optim F11 (lecture seule) ── */}
        <TabsContent value="debourse">
          <Card className="border border-neutral-200 bg-neutral-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-neutral-400" />
                Déboursé Optim (F11)
                <Badge className="bg-neutral-200 text-neutral-600 font-medium text-xs ml-2">Lecture seule</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDebourse ? (
                <div className="flex items-center justify-center py-10 gap-2 text-neutral-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
              ) : (
                <DevisGroupedView lignes={devis.lignes} total_ht={devis.total_ht} tva={devis.tva} total_ttc={devis.total_ttc} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onglet 4 : Déboursé CE avec comparaison ── */}
        <TabsContent value="debourse-ce">
          {loadingDebourse ? (
            <div className="flex items-center justify-center py-12 gap-2 text-neutral-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : Object.keys(sections).length === 0 && devis.lignes.every(l => l.type_ligne === 2) ? (
            <Card className="border-neutral-200">
              <CardContent className="py-12 text-center text-neutral-400 text-sm">
                Renseignez d'abord la contre-étude pour générer le déboursé comparatif.
              </CardContent>
            </Card>
          ) : (
            <DebourseContreEtudeView devis={devis} sections={sections} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Vue liste des devis (cards) + détail dépliable
function EtapeContreEtude({ fiche, onUpdate }) {
  const [devisList, setDevisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevis, setSelectedDevis] = useState(null);

  useEffect(() => {
    setLoading(true);
    ficheApi.getDevisList(fiche.code)
      .then(r => {
        setDevisList(r.data || []);
        // Auto-ouvrir si 1 seul devis
        if (r.data?.length === 1) setSelectedDevis(r.data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fiche.code]);

  const ETAT_COLOR = {
    'Accepté':           'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Facture totale':    'bg-neutral-800 text-white border-neutral-800',
    'Facture partielle': 'bg-neutral-200 text-neutral-700 border-neutral-300',
    'À établir':         'bg-amber-50 text-amber-700 border-amber-200',
    'Refusé':            'bg-red-50 text-red-700 border-red-200',
  };

  if (selectedDevis) {
    return <DevisDetail fiche={fiche} devisInfo={selectedDevis} onClose={() => setSelectedDevis(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-neutral-900">Devis du chantier</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Sélectionnez un devis pour accéder au détail déboursé et à la contre-étude</p>
        </div>
        {!loading && <span className="text-xs text-neutral-400">{devisList.length} devis</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-neutral-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement des devis Optim…
        </div>
      ) : devisList.length === 0 ? (
        <Card className="border border-neutral-200">
          <CardContent className="py-12 text-center text-neutral-500 text-sm">
            Aucun devis associé à ce chantier dans Optim
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {devisList.map(d => (
            <Card key={d.vde_id}
              onClick={() => setSelectedDevis(d)}
              className="border border-neutral-200 hover:border-[#D32F2F]/40 hover:shadow-md cursor-pointer group transition-all bg-white"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <code className="text-xs font-mono text-[#D32F2F] font-semibold">{d.reference}</code>
                    {d.libelle && (
                      <p className="text-sm font-medium text-neutral-800 mt-1 line-clamp-2 leading-snug">{d.libelle}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`ml-2 flex-shrink-0 text-[10px] ${ETAT_COLOR[d.etat] || 'bg-neutral-100 text-neutral-500'}`}>
                    {d.etat}
                  </Badge>
                </div>
                <Separator className="my-3 bg-neutral-100" />
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{d.date_doc ? new Date(d.date_doc).toLocaleDateString('fr-FR') : '—'}</span>
                  <span className="font-semibold text-neutral-700">{formatCurrency(d.total_ht)} HT</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[10px] text-neutral-400">Cliquer pour ouvrir</span>
                  <ArrowRight size={14} className="text-neutral-300 group-hover:text-[#D32F2F] transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉTAPE 5 — Fiche Préparation de Chantier
// ---------------------------------------------------------------------------
const EMPTY_FP = {
  chantier_info: { code: '', adresse: '', demarrage: '', livraison: '', infos_diverses: '', jour_reunion: '', visite_site: false, visite_site_qui: '', visite_site_date: '' },
  risques: '',
  enjeux_actions: [],
  installations: { base_vie: false, effectifs: '', raccordement_eau: false, raccordement_eau_details: '', raccordement_elec: false, raccordement_elec_details: '', zones_stockages: false, stationnement: false, gestion_dechets: false },
  logistique: { livraisons: '', modes_manutention: '', moyens_acces: '' },
  annexes: { devis: false, plan: false, pic: false, photos: false, ppsps: false },
  galerie: [],
  actions_preparation: [],
  visites: [],
  est_terminee: false,
  taches: [],
};

// ── Compression image (Option A — Base64 dans MongoDB, ~150 Ko/photo) ──
// Convention : champ `src` (base64 ou, à terme, URL serveur) pour migration facile vers Option B
function compressImage(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Sous-composants stables (définis au niveau module pour éviter le remontage à chaque rendu) ──

function FpSection({ title, icon: Icon, isOpen, onToggle, badge, children }) {
  return (
    <div className="border border-[#e5e7eb] rounded-lg mb-2 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-[#f9fafb] hover:bg-gray-50 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#dc2626]" />
          <span className="text-sm font-semibold text-[#111827]">{title}</span>
          {badge > 0 && (
            <span className="inline-flex items-center justify-center h-4.5 min-w-[1.125rem] px-1 rounded-full bg-[#dc2626] text-white text-[10px] font-bold leading-none">
              {badge}
            </span>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-[#6b7280] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <div className="p-4 border-t border-[#e5e7eb] bg-white">{children}</div>}
    </div>
  );
}

function FpDynTable({ cols, rows, onAdd, addLabel, emptyMsg, renderRow }) {
  return (
    <div>
      <div className="overflow-x-auto border border-[#e5e7eb] rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              {cols.map(c => <th key={c} className="px-3 py-2 text-left font-medium text-[#374151] text-xs">{c}</th>)}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {!rows.length
              ? <tr><td colSpan={cols.length + 1} className="px-3 py-4 text-center text-[#9ca3af] text-sm">{emptyMsg}</td></tr>
              : rows.map(renderRow)
            }
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} className="mt-2 flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#111827] transition-colors">
        <Plus className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  );
}

function FpTdInput(props) {
  const { className, ...rest } = props;
  return <Input {...rest} className={`h-7 text-sm border-0 shadow-none focus-visible:ring-0 p-0 ${className || ''}`} />;
}

function FpDelBtn({ onClick }) {
  return (
    <button onClick={onClick} className="p-1 rounded text-[#9ca3af] hover:text-red-600 hover:bg-red-50 transition-colors">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function EtapeFichePrepa({ fiche, onUpdate }) {
  const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const [fp,           setFp]           = useState(EMPTY_FP);
  const [openSections, setOpenSections] = useState(new Set());
  const [openTaches,   setOpenTaches]   = useState(new Set());
  const [hasChanges,   setHasChanges]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [visiteDialog, setVisiteDialog] = useState(false);
  const [newVisite,    setNewVisite]    = useState({ responsable: '', date_visite: '', observations: '' });

  useEffect(() => {
    if (fiche?.fiche_prepa) {
      setFp({ ...EMPTY_FP, ...fiche.fiche_prepa });
    } else {
      const adresse = [fiche?.adresse?.ligne1, fiche?.adresse?.cp, fiche?.adresse?.ville].filter(Boolean).join(', ');
      setFp(p => ({ ...p, chantier_info: { ...p.chantier_info, code: fiche?.code || '', adresse } }));
    }
  }, [fiche]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheApi.updateFichePrepa(fiche.code, fp);
      if (onUpdate) await onUpdate();
      toast.success('Fiche enregistrée');
      setHasChanges(false);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── helpers état imbriqué ──
  const upd = (path, value) => {
    const parts = path.split('.');
    setFp(prev => parts.length === 1
      ? { ...prev, [parts[0]]: value }
      : { ...prev, [parts[0]]: { ...prev[parts[0]], [parts[1]]: value } }
    );
    setHasChanges(true);
  };

  // ── helpers listes de haut niveau ──
  const addRow    = (key, tpl)          => { setFp(p => ({ ...p, [key]: [...p[key], { id: newId(), ...tpl }] })); setHasChanges(true); };
  const updRow    = (key, id, f, v)     => { setFp(p => ({ ...p, [key]: p[key].map(r => r.id === id ? { ...r, [f]: v } : r) })); setHasChanges(true); };
  const delRow    = (key, id)           => { setFp(p => ({ ...p, [key]: p[key].filter(r => r.id !== id) })); setHasChanges(true); };

  // ── helpers tâches ──
  const addTache = () => {
    const t = { id: newId(), nom_tache: 'Nouvelle tâche', nombre_localisation: '', etudes_execution: [], planning_jalons: [], planning_demarrage: '', planning_fin: '', budget_heures: '', moyens_humains: '', moyens_materiels: '', fiche_preparation: false, point_arret: '', autocontroles: false, autocontroles_frequence: '', annexe_docs_execution: false, annexe_fiche_autocontrole: false, annexe_fiche_preparation_materiel: false, points_bloquants_table: [], retour_experience: '', est_terminee: false };
    setFp(p => ({ ...p, taches: [...p.taches, t] }));
    setOpenTaches(prev => new Set([...prev, t.id]));
    setHasChanges(true);
  };
  const updTache  = (tid, f, v)         => { setFp(p => ({ ...p, taches: p.taches.map(t => t.id === tid ? { ...t, [f]: v } : t) })); setHasChanges(true); };
  const delTache  = (tid)               => { setFp(p => ({ ...p, taches: p.taches.filter(t => t.id !== tid) })); setHasChanges(true); };
  const addTRow   = (tid, sub, tpl)     => { setFp(p => ({ ...p, taches: p.taches.map(t => t.id === tid ? { ...t, [sub]: [...t[sub], { id: newId(), ...tpl }] } : t) })); setHasChanges(true); };
  const updTRow   = (tid, sub, rid, f, v) => { setFp(p => ({ ...p, taches: p.taches.map(t => t.id === tid ? { ...t, [sub]: t[sub].map(r => r.id === rid ? { ...r, [f]: v } : r) } : t) })); setHasChanges(true); };
  const delTRow   = (tid, sub, rid)     => { setFp(p => ({ ...p, taches: p.taches.map(t => t.id === tid ? { ...t, [sub]: t[sub].filter(r => r.id !== rid) } : t) })); setHasChanges(true); };

  const toggleSection = id => setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleTache   = id => setOpenTaches(prev =>   { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });


  return (
    <div className="space-y-6">
      {/* Bandeau modifications */}
      {hasChanges && (
        <div className="bg-red-50 border border-red-200 p-3 flex items-center justify-between rounded">
          <p className="text-sm text-red-700">Modifications non enregistrées</p>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            <Save className="h-4 w-4 mr-2" />{saving ? '...' : 'Enregistrer'}
          </Button>
        </div>
      )}

      {/* ═══════════════════════════════════════
          FICHE PRÉPA CHANTIER
      ═══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2 text-[#111827]">
            <FileText className="h-5 w-5 text-[#dc2626]" />
            Fiche Prépa Chantier
          </h3>
          <Button size="sm" onClick={() => upd('est_terminee', !fp.est_terminee)}
            className={fp.est_terminee ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-white border border-[#e5e7eb] text-[#374151] hover:bg-gray-50'}>
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {fp.est_terminee ? 'Fiche terminée ✓' : 'Marquer comme terminée'}
          </Button>
        </div>

        {fp.est_terminee && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 p-3 rounded mb-3 text-sm">
            <CheckCircle2 className="h-4 w-4" /> Cette fiche prépa chantier est marquée comme terminée
          </div>
        )}

        {/* 1. Chantier */}
        <FpSection isOpen={openSections.has("chantier")} onToggle={() => toggleSection("chantier")}  title="Chantier" icon={Building2}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-xs font-medium text-[#374151]">Code</Label>
              <Input value={fp.chantier_info?.code || ''} onChange={e => upd('chantier_info.code', e.target.value)} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs font-medium text-[#374151]">Adresse</Label>
              <Input value={fp.chantier_info?.adresse || ''} onChange={e => upd('chantier_info.adresse', e.target.value)} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs font-medium text-[#374151]">Date démarrage</Label>
              <Input type="date" value={fp.chantier_info?.demarrage || ''} onChange={e => upd('chantier_info.demarrage', e.target.value)} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs font-medium text-[#374151]">Date livraison</Label>
              <Input type="date" value={fp.chantier_info?.livraison || ''} onChange={e => upd('chantier_info.livraison', e.target.value)} className="mt-1 h-8 text-sm" /></div>
            <div><Label className="text-xs font-medium text-[#374151]">Jour de réunion</Label>
              <Input value={fp.chantier_info?.jour_reunion || ''} onChange={e => upd('chantier_info.jour_reunion', e.target.value)} className="mt-1 h-8 text-sm" placeholder="Ex: Lundi 9h" /></div>
            <div className="md:col-span-2"><Label className="text-xs font-medium text-[#374151]">Informations diverses</Label>
              <Textarea value={fp.chantier_info?.infos_diverses || ''} onChange={e => upd('chantier_info.infos_diverses', e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Informations complémentaires..." /></div>
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="fp_visite_site" checked={!!fp.chantier_info?.visite_site} onCheckedChange={v => upd('chantier_info.visite_site', v)} />
                <Label htmlFor="fp_visite_site" className="text-sm cursor-pointer">Visite de site</Label>
              </div>
              {fp.chantier_info?.visite_site && (
                <div className="grid grid-cols-2 gap-3 pl-6">
                  <div><Label className="text-xs text-[#6b7280]">Qui ?</Label>
                    <Input value={fp.chantier_info?.visite_site_qui || ''} onChange={e => upd('chantier_info.visite_site_qui', e.target.value)} className="mt-1 h-8 text-sm" placeholder="Responsable..." /></div>
                  <div><Label className="text-xs text-[#6b7280]">Date</Label>
                    <Input type="date" value={fp.chantier_info?.visite_site_date || ''} onChange={e => upd('chantier_info.visite_site_date', e.target.value)} className="mt-1 h-8 text-sm" /></div>
                </div>
              )}
            </div>
          </div>
        </FpSection>

        {/* 2. Adresse et Localisation */}
        <FpSection isOpen={openSections.has("localisation")} onToggle={() => toggleSection("localisation")}  title="Adresse et Localisation" icon={MapPin}>
          <div className="space-y-3">
            <Textarea value={fp.chantier_info?.adresse || ''} onChange={e => upd('chantier_info.adresse', e.target.value)} className="text-sm" rows={2} placeholder="Adresse complète..." />
            <div className="h-56 rounded border border-[#e5e7eb] overflow-hidden bg-[#f9fafb] flex items-center justify-center">
              {fp.chantier_info?.adresse
                ? <iframe title="Carte" width="100%" height="100%" className="border-0"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(fp.chantier_info.adresse)}&output=embed`} allowFullScreen />
                : <div className="text-center text-[#9ca3af]"><MapPin className="h-8 w-8 mx-auto mb-2" /><p className="text-sm">Renseignez l'adresse pour afficher la carte</p></div>
              }
            </div>
          </div>
        </FpSection>

        {/* 3. Risques */}
        <FpSection isOpen={openSections.has("risques")} onToggle={() => toggleSection("risques")}  title="Risques / points d'attention du projet" icon={AlertTriangle}>
          <div className="space-y-4">
            <div><Label className="text-xs font-medium text-[#374151]">Risques identifiés</Label>
              <Textarea value={fp.risques || ''} onChange={e => { setFp(p => ({ ...p, risques: e.target.value })); setHasChanges(true); }} className="mt-1 text-sm" rows={3} placeholder="Décrivez les risques et points d'attention..." /></div>
            <div><Label className="text-xs font-medium text-[#374151] mb-2 block">Enjeux / interfaces — Actions à mener</Label>
              <FpDynTable cols={['Enjeux / interfaces', 'Actions à mener']} rows={fp.enjeux_actions} emptyMsg="Aucun enjeu — ajoutez une ligne" addLabel="Ajouter une ligne"
                onAdd={() => addRow('enjeux_actions', { enjeux: '', actions: '' })}
                renderRow={r => (
                  <tr key={r.id} className="border-b border-[#e5e7eb]">
                    <td className="px-3 py-1.5"><FpTdInput value={r.enjeux} onChange={e => updRow('enjeux_actions', r.id, 'enjeux', e.target.value)} placeholder="Enjeu..." /></td>
                    <td className="px-3 py-1.5"><FpTdInput value={r.actions} onChange={e => updRow('enjeux_actions', r.id, 'actions', e.target.value)} placeholder="Action..." /></td>
                    <td className="px-2 py-1"><FpDelBtn onClick={() => delRow('enjeux_actions', r.id)} /></td>
                  </tr>
                )} />
            </div>
          </div>
        </FpSection>

        {/* 4. Installations */}
        <FpSection isOpen={openSections.has("installations")} onToggle={() => toggleSection("installations")}  title="Installations de chantier" icon={Settings}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[['base_vie','Base vie'],['zones_stockages','Zones de stockage'],['stationnement','Stationnement'],['gestion_dechets','Gestion des déchets']].map(([k,l]) => (
                <div key={k} className="flex items-center gap-2">
                  <Checkbox id={`inst_${k}`} checked={!!fp.installations?.[k]} onCheckedChange={v => upd(`installations.${k}`, v)} />
                  <Label htmlFor={`inst_${k}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
              ))}
            </div>
            <div><Label className="text-xs font-medium text-[#374151]">Effectifs</Label>
              <Input value={fp.installations?.effectifs || ''} onChange={e => upd('installations.effectifs', e.target.value)} className="mt-1 h-8 text-sm" placeholder="Ex: 3 compagnons + 1 chef d'équipe" /></div>
            {[['raccordement_eau','Raccordement eau','raccordement_eau_details','Précisions eau...'],['raccordement_elec','Raccordement électricité','raccordement_elec_details','Précisions électricité...']].map(([k,l,dk,dp]) => (
              <div key={k} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id={`inst_${k}`} checked={!!fp.installations?.[k]} onCheckedChange={v => upd(`installations.${k}`, v)} />
                  <Label htmlFor={`inst_${k}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
                {fp.installations?.[k] && <Input value={fp.installations?.[dk] || ''} onChange={e => upd(`installations.${dk}`, e.target.value)} className="ml-6 h-8 text-sm" placeholder={dp} />}
              </div>
            ))}
          </div>
        </FpSection>

        {/* 5. Logistique */}
        <FpSection isOpen={openSections.has("logistique")} onToggle={() => toggleSection("logistique")}  title="Contraintes logistiques" icon={Truck}>
          <div className="space-y-4">
            {[['livraisons','Livraisons','Modalités de livraison...'],['modes_manutention','Modes de manutention','Nacelle, chariot élévateur...'],['moyens_acces',"Moyens d'accès",'Accès chantier, limitations hauteur...']].map(([k,l,p]) => (
              <div key={k}><Label className="text-xs font-medium text-[#374151]">{l}</Label>
                <Textarea value={fp.logistique?.[k] || ''} onChange={e => upd(`logistique.${k}`, e.target.value)} className="mt-1 text-sm" rows={2} placeholder={p} /></div>
            ))}
          </div>
        </FpSection>

        {/* 6. Annexes */}
        <FpSection isOpen={openSections.has("annexes")} onToggle={() => toggleSection("annexes")}  title="Annexes" icon={Paperclip}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[['devis','Devis sans prix'],['plan','Plan de repérage'],['pic','PIC'],['photos','Photos Fieldwire'],['ppsps','PPSPS']].map(([k,l]) => (
              <div key={k} className={`flex items-center justify-between p-3 border rounded transition-colors ${fp.annexes?.[k] ? 'border-green-200 bg-green-50' : 'border-[#e5e7eb]'}`}>
                <div className="flex items-center gap-2">
                  <Checkbox id={`ann_${k}`} checked={!!fp.annexes?.[k]} onCheckedChange={v => upd(`annexes.${k}`, v)} />
                  <Label htmlFor={`ann_${k}`} className="text-sm cursor-pointer">{l}</Label>
                </div>
                {fp.annexes?.[k] && <CheckCircle2 className="h-4 w-4 text-green-600" />}
              </div>
            ))}
          </div>
        </FpSection>

        {/* 7. Galerie */}
        <FpSection isOpen={openSections.has("galerie")} onToggle={() => toggleSection("galerie")}  title="Galerie" icon={Image}>
          <div className="space-y-4">
            {/* Boutons d'import */}
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-[#e5e7eb] rounded hover:bg-gray-50 transition-colors">
                <Image className="h-4 w-4 text-[#6b7280]" />
                Importer des photos
                <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  for (const file of files) {
                    try {
                      const src = await compressImage(file);
                      const name = file.name.replace(/\.[^.]+$/, '');
                      setFp(p => ({ ...p, galerie: [...(p.galerie || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, src, legende: name }] }));
                      setHasChanges(true);
                    } catch { /* ignore */ }
                  }
                  e.target.value = '';
                }} />
              </label>
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-[#e5e7eb] rounded hover:bg-gray-50 transition-colors">
                <Camera className="h-4 w-4 text-[#6b7280]" />
                Prendre une photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const src = await compressImage(file);
                    setFp(p => ({ ...p, galerie: [...(p.galerie || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, src, legende: '' }] }));
                    setHasChanges(true);
                  } catch { /* ignore */ }
                  e.target.value = '';
                }} />
              </label>
              {fp.galerie?.length > 0 && (
                <span className="ml-auto text-xs text-[#9ca3af] self-center">{fp.galerie.length} photo{fp.galerie.length > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Grille photos */}
            {!fp.galerie?.length ? (
              <div className="text-center py-8 border-2 border-dashed border-[#e5e7eb] rounded-lg text-[#9ca3af]">
                <Image className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune photo — importez ou prenez une photo</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {fp.galerie.map(photo => (
                  <div key={photo.id} className="group relative border border-[#e5e7eb] rounded-lg overflow-hidden bg-[#f9fafb]">
                    <img src={photo.src} alt={photo.legende || ''} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => { setFp(p => ({ ...p, galerie: p.galerie.filter(ph => ph.id !== photo.id) })); setHasChanges(true); }}
                      className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="p-1.5">
                      <input
                        value={photo.legende}
                        onChange={e => { const val = e.target.value; setFp(p => ({ ...p, galerie: p.galerie.map(ph => ph.id === photo.id ? { ...ph, legende: val } : ph) })); setHasChanges(true); }}
                        placeholder="Légende..."
                        className="w-full text-xs border-0 bg-transparent p-0 outline-none focus:ring-0 text-[#374151] placeholder:text-[#9ca3af]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FpSection>

        {/* 8. Actions de préparation */}
        <FpSection isOpen={openSections.has("actions")} onToggle={() => toggleSection("actions")}  title="Actions de préparation à mener" icon={ClipboardList}>
          <FpDynTable cols={['Quoi', 'Qui', 'Pour quand']} rows={fp.actions_preparation} emptyMsg="Aucune action — ajoutez une ligne" addLabel="Ajouter une ligne"
            onAdd={() => addRow('actions_preparation', { quoi: '', qui: '', pour_quand: '' })}
            renderRow={r => (
              <tr key={r.id} className="border-b border-[#e5e7eb]">
                <td className="px-3 py-1.5"><FpTdInput value={r.quoi} onChange={e => updRow('actions_preparation', r.id, 'quoi', e.target.value)} placeholder="Action à mener..." /></td>
                <td className="px-3 py-1.5 w-36"><FpTdInput value={r.qui} onChange={e => updRow('actions_preparation', r.id, 'qui', e.target.value)} placeholder="Responsable..." /></td>
                <td className="px-3 py-1.5 w-36"><FpTdInput type="date" value={r.pour_quand} onChange={e => updRow('actions_preparation', r.id, 'pour_quand', e.target.value)} /></td>
                <td className="px-2 py-1"><FpDelBtn onClick={() => delRow('actions_preparation', r.id)} /></td>
              </tr>
            )} />
        </FpSection>

        {/* 9. Visites */}
        <FpSection isOpen={openSections.has("visites")} onToggle={() => toggleSection("visites")} title="Gestion des visites / Points bloquants" icon={Calendar} badge={fp.visites?.filter(v => !v.est_effectuee).length}>
          <div className="space-y-3">
            <div className="flex justify-end">
              <Dialog open={visiteDialog} onOpenChange={setVisiteDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-[#dc2626] hover:bg-[#b91c1c] text-white">
                    <Plus className="h-4 w-4 mr-1" /> Planifier une visite
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[420px]">
                  <DialogHeader><DialogTitle>Planifier une visite</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div><Label className="text-sm">Responsable</Label>
                      <Input value={newVisite.responsable} onChange={e => setNewVisite(v => ({ ...v, responsable: e.target.value }))} className="mt-1 h-8 text-sm" placeholder="Nom..." /></div>
                    <div><Label className="text-sm">Date de visite</Label>
                      <Input type="date" value={newVisite.date_visite} onChange={e => setNewVisite(v => ({ ...v, date_visite: e.target.value }))} className="mt-1 h-8 text-sm" /></div>
                    <div><Label className="text-sm">Observations</Label>
                      <Textarea value={newVisite.observations} onChange={e => setNewVisite(v => ({ ...v, observations: e.target.value }))} className="mt-1 text-sm" rows={2} placeholder="Notes..." /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setVisiteDialog(false)}>Annuler</Button>
                    <Button onClick={() => { addRow('visites', { ...newVisite, est_planifiee: true, est_effectuee: false }); setNewVisite({ responsable: '', date_visite: '', observations: '' }); setVisiteDialog(false); }} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white">Ajouter</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {!fp.visites?.length
              ? <p className="text-center py-4 text-[#9ca3af] text-sm">Aucune visite planifiée</p>
              : fp.visites.map(v => (
                <div key={v.id} className={`flex items-start gap-3 p-3 border rounded ${v.est_effectuee ? 'border-green-200 bg-green-50' : 'border-[#e5e7eb] bg-white'}`}>
                  <Checkbox checked={!!v.est_effectuee} onCheckedChange={checked => updRow('visites', v.id, 'est_effectuee', checked)} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#111827]">{v.responsable || 'Sans responsable'}</span>
                      {v.date_visite && <span className="text-xs text-[#6b7280]">{new Date(v.date_visite).toLocaleDateString('fr-FR')}</span>}
                      <Badge className={v.est_effectuee ? 'bg-green-100 text-green-700 border-green-200 text-xs' : 'bg-[#fef2f2] text-[#b91c1c] border border-[#fecaca] text-xs'}>
                        {v.est_effectuee ? 'Effectuée' : 'Planifiée'}
                      </Badge>
                    </div>
                    {v.observations && <p className="text-xs text-[#6b7280] mt-0.5">{v.observations}</p>}
                  </div>
                  <FpDelBtn onClick={() => delRow('visites', v.id)} />
                </div>
              ))
            }
          </div>
        </FpSection>
      </div>

      {/* ═══════════════════════════════════════
          FICHES PRÉPA DE TÂCHES
      ═══════════════════════════════════════ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2 text-[#111827]">
            <ClipboardList className="h-5 w-5 text-[#dc2626]" />
            Fiches Prépa de Tâches
            {fp.taches?.length > 0 && <span className="text-sm font-normal text-[#6b7280]">({fp.taches.length})</span>}
          </h3>
          <Button size="sm" onClick={addTache} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white">
            <Plus className="h-4 w-4 mr-1" /> Nouvelle tâche
          </Button>
        </div>

        {!fp.taches?.length && (
          <p className="text-center py-6 text-[#9ca3af] text-sm border border-dashed border-[#e5e7eb] rounded-lg">
            Aucune tâche — ajoutez votre première fiche de préparation
          </p>
        )}

        {fp.taches?.map(tache => {
          const isOpen = openTaches.has(tache.id);
          return (
            <div key={tache.id} className="border border-[#e5e7eb] rounded-lg mb-2 overflow-hidden">
              {/* Header tâche */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#f9fafb]">
                <button onClick={() => toggleTache(tache.id)} className="flex items-center gap-2 flex-1 text-left">
                  {tache.est_terminee
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    : <Circle className="h-4 w-4 text-[#dc2626] shrink-0" />}
                  <span className="text-sm font-semibold text-[#111827]">{tache.nom_tache || 'Sans nom'}</span>
                  {tache.est_terminee && <Badge className="bg-black text-white text-xs ml-1">Terminée</Badge>}
                </button>
                <div className="flex items-center gap-1">
                  <ChevronRight onClick={() => toggleTache(tache.id)} className={`h-4 w-4 text-[#6b7280] transition-transform duration-200 cursor-pointer ${isOpen ? 'rotate-90' : ''}`} />
                  <FpDelBtn onClick={() => delTache(tache.id)} />
                </div>
              </div>

              {/* Contenu tâche */}
              {isOpen && (
                <div className="p-4 border-t border-[#e5e7eb] bg-white space-y-5">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => updTache(tache.id, 'est_terminee', !tache.est_terminee)}
                      className={tache.est_terminee ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-white border border-[#e5e7eb] text-[#374151] hover:bg-gray-50'}>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {tache.est_terminee ? 'Tâche terminée ✓' : 'Marquer comme terminée'}
                    </Button>
                  </div>

                  {/* Nom + Localisation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label className="text-xs font-medium text-[#374151]">Nom de la tâche</Label>
                      <Input value={tache.nom_tache} onChange={e => updTache(tache.id, 'nom_tache', e.target.value)} className="mt-1 h-8 text-sm" /></div>
                    <div><Label className="text-xs font-medium text-[#374151]">Nombre / Localisation</Label>
                      <Textarea value={tache.nombre_localisation} onChange={e => updTache(tache.id, 'nombre_localisation', e.target.value)} className="mt-1 text-sm" rows={2} placeholder="3 niveaux, Bâtiment A..." /></div>
                  </div>

                  {/* Études d'exécution */}
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-2 block">Études d'exécution</Label>
                    <FpDynTable cols={['Document', 'Indice', 'Validé', 'Observations']} rows={tache.etudes_execution} emptyMsg="Aucun document" addLabel="Ajouter un document"
                      onAdd={() => addTRow(tache.id, 'etudes_execution', { document: '', indice: '', valide: false, observations: '' })}
                      renderRow={r => (
                        <tr key={r.id} className="border-b border-[#e5e7eb]">
                          <td className="px-3 py-1.5"><FpTdInput value={r.document} onChange={e => updTRow(tache.id, 'etudes_execution', r.id, 'document', e.target.value)} placeholder="Nom du document..." /></td>
                          <td className="px-3 py-1.5 w-24"><FpTdInput value={r.indice} onChange={e => updTRow(tache.id, 'etudes_execution', r.id, 'indice', e.target.value)} placeholder="A, B..." className="w-16" /></td>
                          <td className="px-3 py-1.5 w-16 text-center"><Checkbox checked={!!r.valide} onCheckedChange={v => updTRow(tache.id, 'etudes_execution', r.id, 'valide', v)} /></td>
                          <td className="px-3 py-1.5"><FpTdInput value={r.observations} onChange={e => updTRow(tache.id, 'etudes_execution', r.id, 'observations', e.target.value)} placeholder="Observations..." /></td>
                          <td className="px-2 py-1"><FpDelBtn onClick={() => delTRow(tache.id, 'etudes_execution', r.id)} /></td>
                        </tr>
                      )} />
                  </div>

                  {/* Planning jalons */}
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-2 block">Planning jalons</Label>
                    <FpDynTable cols={['Jalon', 'Prévu', 'Réalisé', 'Remarques']} rows={tache.planning_jalons} emptyMsg="Aucun jalon" addLabel="Ajouter un jalon"
                      onAdd={() => addTRow(tache.id, 'planning_jalons', { jalon: '', prevu: '', realise: '', remarques: '' })}
                      renderRow={r => (
                        <tr key={r.id} className="border-b border-[#e5e7eb]">
                          <td className="px-3 py-1.5"><FpTdInput value={r.jalon} onChange={e => updTRow(tache.id, 'planning_jalons', r.id, 'jalon', e.target.value)} placeholder="Nom du jalon..." /></td>
                          <td className="px-3 py-1.5 w-36"><FpTdInput type="date" value={r.prevu} onChange={e => updTRow(tache.id, 'planning_jalons', r.id, 'prevu', e.target.value)} /></td>
                          <td className="px-3 py-1.5 w-36"><FpTdInput type="date" value={r.realise} onChange={e => updTRow(tache.id, 'planning_jalons', r.id, 'realise', e.target.value)} /></td>
                          <td className="px-3 py-1.5"><FpTdInput value={r.remarques} onChange={e => updTRow(tache.id, 'planning_jalons', r.id, 'remarques', e.target.value)} placeholder="Remarques..." /></td>
                          <td className="px-2 py-1"><FpDelBtn onClick={() => delTRow(tache.id, 'planning_jalons', r.id)} /></td>
                        </tr>
                      )} />
                  </div>

                  {/* Dates + Budget */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><Label className="text-xs font-medium text-[#374151]">Date démarrage</Label>
                      <Input type="date" value={tache.planning_demarrage} onChange={e => updTache(tache.id, 'planning_demarrage', e.target.value)} className="mt-1 h-8 text-sm" /></div>
                    <div><Label className="text-xs font-medium text-[#374151]">Date fin</Label>
                      <Input type="date" value={tache.planning_fin} onChange={e => updTache(tache.id, 'planning_fin', e.target.value)} className="mt-1 h-8 text-sm" /></div>
                    <div><Label className="text-xs font-medium text-[#374151]">Budget heures</Label>
                      <Input value={tache.budget_heures} onChange={e => updTache(tache.id, 'budget_heures', e.target.value)} className="mt-1 h-8 text-sm" placeholder="Ex: 120h" /></div>
                  </div>

                  {/* Moyens */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><Label className="text-xs font-medium text-[#374151]">Moyens humains</Label>
                      <Textarea value={tache.moyens_humains} onChange={e => updTache(tache.id, 'moyens_humains', e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Équipe, sous-traitants..." /></div>
                    <div><Label className="text-xs font-medium text-[#374151]">Moyens matériels</Label>
                      <Textarea value={tache.moyens_materiels} onChange={e => updTache(tache.id, 'moyens_materiels', e.target.value)} className="mt-1 text-sm" rows={2} placeholder="Matériel, engins..." /></div>
                  </div>

                  {/* Qualité & Contrôles */}
                  <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Qualité & Contrôles</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox id={`fp_${tache.id}`} checked={!!tache.fiche_preparation} onCheckedChange={v => updTache(tache.id, 'fiche_preparation', v)} />
                      <Label htmlFor={`fp_${tache.id}`} className="text-sm cursor-pointer">Fiche de préparation</Label>
                    </div>
                    <div><Label className="text-xs font-medium text-[#374151]">Point d'arrêt</Label>
                      <Input value={tache.point_arret} onChange={e => updTache(tache.id, 'point_arret', e.target.value)} className="mt-1 h-8 text-sm" placeholder="Description du point d'arrêt..." /></div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox id={`ac_${tache.id}`} checked={!!tache.autocontroles} onCheckedChange={v => updTache(tache.id, 'autocontroles', v)} />
                        <Label htmlFor={`ac_${tache.id}`} className="text-sm cursor-pointer">Autocontrôles</Label>
                      </div>
                      {tache.autocontroles && <Input value={tache.autocontroles_frequence} onChange={e => updTache(tache.id, 'autocontroles_frequence', e.target.value)} className="ml-6 h-8 text-sm" placeholder="Fréquence (journalier, hebdomadaire...)" />}
                    </div>
                  </div>

                  {/* Annexes tâche */}
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-2 block">Annexes</Label>
                    <div className="space-y-2">
                      {[['annexe_docs_execution',"Documents d'exécution"],['annexe_fiche_autocontrole',"Fiche d'autocontrôle"],['annexe_fiche_preparation_materiel','Fiche de préparation matériel']].map(([k,l]) => (
                        <div key={k} className={`flex items-center justify-between p-2.5 border rounded transition-colors ${tache[k] ? 'border-green-200 bg-green-50' : 'border-[#e5e7eb]'}`}>
                          <div className="flex items-center gap-2">
                            <Checkbox id={`${k}_${tache.id}`} checked={!!tache[k]} onCheckedChange={v => updTache(tache.id, k, v)} />
                            <Label htmlFor={`${k}_${tache.id}`} className="text-sm cursor-pointer">{l}</Label>
                          </div>
                          {tache[k] && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Points bloquants */}
                  <div><Label className="text-xs font-semibold uppercase tracking-wider text-[#6b7280] mb-2 block">Points bloquants</Label>
                    <FpDynTable cols={['Exécution', 'Prépa conduc.', 'Prépa chef']} rows={tache.points_bloquants_table} emptyMsg="Aucun point bloquant" addLabel="Ajouter un point bloquant"
                      onAdd={() => addTRow(tache.id, 'points_bloquants_table', { execution: '', prepa_conduc: '', prepa_chef: '' })}
                      renderRow={r => (
                        <tr key={r.id} className="border-b border-[#e5e7eb]">
                          <td className="px-3 py-1.5"><FpTdInput value={r.execution} onChange={e => updTRow(tache.id, 'points_bloquants_table', r.id, 'execution', e.target.value)} placeholder="Point bloquant exécution..." /></td>
                          <td className="px-3 py-1.5"><FpTdInput value={r.prepa_conduc} onChange={e => updTRow(tache.id, 'points_bloquants_table', r.id, 'prepa_conduc', e.target.value)} placeholder="Action conducteur..." /></td>
                          <td className="px-3 py-1.5"><FpTdInput value={r.prepa_chef} onChange={e => updTRow(tache.id, 'points_bloquants_table', r.id, 'prepa_chef', e.target.value)} placeholder="Action chef de file..." /></td>
                          <td className="px-2 py-1"><FpDelBtn onClick={() => delTRow(tache.id, 'points_bloquants_table', r.id)} /></td>
                        </tr>
                      )} />
                  </div>

                  {/* Retour d'expérience */}
                  <div><Label className="text-xs font-medium text-[#374151]">Retour d'expérience</Label>
                    <Textarea value={tache.retour_experience} onChange={e => updTache(tache.id, 'retour_experience', e.target.value)} className="mt-1 text-sm" rows={3} placeholder="Points à améliorer, bonnes pratiques..." /></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bouton enregistrer */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !hasChanges}
          className={`transition-colors ${hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'}`}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ÉTAPE 6 — Checklist Chantier (vue Conducteur)
// ---------------------------------------------------------------------------

const CL_TEMPLATES = {
  injection: {
    label: 'Injection', icon: Droplet,
    sections: [
      { name: 'Matériel autocontrôle EPI', items: [
        { designation: 'Gants anti-coupure', unite: 'U' }, { designation: 'Lunettes de protection', unite: 'U' },
        { designation: 'Casque de chantier', unite: 'U' }, { designation: 'Chaussures de sécurité', unite: 'U' },
        { designation: 'DYNATEST', unite: 'Ens' },
      ]},
      { name: 'Matériel injection', items: [
        { designation: 'Pompe injection', unite: 'U' }, { designation: 'Tuyaux HP', unite: 'ML' },
        { designation: 'Manomètre', unite: 'U' }, { designation: 'Packers 13mm', unite: 'U' },
        { designation: 'Résine injection', unite: 'KG' },
      ]},
      { name: 'Matériel de chantier', items: [
        { designation: 'Perforateur SDS+', unite: 'U' }, { designation: 'Foreuse diamant', unite: 'U' },
        { designation: 'Nettoyeur HP', unite: 'U' },
      ]},
    ],
  },
  cuvelage: {
    label: 'Cuvelage', icon: Waves,
    sections: [
      { name: 'EPI', items: [
        { designation: 'Gants protection', unite: 'U' }, { designation: 'Lunettes', unite: 'U' },
        { designation: 'Casque', unite: 'U' }, { designation: 'Combinaison jetable', unite: 'U' },
      ]},
      { name: 'Matériaux cuvelage', items: [
        { designation: 'Mortier étanchéité', unite: 'KG' }, { designation: 'Enduit de lissage', unite: 'KG' },
        { designation: 'Primaire accrochage', unite: 'L' }, { designation: 'Armature fibre', unite: 'M²' },
      ]},
      { name: 'Matériel', items: [
        { designation: 'Malaxeur électrique', unite: 'U' }, { designation: 'Brosses métalliques', unite: 'U' }, { designation: 'Platoir', unite: 'U' },
      ]},
    ],
  },
  renforcement_beton: {
    label: 'Renforcement béton', icon: Building,
    sections: [
      { name: 'EPI', items: [
        { designation: 'Gants', unite: 'U' }, { designation: 'Casque', unite: 'U' },
        { designation: 'Harnais anti-chute', unite: 'U' }, { designation: 'Chaussures sécurité', unite: 'U' },
      ]},
      { name: 'Matériaux', items: [
        { designation: 'Béton projeté', unite: 'M³' }, { designation: 'Armatures acier', unite: 'KG' },
        { designation: 'Coffrages perdus', unite: 'M²' }, { designation: 'Connecteurs', unite: 'U' },
      ]},
      { name: 'Matériel', items: [
        { designation: 'Banche de coffrage', unite: 'U' }, { designation: 'Vibreur béton', unite: 'U' }, { designation: 'Pompe à béton', unite: 'U' },
      ]},
    ],
  },
  renforcement_carbone: {
    label: 'Renforcement carbone', icon: Layers,
    sections: [
      { name: 'EPI', items: [
        { designation: 'Gants anti-coupure niv. E', unite: 'U' }, { designation: 'Masque FFP2', unite: 'U' },
        { designation: 'Lunettes étanches', unite: 'U' }, { designation: 'Combinaison jetable', unite: 'U' },
      ]},
      { name: 'Matériaux carbone', items: [
        { designation: 'Tissu carbone UD', unite: 'ML' }, { designation: 'Résine époxy bicomposant', unite: 'KG' },
        { designation: 'Primaire époxy', unite: 'L' }, { designation: 'Finition de protection', unite: 'L' },
      ]},
      { name: 'Matériel', items: [
        { designation: 'Rouleau débulleur', unite: 'U' }, { designation: "Spatule crantée", unite: 'U' }, { designation: "Meuleuse d'angle", unite: 'U' },
      ]},
    ],
  },
};

const CL_STATUS_CFG = {
  en_cours: { label: 'En cours', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  livree:   { label: 'Livrée',   cls: 'bg-green-100 text-green-700 border-green-200' },
  archivee: { label: 'Archivée', cls: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
};

const CL_UNITES = ['U', 'ML', 'L', 'KG', 'M²', 'Ens', 'T', 'M³'];

function newClId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function buildCLFromTemplate(templateType, idx) {
  const tpl = CL_TEMPLATES[templateType];
  if (!tpl) return null;
  return {
    id: newClId(), name: `${tpl.label} #${idx}`, templateType, status: 'en_cours',
    createdAt: new Date().toISOString(),
    sections: tpl.sections.map(s => ({
      name: s.name,
      items: s.items.map(it => ({ id: newClId(), designation: it.designation, unite: it.unite, qteChantier: 0, locLc: '-', qteStock: 0, deliveryValidated: false, orderComplete: false })),
    })),
  };
}

function EtapeChecklist({ fiche, onUpdate }) {
  const [data, setData]                   = useState({ checklists: [] });
  const [activeId, setActiveId]           = useState(null);
  const [openSections, setOpenSections]   = useState(new Set());
  const [hasChanges, setHasChanges]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [newClDialog, setNewClDialog]     = useState(false);
  const [statusDialog, setStatusDialog]   = useState(false);
  const [addItemDialog, setAddItemDialog] = useState(null); // sectionIdx | null
  const [delClDialog, setDelClDialog]     = useState(null); // checklist id
  const [newItemDesig, setNewItemDesig]   = useState('');
  const [newItemUnite, setNewItemUnite]   = useState('U');

  useEffect(() => {
    if (fiche?.checklist_chantier) {
      const d = fiche.checklist_chantier;
      setData(d);
      if (d.checklists?.length) {
        setActiveId(d.checklists[0].id);
        // ouvrir toutes les sections de la première checklist par défaut
        setOpenSections(new Set(d.checklists[0].sections.map((_, i) => `${d.checklists[0].id}-${i}`)));
      }
    }
  }, [fiche]);

  const active = data.checklists.find(c => c.id === activeId);
  const mark   = () => setHasChanges(true);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ficheApi.updateChecklistChantier(fiche.code, data);
      if (onUpdate) await onUpdate();
      toast.success('Checklist enregistrée');
      setHasChanges(false);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const createChecklist = (templateType) => {
    const cl = buildCLFromTemplate(templateType, data.checklists.length + 1);
    if (!cl) return;
    setData(d => ({ ...d, checklists: [...d.checklists, cl] }));
    setActiveId(cl.id);
    setOpenSections(new Set(cl.sections.map((_, i) => `${cl.id}-${i}`)));
    setNewClDialog(false);
    mark();
  };

  const deleteChecklist = (id) => {
    const remaining = data.checklists.filter(c => c.id !== id);
    setData(d => ({ ...d, checklists: remaining }));
    if (activeId === id) setActiveId(remaining[0]?.id || null);
    setDelClDialog(null);
    mark();
  };

  const changeStatus = (status) => {
    setData(d => ({ ...d, checklists: d.checklists.map(c => c.id === activeId ? { ...c, status } : c) }));
    setStatusDialog(false); mark();
  };

  const updateItem = (sIdx, itemId, field, value) => {
    setData(d => ({
      ...d,
      checklists: d.checklists.map(c => {
        if (c.id !== activeId) return c;
        return { ...c, sections: c.sections.map((s, si) => si !== sIdx ? s : { ...s, items: s.items.map(it => it.id === itemId ? { ...it, [field]: value } : it) }) };
      }),
    }));
    mark();
  };

  const toggleFlag = (sIdx, itemId, flag) => {
    setData(d => ({
      ...d,
      checklists: d.checklists.map(c => {
        if (c.id !== activeId) return c;
        return {
          ...c, sections: c.sections.map((s, si) => si !== sIdx ? s : {
            ...s, items: s.items.map(it => {
              if (it.id !== itemId) return it;
              const next = { ...it, [flag]: !it[flag] };
              if (flag === 'orderComplete' && next.orderComplete) next.deliveryValidated = true;
              if (flag === 'deliveryValidated' && !next.deliveryValidated) next.orderComplete = false;
              return next;
            }),
          }),
        };
      }),
    }));
    mark();
  };

  const addItem = (sIdx) => {
    if (!newItemDesig.trim()) return;
    const it = { id: newClId(), designation: newItemDesig.trim(), unite: newItemUnite, qteChantier: 0, locLc: '-', qteStock: 0, deliveryValidated: false, orderComplete: false };
    setData(d => ({
      ...d,
      checklists: d.checklists.map(c => c.id !== activeId ? c : {
        ...c, sections: c.sections.map((s, si) => si !== sIdx ? s : { ...s, items: [...s.items, it] }),
      }),
    }));
    setNewItemDesig(''); setNewItemUnite('U'); setAddItemDialog(null); mark();
  };

  const deleteItem = (sIdx, itemId) => {
    setData(d => ({
      ...d,
      checklists: d.checklists.map(c => c.id !== activeId ? c : {
        ...c, sections: c.sections.map((s, si) => si !== sIdx ? s : { ...s, items: s.items.filter(it => it.id !== itemId) }),
      }),
    }));
    mark();
  };

  const toggleSection = (key) => setOpenSections(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const exportPdf = () => {
    if (!active) return;
    import('jspdf').then(({ jsPDF }) => {
      import('jspdf-autotable').then(() => {
        const doc = new jsPDF();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
        doc.text('CHECKLIST CHANTIER', 105, 18, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.text(`Chantier : ${fiche.code} — ${fiche.nom}`, 14, 28);
        doc.text(`Type : ${CL_TEMPLATES[active.templateType]?.label || active.templateType}  |  ${active.name}  |  Statut : ${CL_STATUS_CFG[active.status]?.label}`, 14, 34);
        doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 40);
        doc.setDrawColor(220, 38, 38); doc.line(14, 44, 196, 44);
        let y = 50;
        active.sections.forEach(section => {
          const cmdCount = section.items.filter(it => Math.max(0, (it.qteChantier || 0) - (it.qteStock || 0)) > 0).length;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
          doc.text(`${section.name}${cmdCount > 0 ? `  (${cmdCount} à commander)` : ''}`, 14, y);
          y += 4;
          doc.autoTable({
            startY: y,
            head: [['Désignation', 'Unité', 'Qté chantier', 'LOC/LC', 'À commander', 'Statut']],
            body: section.items.map(it => {
              const aCmd = Math.max(0, (it.qteChantier || 0) - (it.qteStock || 0));
              const st = it.orderComplete ? 'Validée' : it.deliveryValidated ? 'Commandée' : aCmd > 0 ? 'À commander' : 'OK';
              return [it.designation, it.unite, it.qteChantier || 0, it.locLc || '-', aCmd > 0 ? aCmd : '—', st];
            }),
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { left: 14, right: 14 },
          });
          y = doc.lastAutoTable.finalY + 8;
        });
        doc.save(`checklist_${fiche.code}_${active.name.replace(/\s+/g, '_')}.pdf`);
      });
    });
  };

  const totalItems = active?.sections.reduce((a, s) => a + s.items.length, 0) || 0;
  const totalACmd  = active?.sections.reduce((a, s) => a + s.items.reduce((b, it) => b + Math.max(0, (it.qteChantier || 0) - (it.qteStock || 0)), 0), 0) || 0;
  const totalDone  = active?.sections.reduce((a, s) => a + s.items.filter(it => it.orderComplete).length, 0) || 0;
  const TplIcon    = active ? (CL_TEMPLATES[active.templateType]?.icon || Package) : Package;

  return (
    <div className="space-y-4">
      {/* Bandeau modifications */}
      {hasChanges && (
        <div className="bg-red-50 border border-red-200 p-3 flex items-center justify-between rounded">
          <p className="text-sm text-red-700">Modifications non enregistrées</p>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            <Save className="h-4 w-4 mr-2" />{saving ? '...' : 'Enregistrer'}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2 text-[#111827]">
          <Package className="h-5 w-5 text-[#dc2626]" />
          Checklist Chantier
          {data.checklists.length > 0 && <span className="text-sm font-normal text-[#6b7280]">({data.checklists.length} checklist{data.checklists.length > 1 ? 's' : ''})</span>}
        </h3>
        <Button size="sm" onClick={() => setNewClDialog(true)} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white">
          <Plus className="h-4 w-4 mr-1" /> Nouvelle checklist
        </Button>
      </div>

      {/* Onglets checklists */}
      {data.checklists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.checklists.map(cl => {
            const cfg = CL_STATUS_CFG[cl.status] || CL_STATUS_CFG.en_cours;
            const Icon = CL_TEMPLATES[cl.templateType]?.icon || Package;
            return (
              <button key={cl.id} onClick={() => { setActiveId(cl.id); setOpenSections(new Set(cl.sections.map((_, i) => `${cl.id}-${i}`))); }}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${activeId === cl.id ? 'border-[#dc2626] bg-red-50 text-[#dc2626] font-medium' : 'border-[#e5e7eb] bg-white text-[#374151] hover:bg-gray-50'}`}>
                <Icon className="h-3.5 w-3.5" />
                {cl.name}
                <span className={`text-xs px-1.5 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Vide */}
      {!data.checklists.length && (
        <div className="text-center py-12 border-2 border-dashed border-[#e5e7eb] rounded-lg text-[#9ca3af]">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium mb-1">Aucune checklist</p>
          <p className="text-xs">Créez une checklist depuis un template pour commencer</p>
        </div>
      )}

      {/* Contenu actif */}
      {active && (
        <>
          {/* Barre d'actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-white border border-[#e5e7eb] rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <TplIcon className="h-4 w-4 text-[#dc2626]" />
                <span className="text-sm font-medium text-[#111827]">{CL_TEMPLATES[active.templateType]?.label || active.templateType}</span>
              </div>
              <div className="h-4 w-px bg-[#e5e7eb]" />
              <span className={`text-xs px-2 py-0.5 rounded-full border ${CL_STATUS_CFG[active.status]?.cls}`}>{CL_STATUS_CFG[active.status]?.label}</span>
              <div className="h-4 w-px bg-[#e5e7eb]" />
              <span className="text-xs text-[#6b7280]">
                {totalItems} articles ·{' '}
                <span className={totalACmd > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>{totalACmd} à commander</span>
                {' · '}<span className="text-green-600">{totalDone} validés</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setStatusDialog(true)} className="h-7 text-xs px-2.5 border-[#e5e7eb]">Statut</Button>
              <Button variant="outline" size="sm" onClick={exportPdf} className="h-7 text-xs px-2.5 border-[#e5e7eb]">
                <Download className="h-3.5 w-3.5 mr-1" /> PDF
              </Button>
              {data.checklists.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => setDelClDialog(activeId)} className="h-7 text-xs px-2 border-red-200 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-2">
            {active.sections.map((section, sIdx) => {
              const sKey = `${activeId}-${sIdx}`;
              const isOpen = openSections.has(sKey);
              const cmdCount  = section.items.filter(it => Math.max(0, (it.qteChantier || 0) - (it.qteStock || 0)) > 0 && !it.orderComplete).length;
              const doneCount = section.items.filter(it => it.orderComplete).length;
              const allDone   = section.items.length > 0 && doneCount === section.items.length;
              return (
                <div key={sKey} className="border border-[#e5e7eb] rounded-lg overflow-hidden">
                  <button onClick={() => toggleSection(sKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#f9fafb] hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ChevronRight className={`h-4 w-4 text-[#6b7280] transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                      <span className="text-sm font-semibold text-[#111827]">{section.name}</span>
                      {cmdCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium">{cmdCount} à commander</span>
                      )}
                      {allDone && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium">✓ Complète</span>
                      )}
                    </div>
                    <span className="text-xs text-[#9ca3af] shrink-0">{section.items.length} article{section.items.length > 1 ? 's' : ''}</span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#e5e7eb] bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                              <th className="px-3 py-2 text-left text-xs font-medium text-[#374151]">Désignation</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-20">Unité</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-28">Qté chantier</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-24">LOC / LC</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-28">Stock dépôt</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-24">À cmd.</th>
                              <th className="px-2 py-2 text-left text-xs font-medium text-[#374151] w-40">Statut</th>
                              <th className="w-9" />
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map(item => {
                              const aCmd = Math.max(0, (item.qteChantier || 0) - (item.qteStock || 0));
                              return (
                                <tr key={item.id} className={`border-b border-[#e5e7eb] ${item.orderComplete ? 'bg-green-50' : ''}`}>
                                  <td className="px-3 py-1">
                                    <input value={item.designation} onChange={e => updateItem(sIdx, item.id, 'designation', e.target.value)}
                                      className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 text-[#111827] min-w-[120px]" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <select value={item.unite} onChange={e => updateItem(sIdx, item.id, 'unite', e.target.value)}
                                      className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 text-[#374151]">
                                      {CL_UNITES.map(u => <option key={u}>{u}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-1 py-1">
                                    <input type="number" min="0" value={item.qteChantier || ''} placeholder="0"
                                      onChange={e => updateItem(sIdx, item.id, 'qteChantier', parseFloat(e.target.value) || 0)}
                                      className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 text-[#111827]" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <select value={item.locLc || '-'} onChange={e => updateItem(sIdx, item.id, 'locLc', e.target.value)}
                                      className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 text-[#374151]">
                                      <option value="-">-</option>
                                      <option value="LOC">LOC</option>
                                      <option value="LC">LC</option>
                                    </select>
                                  </td>
                                  <td className="px-1 py-1">
                                    <input type="number" min="0" value={item.qteStock || ''} placeholder="0"
                                      onChange={e => updateItem(sIdx, item.id, 'qteStock', parseFloat(e.target.value) || 0)}
                                      className="w-full text-sm bg-transparent border-0 outline-none focus:ring-0 text-[#111827]" />
                                  </td>
                                  <td className="px-2 py-1">
                                    {item.orderComplete
                                      ? <span className="text-xs text-green-600 font-medium">✓</span>
                                      : aCmd > 0
                                        ? <span className="text-xs font-bold text-red-600">{aCmd}</span>
                                        : <span className="text-xs text-[#9ca3af]">—</span>
                                    }
                                  </td>
                                  <td className="px-2 py-1">
                                    {item.orderComplete ? (
                                      <button onClick={() => toggleFlag(sIdx, item.id, 'orderComplete')}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium whitespace-nowrap hover:bg-emerald-200">
                                        Validée ✓
                                      </button>
                                    ) : item.deliveryValidated ? (
                                      <button onClick={() => toggleFlag(sIdx, item.id, 'orderComplete')}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 whitespace-nowrap hover:bg-green-200">
                                        Commandée → Reçu ?
                                      </button>
                                    ) : aCmd > 0 ? (
                                      <button onClick={() => toggleFlag(sIdx, item.id, 'deliveryValidated')}
                                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200 whitespace-nowrap hover:bg-zinc-200">
                                        À commander
                                      </button>
                                    ) : (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-200">En attente</span>
                                    )}
                                  </td>
                                  <td className="px-1 py-1 text-center">
                                    <button onClick={() => deleteItem(sIdx, item.id)}
                                      className="p-1 rounded text-[#9ca3af] hover:text-red-600 hover:bg-red-50 transition-colors">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-4 py-2 border-t border-[#e5e7eb]">
                        <button onClick={() => { setAddItemDialog(sIdx); setNewItemDesig(''); setNewItemUnite('U'); }}
                          className="flex items-center gap-1 text-sm text-[#6b7280] hover:text-[#111827] transition-colors">
                          <Plus className="h-4 w-4" /> Ajouter un article
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bouton enregistrer bas */}
      {(data.checklists.length > 0 || hasChanges) && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !hasChanges}
            className={`transition-colors ${hasChanges ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'}`}>
            <Save className="h-4 w-4 mr-2" />{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </div>
      )}

      {/* Modal — Nouvelle checklist */}
      <Dialog open={newClDialog} onOpenChange={setNewClDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Nouvelle checklist</DialogTitle>
            <DialogDescription>Choisissez un type de chantier pour initialiser la checklist.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {Object.entries(CL_TEMPLATES).map(([key, tpl]) => {
              const Icon = tpl.icon;
              return (
                <button key={key} onClick={() => createChecklist(key)}
                  className="flex flex-col items-center gap-2 p-4 border border-[#e5e7eb] rounded-lg hover:border-[#dc2626] hover:bg-red-50 transition-colors">
                  <div className="p-2 bg-red-100 rounded-md"><Icon className="h-5 w-5 text-[#dc2626]" /></div>
                  <span className="text-sm font-medium text-[#111827]">{tpl.label}</span>
                  <span className="text-xs text-[#9ca3af]">{tpl.sections.reduce((a, s) => a + s.items.length, 0)} articles</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal — Statut checklist */}
      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader><DialogTitle>Changer le statut</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            {Object.entries(CL_STATUS_CFG).map(([key, cfg]) => (
              <button key={key} onClick={() => changeStatus(key)}
                className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${active?.status === key ? `${cfg.cls} font-semibold` : 'border-[#e5e7eb] text-[#374151] hover:bg-gray-50'}`}>
                {cfg.label}{active?.status === key && ' (actuel)'}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal — Ajout article */}
      <Dialog open={addItemDialog !== null} onOpenChange={v => !v && setAddItemDialog(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Ajouter un article</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-sm">Désignation *</Label>
              <Input autoFocus value={newItemDesig} onChange={e => setNewItemDesig(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem(addItemDialog)}
                className="mt-1 h-8 text-sm" placeholder="Nom de l'article..." />
            </div>
            <div>
              <Label className="text-sm">Unité</Label>
              <Select value={newItemUnite} onValueChange={setNewItemUnite}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CL_UNITES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialog(null)}>Annuler</Button>
            <Button onClick={() => addItem(addItemDialog)} disabled={!newItemDesig.trim()} className="bg-[#dc2626] hover:bg-[#b91c1c] text-white">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Supprimer checklist */}
      <Dialog open={!!delClDialog} onOpenChange={v => !v && setDelClDialog(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Supprimer la checklist ?</DialogTitle>
            <DialogDescription>Cette action est irréversible. Toutes les données seront perdues.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelClDialog(null)}>Annuler</Button>
            <Button onClick={() => deleteChecklist(delClDialog)} className="bg-red-600 hover:bg-red-700 text-white">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const hasNext = etapeNum < 11;

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
                  Étape {etapeNum} / 11
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
      {etapeNum === 4 && <EtapeFichePrepa fiche={fiche} onUpdate={onRefreshFiche} />}
      {etapeNum === 6 && <EtapeChecklist fiche={fiche} onUpdate={onRefreshFiche} />}

      {/* Progress bar du chantier */}
      <Card className="border-[#e4e4e7]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#71717a] font-medium">Avancement global — {fiche.nom}</span>
            <span className="text-xs font-semibold text-[#09090b]">
              {fiche.etapes?.filter(e => e.statut === 'termine').length ?? 0} / 11
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
        <span className="text-xs text-[#a1a1aa]">{etapeNum} / 11</span>
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
            <span className="text-sm text-[#71717a]">{termines} / {fiche.etapes?.length ?? 11} étapes</span>
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

      {/* 11 Étapes */}
      <Card className="border-[#e4e4e7]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-[#09090b] flex items-center justify-between">
            <span>Suivi des 11 étapes</span>
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
