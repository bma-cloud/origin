import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { formatApiError } from '../lib/api';
import {
  ArrowLeft, Plus, Search, Building2, MapPin,
  Check, AlertCircle, ChevronRight, X, Clock, FileText,
  Users, FolderOpen, History, Truck, ShieldAlert,
  Wrench, BarChart3, AlertTriangle, Save, Trash2, ExternalLink
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';

// ============== STYLES FLOWCHANTIER ==============
const colors = {
  rouge: '#DC2626',
  rougeLight: '#FEE2E2',
  vert: '#16A34A',
  vertLight: '#DCFCE7',
  noir: '#171717',
  blanc: '#FFFFFF',
  gris: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717'
  }
};

// ============== ÉTAPE 0 - VUE GLOBALE ==============
function VueGlobale({ chantiers, stats, onSelectChantier, onCreateChantier, searchTerm, setSearchTerm, filterStatus, setFilterStatus }) {
  const filteredChantiers = chantiers.filter(c => {
    const matchSearch = !searchTerm || 
      c.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchFilter = filterStatus === 'all' ||
      (filterStatus === 'a_assigner' && c.current_step === 0) ||
      (filterStatus === 'en_cours' && c.current_step >= 1 && c.current_step <= 4) ||
      (filterStatus === 'termines' && c.current_step === 5);
    
    return matchSearch && matchFilter;
  });

  const getStepBadge = (chantier) => {
    const step = chantier.current_step;
    if (step === 0) return { text: 'À assigner', bg: colors.rougeLight, color: colors.rouge };
    if (step === 5) return { text: 'Terminé', bg: colors.vertLight, color: colors.vert };
    
    const hasSkipped = Object.values(chantier.steps_status || {}).some(s => s.skipped);
    if (hasSkipped) {
      return { text: `Étape ${step}/4 (avec sauts)`, bg: colors.rougeLight, color: colors.rouge };
    }
    return { text: `Étape ${step}/4`, bg: colors.gris[100], color: colors.gris[700] };
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 border border-gray-200 bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="p-5 border border-gray-200 bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">En cours</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.en_cours}</p>
        </div>
        <div className="p-5 border border-gray-200 bg-white shadow-sm">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">À assigner</p>
          <p className="text-3xl font-bold mt-1" style={{ color: colors.rouge }}>{stats.a_assigner}</p>
        </div>
      </div>

      {/* Recherche et filtre */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, référence ou client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 outline-none cursor-pointer"
        >
          <option value="all">Tous les chantiers</option>
          <option value="a_assigner">À assigner</option>
          <option value="en_cours">En cours</option>
          <option value="termines">Terminés</option>
        </select>
        <button
          onClick={onCreateChantier}
          className="px-5 py-2.5 bg-gray-900 text-white flex items-center justify-center gap-2 hover:bg-red-600 transition-colors font-medium"
        >
          <Plus size={18} />
          Nouveau chantier
        </button>
      </div>

      {/* Grille de chantiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredChantiers.map((chantier) => {
          const badge = getStepBadge(chantier);
          return (
            <div
              key={chantier.id}
              className="p-5 border border-gray-200 bg-white hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => onSelectChantier(chantier)}
            >
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-mono text-gray-500 tracking-wide">{chantier.reference}</p>
                  <h3 className="font-semibold text-gray-900 text-lg mt-1 group-hover:text-red-600 transition-colors">
                    {chantier.nom}
                  </h3>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <Building2 size={15} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{chantier.client || 'Client non défini'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin size={15} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{chantier.adresse || 'Adresse non définie'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span 
                    className="inline-block px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: badge.bg, color: badge.color }}
                  >
                    {badge.text}
                  </span>
                  <ChevronRight size={18} className="text-gray-400 group-hover:text-red-600 transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredChantiers.length === 0 && (
        <div className="text-center py-16 bg-gray-50 border border-gray-200">
          <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">Aucun chantier trouvé</p>
          <p className="text-gray-400 text-sm mt-1">Créez votre premier chantier pour commencer</p>
        </div>
      )}
    </div>
  );
}

// ============== FIL D'ARIANE ==============
function Breadcrumb({ currentStep, stepsStatus, onGoToStep }) {
  const steps = [
    { num: 1, label: 'Vue globale' },
    { num: 2, label: 'Planification' },
    { num: 3, label: 'Devis / Contre-étude' },
    { num: 4, label: 'Préparation' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 p-4 border border-gray-200 bg-white">
      {steps.map((step, idx) => {
        const status = stepsStatus?.[String(step.num)];
        const isValidated = status?.status === 'validated';
        const isSkipped = status?.skipped;
        const isCurrent = currentStep === step.num;
        const isPending = currentStep < step.num;

        let bgColor = colors.gris[200];
        let textColor = colors.gris[500];
        let icon = step.num;

        if (isValidated) {
          bgColor = colors.vert;
          textColor = colors.blanc;
          icon = <Check size={14} />;
        } else if (isSkipped) {
          bgColor = colors.rouge;
          textColor = colors.blanc;
        } else if (isCurrent) {
          bgColor = colors.rouge;
          textColor = colors.blanc;
        }

        return (
          <div key={step.num} className="flex items-center gap-2">
            {idx > 0 && <div className="w-6 sm:w-10 h-px bg-gray-300" />}
            <button
              onClick={() => !isPending && onGoToStep(step.num)}
              disabled={isPending}
              className={`flex flex-col items-center gap-1.5 ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
            >
              <div
                className="w-9 h-9 flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: bgColor, color: textColor }}
              >
                {icon}
              </div>
              <span className="text-xs text-gray-600 font-medium whitespace-nowrap">{step.label}</span>
              {isSkipped && <span className="text-xs font-semibold" style={{ color: colors.rouge }}>Sautée</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ============== ÉTAPE 1 - VUE GLOBALE CHANTIER ==============
function Etape1({ chantier, conducteurs }) {
  const conducteur = conducteurs.find(c => c.id === chantier.conducteur_id);
  const chefDeFile = conducteurs.find(c => c.id === chantier.chef_de_file_id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Infos */}
      <div className="p-5 border border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
          <FileText size={18} className="text-gray-500" />
          Informations
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Référence</span>
            <span className="font-mono text-gray-900 text-sm">{chantier.reference}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Nom</span>
            <span className="text-gray-900 text-sm font-medium">{chantier.nom}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Client</span>
            <span className="text-gray-900 text-sm">{chantier.client || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Adresse</span>
            <span className="text-gray-900 text-sm text-right max-w-[60%]">{chantier.adresse || '—'}</span>
          </div>
          {chantier.description && (
            <div className="pt-2">
              <span className="text-gray-500 text-sm block mb-1">Description</span>
              <p className="text-gray-700 text-sm bg-gray-50 p-3">{chantier.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Équipe */}
      <div className="p-5 border border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
          <Users size={18} className="text-gray-500" />
          Équipe
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Conducteur</span>
            <span className={`text-sm font-medium ${conducteur ? 'text-gray-900' : 'text-gray-400'}`}>
              {conducteur ? `${conducteur.prenom} ${conducteur.nom}` : 'Non assigné'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-50">
            <span className="text-gray-500 text-sm">Chef de file</span>
            <span className={`text-sm font-medium ${chefDeFile ? 'text-gray-900' : 'text-gray-400'}`}>
              {chefDeFile ? `${chefDeFile.prenom} ${chefDeFile.nom}` : 'Non assigné'}
            </span>
          </div>
          {chantier.equipe?.length > 0 && (
            <div className="pt-2">
              <span className="text-gray-500 text-sm block mb-2">Membres de l'équipe</span>
              <div className="space-y-1">
                {chantier.equipe.map((m, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 px-2 bg-gray-50">
                    <span className="text-gray-900">{m.nom}</span>
                    <span className="text-gray-500">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dossier */}
      <div className="p-5 border border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
          <FolderOpen size={18} className="text-gray-500" />
          Dossier administratif
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 py-2">
            <div className={`w-5 h-5 flex items-center justify-center ${chantier.dossier?.acompte_recu ? 'bg-green-100' : 'bg-gray-100'}`}>
              {chantier.dossier?.acompte_recu ? 
                <Check size={14} className="text-green-600" /> : 
                <X size={14} className="text-gray-400" />}
            </div>
            <span className={chantier.dossier?.acompte_recu ? 'text-gray-900' : 'text-gray-500'}>Acompte reçu</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className={`w-5 h-5 flex items-center justify-center ${chantier.dossier?.os_signe ? 'bg-green-100' : 'bg-gray-100'}`}>
              {chantier.dossier?.os_signe ? 
                <Check size={14} className="text-green-600" /> : 
                <X size={14} className="text-gray-400" />}
            </div>
            <span className={chantier.dossier?.os_signe ? 'text-gray-900' : 'text-gray-500'}>OS signé</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className={`w-5 h-5 flex items-center justify-center ${chantier.dossier?.contrat_signe ? 'bg-green-100' : 'bg-gray-100'}`}>
              {chantier.dossier?.contrat_signe ? 
                <Check size={14} className="text-green-600" /> : 
                <X size={14} className="text-gray-400" />}
            </div>
            <span className={chantier.dossier?.contrat_signe ? 'text-gray-900' : 'text-gray-500'}>Contrat signé</span>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="p-5 border border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 pb-3 border-b border-gray-100">
          <History size={18} className="text-gray-500" />
          Historique
        </h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {chantier.historique?.length > 0 ? (
            chantier.historique.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <Clock size={14} className="mt-0.5 flex-shrink-0 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">{h.action}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {h.user_nom} • {new Date(h.timestamp).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-sm py-4 text-center">Aucun historique</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============== ÉTAPE 2 - PLANIFICATION ==============
function Etape2({ chantier, conducteurs, onUpdate, onCreateConducteur }) {
  const [localData, setLocalData] = useState({
    conducteur_id: chantier.conducteur_id || '',
    chef_de_file_id: chantier.chef_de_file_id || '',
    dossier: chantier.dossier || { acompte_recu: false, os_signe: false, contrat_signe: false }
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createRole, setCreateRole] = useState('conducteur');

  const handleChange = (field, value) => {
    setLocalData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return { ...prev, [parent]: { ...prev[parent], [child]: value } };
      }
      return { ...prev, [field]: value };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onUpdate(localData);
    setHasChanges(false);
    toast.success('Modifications enregistrées');
  };

  const conducteursList = conducteurs.filter(c => c.role === 'conducteur');
  const chefsList = conducteurs.filter(c => c.role === 'chef_de_file');

  return (
    <div className="space-y-5">
      {hasChanges && (
        <div className="flex items-center justify-between p-4 border-l-4 border-yellow-400 bg-yellow-50">
          <span className="text-sm text-yellow-800 flex items-center gap-2 font-medium">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-900 text-white text-sm flex items-center gap-2 hover:bg-red-600 font-medium transition-colors"
          >
            <Save size={14} />
            Enregistrer
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Conducteur */}
        <div className="p-5 border border-gray-200 bg-white">
          <Label className="text-gray-700 font-semibold text-sm">Conducteur de travaux</Label>
          <div className="flex gap-2 mt-3">
            <select
              value={localData.conducteur_id}
              onChange={(e) => handleChange('conducteur_id', e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 outline-none"
            >
              <option value="">Sélectionner un conducteur...</option>
              {conducteursList.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <button
              onClick={() => { setCreateRole('conducteur'); setShowCreateDialog(true); }}
              className="px-3 py-2.5 border border-gray-300 hover:bg-gray-100 transition-colors"
              title="Ajouter un conducteur"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Chef de file */}
        <div className="p-5 border border-gray-200 bg-white">
          <Label className="text-gray-700 font-semibold text-sm">Chef de file</Label>
          <div className="flex gap-2 mt-3">
            <select
              value={localData.chef_de_file_id}
              onChange={(e) => handleChange('chef_de_file_id', e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 outline-none"
            >
              <option value="">Sélectionner un chef de file...</option>
              {chefsList.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <button
              onClick={() => { setCreateRole('chef_de_file'); setShowCreateDialog(true); }}
              className="px-3 py-2.5 border border-gray-300 hover:bg-gray-100 transition-colors"
              title="Ajouter un chef de file"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Dossier */}
      <div className="p-5 border border-gray-200 bg-white">
        <h3 className="font-semibold text-gray-900 mb-4 pb-3 border-b border-gray-100">Dossier administratif</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-100 hover:border-gray-300 transition-colors">
            <Checkbox
              checked={localData.dossier.acompte_recu}
              onCheckedChange={(checked) => handleChange('dossier.acompte_recu', checked)}
            />
            <span className="text-gray-700">Acompte reçu</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-100 hover:border-gray-300 transition-colors">
            <Checkbox
              checked={localData.dossier.os_signe}
              onCheckedChange={(checked) => handleChange('dossier.os_signe', checked)}
            />
            <span className="text-gray-700">Ordre de service signé</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-100 hover:border-gray-300 transition-colors">
            <Checkbox
              checked={localData.dossier.contrat_signe}
              onCheckedChange={(checked) => handleChange('dossier.contrat_signe', checked)}
            />
            <span className="text-gray-700">Contrat signé</span>
          </label>
        </div>
      </div>

      <CreateConducteurDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        role={createRole}
        onCreate={onCreateConducteur}
      />
    </div>
  );
}

// ============== ÉTAPE 3 - DEVIS / CONTRE-ÉTUDE ==============
function Etape3({ chantier, onUpdate }) {
  const [activeTab, setActiveTab] = useState('devis');
  const [contreEtude, setContreEtude] = useState(chantier.contre_etude || { montant_estime: 0, commentaires: '' });
  const [hasChanges, setHasChanges] = useState(false);

  const devis = chantier.devis || { montant_ht: 0, tva: 20, montant_ttc: 0 };
  const ecart = contreEtude.montant_estime - devis.montant_ht;
  const ecartPct = devis.montant_ht > 0 ? ((ecart / devis.montant_ht) * 100).toFixed(1) : 0;

  const handleSave = async () => {
    await onUpdate({ contre_etude: contreEtude });
    setHasChanges(false);
    toast.success('Contre-étude enregistrée');
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setActiveTab('devis')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'devis' 
              ? 'border-gray-900 text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Devis (lecture seule)
        </button>
        <button
          onClick={() => setActiveTab('contre_etude')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'contre_etude' 
              ? 'border-gray-900 text-gray-900' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Contre-étude
        </button>
      </div>

      {activeTab === 'devis' ? (
        <div className="p-6 border border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-4 bg-white border border-gray-200">
              <Label className="text-gray-500 text-xs uppercase tracking-wide">Montant HT</Label>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {devis.montant_ht.toLocaleString('fr-FR')} €
              </p>
            </div>
            <div className="p-4 bg-white border border-gray-200">
              <Label className="text-gray-500 text-xs uppercase tracking-wide">TVA ({devis.tva}%)</Label>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {(devis.montant_ht * devis.tva / 100).toLocaleString('fr-FR')} €
              </p>
            </div>
            <div className="p-4 bg-white border border-gray-200">
              <Label className="text-gray-500 text-xs uppercase tracking-wide">Montant TTC</Label>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {(devis.montant_ht * (1 + devis.tva / 100)).toLocaleString('fr-FR')} €
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
            <ExternalLink size={12} />
            Ce devis est en lecture seule. Modifiez-le depuis votre outil de facturation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {hasChanges && (
            <div className="flex items-center justify-between p-4 border-l-4 border-yellow-400 bg-yellow-50">
              <span className="text-sm text-yellow-800 flex items-center gap-2 font-medium">
                <AlertCircle size={16} />
                Modifications non enregistrées
              </span>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gray-900 text-white text-sm flex items-center gap-2 hover:bg-red-600 font-medium transition-colors"
              >
                <Save size={14} />
                Enregistrer
              </button>
            </div>
          )}

          <div className="p-6 border border-gray-200 bg-white">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Label className="text-gray-700 font-semibold text-sm">Montant estimé (HT)</Label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    value={contreEtude.montant_estime}
                    onChange={(e) => {
                      setContreEtude(prev => ({ ...prev, montant_estime: parseFloat(e.target.value) || 0 }));
                      setHasChanges(true);
                    }}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 bg-white text-gray-900 text-lg font-medium focus:border-gray-500 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">€</span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <Label className="text-gray-700 font-semibold text-sm">Écart avec le devis</Label>
                <p className={`text-2xl font-bold mt-2 ${
                  ecart > 0 ? 'text-red-600' : ecart < 0 ? 'text-green-600' : 'text-gray-900'
                }`}>
                  {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} € 
                  <span className="text-base font-normal ml-2">({ecartPct}%)</span>
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <Label className="text-gray-700 font-semibold text-sm">Commentaires</Label>
              <Textarea
                value={contreEtude.commentaires}
                onChange={(e) => {
                  setContreEtude(prev => ({ ...prev, commentaires: e.target.value }));
                  setHasChanges(true);
                }}
                placeholder="Notes et observations sur la contre-étude..."
                className="mt-2 border-gray-300 focus:border-gray-500 min-h-[120px]"
                rows={4}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== ÉTAPE 4 - PRÉPARATION ==============
function Etape4({ chantier, onUpdate }) {
  const [activeTab, setActiveTab] = useState('logistique');
  const [data, setData] = useState({
    logistique: chantier.logistique || [],
    risques_ppsps: chantier.risques_ppsps || [],
    moyens: chantier.moyens || [],
    planning: chantier.planning || [],
    blocages: chantier.blocages || []
  });
  const [hasChanges, setHasChanges] = useState(false);

  const tabs = [
    { id: 'logistique', label: 'Logistique', icon: Truck },
    { id: 'risques_ppsps', label: 'Risques (PPSPS)', icon: ShieldAlert },
    { id: 'moyens', label: 'Moyens', icon: Wrench },
    { id: 'planning', label: 'Planning', icon: BarChart3 },
    { id: 'blocages', label: 'Blocages', icon: AlertTriangle }
  ];

  const handleAdd = (field) => {
    const newItem = { id: Date.now().toString(), text: '', completed: false };
    setData(prev => ({ ...prev, [field]: [...prev[field], newItem] }));
    setHasChanges(true);
  };

  const handleRemove = (field, id) => {
    setData(prev => ({ ...prev, [field]: prev[field].filter(item => item.id !== id) }));
    setHasChanges(true);
  };

  const handleItemChange = (field, id, value) => {
    setData(prev => ({
      ...prev,
      [field]: prev[field].map(item => item.id === id ? { ...item, text: value } : item)
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onUpdate(data);
    setHasChanges(false);
    toast.success('Préparation enregistrée');
  };

  return (
    <div className="space-y-5">
      {hasChanges && (
        <div className="flex items-center justify-between p-4 border-l-4 border-yellow-400 bg-yellow-50">
          <span className="text-sm text-yellow-800 flex items-center gap-2 font-medium">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-gray-900 text-white text-sm flex items-center gap-2 hover:bg-red-600 font-medium transition-colors"
          >
            <Save size={14} />
            Enregistrer
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'border-gray-900 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {data[tab.id]?.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-gray-200 text-gray-700 font-bold">
                  {data[tab.id].length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-5 border border-gray-200 bg-white">
        <div className="space-y-3">
          {data[activeTab]?.map(item => (
            <div key={item.id} className="flex items-center gap-3">
              <input
                type="text"
                value={item.text}
                onChange={(e) => handleItemChange(activeTab, item.id, e.target.value)}
                placeholder={`Saisissez un élément...`}
                className="flex-1 px-4 py-3 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 outline-none"
              />
              <button
                onClick={() => handleRemove(activeTab, item.id)}
                className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          {data[activeTab]?.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">Aucun élément ajouté</p>
          )}
          
          <button
            onClick={() => handleAdd(activeTab)}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <Plus size={18} />
            Ajouter un élément
          </button>
        </div>
      </div>
    </div>
  );
}

// ============== DIALOG CRÉATION CHANTIER ==============
function CreateChantierDialog({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({
    nom: '',
    client: '',
    adresse: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      toast.error('Le nom du chantier est requis');
      return;
    }
    setLoading(true);
    try {
      await onCreate(formData);
      setFormData({ nom: '', client: '', adresse: '', description: '' });
      onClose();
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl">Nouveau chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label className="text-gray-700 font-medium">Nom du chantier *</Label>
            <Input
              value={formData.nom}
              onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
              placeholder="Ex: Construction Villa Martin"
              className="mt-1.5 border-gray-300 focus:border-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Client</Label>
            <Input
              value={formData.client}
              onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
              placeholder="Ex: M. Martin"
              className="mt-1.5 border-gray-300 focus:border-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Adresse</Label>
            <Input
              value={formData.adresse}
              onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))}
              placeholder="Ex: 12 rue des Lilas, 75001 Paris"
              className="mt-1.5 border-gray-300 focus:border-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du chantier..."
              className="mt-1.5 border-gray-300 focus:border-gray-500"
              rows={3}
            />
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gray-900 hover:bg-red-600 text-white"
            >
              {loading ? 'Création...' : 'Créer le chantier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============== DIALOG CRÉATION CONDUCTEUR ==============
function CreateConducteurDialog({ open, onClose, role, onCreate }) {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.prenom.trim()) {
      toast.error('Nom et prénom requis');
      return;
    }
    setLoading(true);
    try {
      await onCreate({ ...formData, role });
      setFormData({ nom: '', prenom: '', telephone: '', email: '' });
      onClose();
      toast.success(role === 'conducteur' ? 'Conducteur créé' : 'Chef de file créé');
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl">
            {role === 'conducteur' ? 'Nouveau conducteur' : 'Nouveau chef de file'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700 font-medium">Prénom *</Label>
              <Input
                value={formData.prenom}
                onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                className="mt-1.5 border-gray-300 focus:border-gray-500"
              />
            </div>
            <div>
              <Label className="text-gray-700 font-medium">Nom *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                className="mt-1.5 border-gray-300 focus:border-gray-500"
              />
            </div>
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Téléphone</Label>
            <Input
              value={formData.telephone}
              onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
              className="mt-1.5 border-gray-300 focus:border-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-700 font-medium">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1.5 border-gray-300 focus:border-gray-500"
            />
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gray-900 hover:bg-red-600 text-white"
            >
              {loading ? 'Création...' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============== COMPOSANT PRINCIPAL ==============
export default function FlowChantier() {
  const { outilId } = useParams();
  const { user } = useAuth();

  const [chantiers, setChantiers] = useState([]);
  const [conducteurs, setConducteurs] = useState([]);
  const [stats, setStats] = useState({ total: 0, en_cours: 0, a_assigner: 0, termines: 0 });
  const [selectedChantier, setSelectedChantier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [chantiersRes, conducteursRes, statsRes] = await Promise.all([
        api.get('/flowchantier/chantiers'),
        api.get('/flowchantier/conducteurs'),
        api.get('/flowchantier/stats')
      ]);
      setChantiers(chantiersRes.data);
      setConducteurs(conducteursRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateChantier = async (data) => {
    const res = await api.post('/flowchantier/chantiers', data);
    setChantiers(prev => [res.data, ...prev]);
    setStats(prev => ({ ...prev, total: prev.total + 1, a_assigner: prev.a_assigner + 1 }));
    toast.success('Chantier créé');
  };

  const handleCreateConducteur = async (data) => {
    const res = await api.post('/flowchantier/conducteurs', data);
    setConducteurs(prev => [...prev, res.data]);
  };

  const handleUpdateChantier = async (data) => {
    if (!selectedChantier) return;
    const res = await api.put(`/flowchantier/chantiers/${selectedChantier.id}`, data);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
  };

  const handleValidateStep = async () => {
    if (!selectedChantier) return;
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/validate-step`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
    await fetchData();
    toast.success('Étape validée');
  };

  const handleSkipStep = async () => {
    if (!selectedChantier) return;
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/skip-step`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
    await fetchData();
    toast.info('Étape sautée');
  };

  const handleGoToStep = async (step) => {
    if (!selectedChantier) return;
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/go-to-step/${step}`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
  };

  const handleStartChantier = async () => {
    if (!selectedChantier) return;
    try {
      const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/start`);
      setSelectedChantier(res.data);
      setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
      await fetchData();
      toast.success('Chantier démarré');
    } catch (error) {
      toast.error(formatApiError(error));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100" style={{ fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {selectedChantier && (
                <button
                  onClick={() => setSelectedChantier(null)}
                  className="p-2 hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
              )}
              <h1 className="text-xl font-bold text-gray-900">
                <span style={{ color: colors.rouge }}>Flow</span>Chantier
              </h1>
              {selectedChantier && (
                <div className="hidden sm:flex items-center gap-2 text-gray-500">
                  <span>/</span>
                  <span className="font-mono text-sm">{selectedChantier.reference}</span>
                  <span>—</span>
                  <span className="font-medium text-gray-700">{selectedChantier.nom}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 hidden sm:block">
                {user?.prenom} {user?.nom}
              </span>
              <div className="w-8 h-8 bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedChantier ? (
          <>
            <VueGlobale
              chantiers={chantiers}
              stats={stats}
              onSelectChantier={setSelectedChantier}
              onCreateChantier={() => setShowCreateDialog(true)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
            />
            <CreateChantierDialog
              open={showCreateDialog}
              onClose={() => setShowCreateDialog(false)}
              onCreate={handleCreateChantier}
            />
          </>
        ) : (
          <div className="space-y-5">
            {/* Workflow controls */}
            {selectedChantier.current_step === 0 ? (
              <div className="p-6 border border-gray-200 bg-white">
                <h2 className="font-semibold text-gray-900 mb-3">Démarrer le chantier</h2>
                <p className="text-gray-600 mb-5">
                  Assignez un conducteur ou chef de file pour commencer le workflow.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={selectedChantier.conducteur_id || ''}
                    onChange={async (e) => {
                      await handleUpdateChantier({ conducteur_id: e.target.value || null });
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 bg-white text-gray-900 focus:border-gray-500 outline-none"
                  >
                    <option value="">Sélectionner un conducteur...</option>
                    {conducteurs.filter(c => c.role === 'conducteur').map(c => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleStartChantier}
                    disabled={!selectedChantier.conducteur_id && !selectedChantier.chef_de_file_id}
                    className="px-6 py-3 bg-gray-900 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
                  >
                    Démarrer le workflow
                  </button>
                </div>
              </div>
            ) : selectedChantier.current_step <= 4 ? (
              <>
                <Breadcrumb
                  currentStep={selectedChantier.current_step}
                  stepsStatus={selectedChantier.steps_status}
                  onGoToStep={handleGoToStep}
                />

                {/* Étape actuelle */}
                <div className="border border-gray-200 bg-white">
                  <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">
                      Étape {selectedChantier.current_step} — {
                        ['', 'Vue globale', 'Planification', 'Devis / Contre-étude', 'Préparation'][selectedChantier.current_step]
                      }
                    </h2>
                  </div>
                  <div className="p-5">
                    {selectedChantier.current_step === 1 && (
                      <Etape1 chantier={selectedChantier} conducteurs={conducteurs} />
                    )}
                    {selectedChantier.current_step === 2 && (
                      <Etape2
                        chantier={selectedChantier}
                        conducteurs={conducteurs}
                        onUpdate={handleUpdateChantier}
                        onCreateConducteur={handleCreateConducteur}
                      />
                    )}
                    {selectedChantier.current_step === 3 && (
                      <Etape3 chantier={selectedChantier} onUpdate={handleUpdateChantier} />
                    )}
                    {selectedChantier.current_step === 4 && (
                      <Etape4 chantier={selectedChantier} onUpdate={handleUpdateChantier} />
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex flex-col sm:flex-row justify-between gap-4 pt-2">
                  <button
                    onClick={() => handleGoToStep(Math.max(1, selectedChantier.current_step - 1))}
                    disabled={selectedChantier.current_step === 1}
                    className="px-5 py-3 border border-gray-300 text-gray-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                  >
                    ← Étape précédente
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handleSkipStep}
                      className="px-5 py-3 text-white font-medium transition-colors"
                      style={{ backgroundColor: colors.rouge }}
                    >
                      Sauter cette étape
                    </button>
                    <button
                      onClick={handleValidateStep}
                      className="px-5 py-3 text-white font-medium transition-colors"
                      style={{ backgroundColor: colors.vert }}
                    >
                      Valider et continuer →
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 border border-gray-200 bg-white text-center">
                <div 
                  className="w-20 h-20 mx-auto mb-5 flex items-center justify-center"
                  style={{ backgroundColor: colors.vertLight }}
                >
                  <Check size={40} style={{ color: colors.vert }} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Chantier terminé !</h2>
                <p className="text-gray-600 mb-6">
                  Toutes les étapes ont été complétées pour ce chantier.
                </p>
                <div className="max-w-2xl mx-auto">
                  <Breadcrumb
                    currentStep={5}
                    stepsStatus={selectedChantier.steps_status}
                    onGoToStep={handleGoToStep}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
