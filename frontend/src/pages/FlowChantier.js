import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { formatApiError } from '../lib/api';
import {
  ArrowLeft, Plus, Search, Filter, Building2, MapPin, User,
  Check, AlertCircle, ChevronRight, X, Clock, FileText,
  Users, FolderOpen, History, Calendar, Truck, ShieldAlert,
  Wrench, BarChart3, AlertTriangle, Save, Trash2
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
const flowStyles = {
  // Couleurs strictes
  rouge: '#DC2626',
  vert: '#16A34A',
  gris: {
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
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
    if (step === 0) return { text: 'À assigner', color: flowStyles.rouge };
    if (step === 5) return { text: 'Terminé', color: flowStyles.vert };
    
    const hasSkipped = Object.values(chantier.steps_status || {}).some(s => s.skipped);
    if (hasSkipped) {
      return { text: `Étape ${step}/4 (avec sauts)`, color: flowStyles.rouge };
    }
    return { text: `Étape ${step}/4`, color: flowStyles.gris[500] };
  };

  return (
    <div className="space-y-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
          <p className="text-sm text-neutral-500">Total</p>
          <p className="text-2xl font-semibold text-neutral-900">{stats.total}</p>
        </div>
        <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
          <p className="text-sm text-neutral-500">En cours</p>
          <p className="text-2xl font-semibold text-neutral-900">{stats.en_cours}</p>
        </div>
        <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
          <p className="text-sm text-neutral-500">À assigner</p>
          <p className="text-2xl font-semibold" style={{ color: flowStyles.rouge }}>{stats.a_assigner}</p>
        </div>
      </div>

      {/* Recherche et filtre */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher par nom, référence ou client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-300 bg-white text-neutral-900"
            style={{ borderRadius: 0 }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-neutral-300 bg-white text-neutral-900"
          style={{ borderRadius: 0 }}
        >
          <option value="all">Tous</option>
          <option value="a_assigner">À assigner</option>
          <option value="en_cours">En cours</option>
          <option value="termines">Terminés</option>
        </select>
        <button
          onClick={onCreateChantier}
          className="px-4 py-2 bg-neutral-900 text-white flex items-center gap-2 hover:bg-red-600 transition-colors"
          style={{ borderRadius: 0 }}
        >
          <Plus size={18} />
          Nouveau chantier
        </button>
      </div>

      {/* Grille de chantiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChantiers.map((chantier) => {
          const badge = getStepBadge(chantier);
          return (
            <div
              key={chantier.id}
              className="p-4 border border-neutral-300 bg-white hover:border-neutral-400 transition-colors"
              style={{ borderRadius: 0 }}
            >
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 font-mono">{chantier.reference}</p>
                  <h3 className="font-semibold text-neutral-900 mt-1">{chantier.nom}</h3>
                </div>
                
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <Building2 size={14} />
                    <span>{chantier.client || 'Client non défini'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-600">
                    <MapPin size={14} />
                    <span>{chantier.adresse || 'Adresse non définie'}</span>
                  </div>
                </div>

                {/* Badge étape */}
                <div 
                  className="inline-block px-2 py-1 text-xs font-medium"
                  style={{ 
                    backgroundColor: badge.color === flowStyles.vert ? '#dcfce7' : 
                                    badge.color === flowStyles.rouge ? '#fee2e2' : '#f5f5f5',
                    color: badge.color,
                    borderRadius: 0
                  }}
                >
                  {badge.text}
                </div>

                <button
                  onClick={() => onSelectChantier(chantier)}
                  className="w-full mt-2 px-4 py-2 bg-neutral-900 text-white flex items-center justify-center gap-2 hover:bg-red-600 transition-colors"
                  style={{ borderRadius: 0 }}
                >
                  Ouvrir
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredChantiers.length === 0 && (
        <div className="text-center py-12 text-neutral-500">
          <Building2 size={48} className="mx-auto mb-4 opacity-50" />
          <p>Aucun chantier trouvé</p>
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
    <div className="flex items-center gap-2 p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
      {steps.map((step, idx) => {
        const status = stepsStatus?.[String(step.num)];
        const isValidated = status?.status === 'validated';
        const isSkipped = status?.skipped;
        const isCurrent = currentStep === step.num;
        const isPending = currentStep < step.num;

        let bgColor = flowStyles.gris[200];
        let textColor = flowStyles.gris[500];
        let icon = step.num;

        if (isValidated) {
          bgColor = flowStyles.vert;
          textColor = 'white';
          icon = <Check size={14} />;
        } else if (isSkipped) {
          bgColor = flowStyles.rouge;
          textColor = 'white';
        } else if (isCurrent) {
          bgColor = flowStyles.rouge;
          textColor = 'white';
        }

        return (
          <div key={step.num} className="flex items-center gap-2">
            {idx > 0 && <div className="w-8 h-px bg-neutral-300" />}
            <button
              onClick={() => !isPending && onGoToStep(step.num)}
              disabled={isPending}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-8 h-8 flex items-center justify-center text-sm font-medium"
                style={{ backgroundColor: bgColor, color: textColor, borderRadius: 0 }}
              >
                {icon}
              </div>
              <span className="text-xs text-neutral-600">{step.label}</span>
              {isSkipped && <span className="text-xs" style={{ color: flowStyles.rouge }}>Sautée</span>}
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
    <div className="grid grid-cols-2 gap-4">
      {/* Infos */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <FileText size={18} />
          Informations
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-neutral-500">Référence:</span>
            <span className="ml-2 font-mono">{chantier.reference}</span>
          </div>
          <div>
            <span className="text-neutral-500">Nom:</span>
            <span className="ml-2">{chantier.nom}</span>
          </div>
          <div>
            <span className="text-neutral-500">Client:</span>
            <span className="ml-2">{chantier.client || '-'}</span>
          </div>
          <div>
            <span className="text-neutral-500">Adresse:</span>
            <span className="ml-2">{chantier.adresse || '-'}</span>
          </div>
          <div>
            <span className="text-neutral-500">Description:</span>
            <p className="mt-1 text-neutral-700">{chantier.description || '-'}</p>
          </div>
        </div>
      </div>

      {/* Équipe */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <Users size={18} />
          Équipe
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-neutral-500">Conducteur:</span>
            <span className="ml-2">
              {conducteur ? `${conducteur.prenom} ${conducteur.nom}` : 'Non assigné'}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Chef de file:</span>
            <span className="ml-2">
              {chefDeFile ? `${chefDeFile.prenom} ${chefDeFile.nom}` : 'Non assigné'}
            </span>
          </div>
          {chantier.equipe?.length > 0 && (
            <div>
              <span className="text-neutral-500">Membres:</span>
              <ul className="mt-1 list-disc list-inside">
                {chantier.equipe.map((m, i) => (
                  <li key={i}>{m.nom} - {m.role}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Dossier */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <FolderOpen size={18} />
          Dossier
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {chantier.dossier?.acompte_recu ? 
              <Check size={16} className="text-green-600" /> : 
              <X size={16} className="text-neutral-400" />}
            <span>Acompte reçu</span>
          </div>
          <div className="flex items-center gap-2">
            {chantier.dossier?.os_signe ? 
              <Check size={16} className="text-green-600" /> : 
              <X size={16} className="text-neutral-400" />}
            <span>OS signé</span>
          </div>
          <div className="flex items-center gap-2">
            {chantier.dossier?.contrat_signe ? 
              <Check size={16} className="text-green-600" /> : 
              <X size={16} className="text-neutral-400" />}
            <span>Contrat signé</span>
          </div>
        </div>
      </div>

      {/* Historique */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <History size={18} />
          Historique
        </h3>
        <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
          {chantier.historique?.length > 0 ? (
            chantier.historique.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-neutral-600">
                <Clock size={14} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p>{h.action}</p>
                  <p className="text-xs text-neutral-400">
                    {h.user_nom} - {new Date(h.timestamp).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-neutral-400">Aucun historique</p>
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
    <div className="space-y-6">
      {hasChanges && (
        <div className="flex items-center justify-between p-3 border border-yellow-400 bg-yellow-50" style={{ borderRadius: 0 }}>
          <span className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-neutral-900 text-white text-sm flex items-center gap-2 hover:bg-red-600"
            style={{ borderRadius: 0 }}
          >
            <Save size={14} />
            Enregistrer
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Conducteur */}
        <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
          <Label className="text-neutral-700">Conducteur de travaux</Label>
          <div className="flex gap-2 mt-2">
            <select
              value={localData.conducteur_id}
              onChange={(e) => handleChange('conducteur_id', e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-300 bg-white text-neutral-900"
              style={{ borderRadius: 0 }}
            >
              <option value="">Sélectionner...</option>
              {conducteursList.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <button
              onClick={() => { setCreateRole('conducteur'); setShowCreateDialog(true); }}
              className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100"
              style={{ borderRadius: 0 }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Chef de file */}
        <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
          <Label className="text-neutral-700">Chef de file</Label>
          <div className="flex gap-2 mt-2">
            <select
              value={localData.chef_de_file_id}
              onChange={(e) => handleChange('chef_de_file_id', e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-300 bg-white text-neutral-900"
              style={{ borderRadius: 0 }}
            >
              <option value="">Sélectionner...</option>
              {chefsList.map(c => (
                <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
              ))}
            </select>
            <button
              onClick={() => { setCreateRole('chef_de_file'); setShowCreateDialog(true); }}
              className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100"
              style={{ borderRadius: 0 }}
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Dossier */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <h3 className="font-semibold text-neutral-900 mb-4">Dossier administratif</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={localData.dossier.acompte_recu}
              onCheckedChange={(checked) => handleChange('dossier.acompte_recu', checked)}
            />
            <span>Acompte reçu</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={localData.dossier.os_signe}
              onCheckedChange={(checked) => handleChange('dossier.os_signe', checked)}
            />
            <span>Ordre de service signé</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={localData.dossier.contrat_signe}
              onCheckedChange={(checked) => handleChange('dossier.contrat_signe', checked)}
            />
            <span>Contrat signé</span>
          </label>
        </div>
      </div>

      {/* Dialog création conducteur */}
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
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-neutral-300">
        <button
          onClick={() => setActiveTab('devis')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'devis' 
              ? 'border-neutral-900 text-neutral-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Devis (lecture seule)
        </button>
        <button
          onClick={() => setActiveTab('contre_etude')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contre_etude' 
              ? 'border-neutral-900 text-neutral-900' 
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Contre-étude
        </button>
      </div>

      {activeTab === 'devis' ? (
        <div className="p-4 border border-neutral-300 bg-neutral-100" style={{ borderRadius: 0 }}>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-neutral-500">Montant HT</Label>
              <p className="text-xl font-semibold text-neutral-900 mt-1">
                {devis.montant_ht.toLocaleString('fr-FR')} €
              </p>
            </div>
            <div>
              <Label className="text-neutral-500">TVA ({devis.tva}%)</Label>
              <p className="text-xl font-semibold text-neutral-900 mt-1">
                {(devis.montant_ht * devis.tva / 100).toLocaleString('fr-FR')} €
              </p>
            </div>
            <div>
              <Label className="text-neutral-500">Montant TTC</Label>
              <p className="text-xl font-semibold text-neutral-900 mt-1">
                {(devis.montant_ht * (1 + devis.tva / 100)).toLocaleString('fr-FR')} €
              </p>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            Ce devis est en lecture seule. Modifiez-le depuis votre outil de facturation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {hasChanges && (
            <div className="flex items-center justify-between p-3 border border-yellow-400 bg-yellow-50" style={{ borderRadius: 0 }}>
              <span className="text-sm text-yellow-800 flex items-center gap-2">
                <AlertCircle size={16} />
                Modifications non enregistrées
              </span>
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-neutral-900 text-white text-sm flex items-center gap-2 hover:bg-red-600"
                style={{ borderRadius: 0 }}
              >
                <Save size={14} />
                Enregistrer
              </button>
            </div>
          )}

          <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-neutral-700">Montant estimé (HT)</Label>
                <div className="relative mt-2">
                  <input
                    type="number"
                    value={contreEtude.montant_estime}
                    onChange={(e) => {
                      setContreEtude(prev => ({ ...prev, montant_estime: parseFloat(e.target.value) || 0 }));
                      setHasChanges(true);
                    }}
                    className="w-full px-3 py-2 pr-8 border border-neutral-300 bg-white text-neutral-900"
                    style={{ borderRadius: 0 }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500">€</span>
                </div>
              </div>
              <div>
                <Label className="text-neutral-700">Écart avec le devis</Label>
                <p className={`text-xl font-semibold mt-3 ${
                  ecart > 0 ? 'text-red-600' : ecart < 0 ? 'text-green-600' : 'text-neutral-900'
                }`}>
                  {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} € ({ecartPct}%)
                </p>
              </div>
            </div>
            
            <div className="mt-4">
              <Label className="text-neutral-700">Commentaires</Label>
              <Textarea
                value={contreEtude.commentaires}
                onChange={(e) => {
                  setContreEtude(prev => ({ ...prev, commentaires: e.target.value }));
                  setHasChanges(true);
                }}
                placeholder="Notes et observations..."
                className="mt-2 border-neutral-300"
                style={{ borderRadius: 0 }}
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
    <div className="space-y-6">
      {hasChanges && (
        <div className="flex items-center justify-between p-3 border border-yellow-400 bg-yellow-50" style={{ borderRadius: 0 }}>
          <span className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-neutral-900 text-white text-sm flex items-center gap-2 hover:bg-red-600"
            style={{ borderRadius: 0 }}
          >
            <Save size={14} />
            Enregistrer
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-300 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'border-neutral-900 text-neutral-900' 
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {data[tab.id]?.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-neutral-200 text-neutral-700" style={{ borderRadius: 0 }}>
                  {data[tab.id].length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
        <div className="space-y-3">
          {data[activeTab]?.map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                value={item.text}
                onChange={(e) => handleItemChange(activeTab, item.id, e.target.value)}
                placeholder={`Ajouter un élément...`}
                className="flex-1 px-3 py-2 border border-neutral-300 bg-white text-neutral-900"
                style={{ borderRadius: 0 }}
              />
              <button
                onClick={() => handleRemove(activeTab, item.id)}
                className="p-2 text-red-600 hover:bg-red-50"
                style={{ borderRadius: 0 }}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          
          <button
            onClick={() => handleAdd(activeTab)}
            className="w-full px-4 py-2 border border-dashed border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 flex items-center justify-center gap-2"
            style={{ borderRadius: 0 }}
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
      <DialogContent className="sm:max-w-md" style={{ borderRadius: 0 }}>
        <DialogHeader>
          <DialogTitle>Nouveau chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nom du chantier *</Label>
            <Input
              value={formData.nom}
              onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
              placeholder="Ex: Construction Villa Martin"
              className="mt-1"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div>
            <Label>Client</Label>
            <Input
              value={formData.client}
              onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
              placeholder="Ex: M. Martin"
              className="mt-1"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input
              value={formData.adresse}
              onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))}
              placeholder="Ex: 12 rue des Lilas, 75001 Paris"
              className="mt-1"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du chantier..."
              className="mt-1"
              style={{ borderRadius: 0 }}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} style={{ borderRadius: 0 }}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-neutral-900 hover:bg-red-600"
              style={{ borderRadius: 0 }}
            >
              {loading ? 'Création...' : 'Créer'}
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
      <DialogContent className="sm:max-w-md" style={{ borderRadius: 0 }}>
        <DialogHeader>
          <DialogTitle>
            {role === 'conducteur' ? 'Nouveau conducteur' : 'Nouveau chef de file'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prénom *</Label>
              <Input
                value={formData.prenom}
                onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))}
                className="mt-1"
                style={{ borderRadius: 0 }}
              />
            </div>
            <div>
              <Label>Nom *</Label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                className="mt-1"
                style={{ borderRadius: 0 }}
              />
            </div>
          </div>
          <div>
            <Label>Téléphone</Label>
            <Input
              value={formData.telephone}
              onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))}
              className="mt-1"
              style={{ borderRadius: 0 }}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="mt-1"
              style={{ borderRadius: 0 }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} style={{ borderRadius: 0 }}>
              Annuler
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-neutral-900 hover:bg-red-600"
              style={{ borderRadius: 0 }}
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
  const navigate = useNavigate();
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
    await fetchData(); // Refresh stats
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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          {selectedChantier && (
            <button
              onClick={() => setSelectedChantier(null)}
              className="p-2 hover:bg-neutral-200"
              style={{ borderRadius: 0 }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-semibold text-neutral-900">
            <span style={{ color: flowStyles.rouge }}>Flow</span>Chantier
          </h1>
          {selectedChantier && (
            <span className="text-neutral-500">
              / {selectedChantier.reference} - {selectedChantier.nom}
            </span>
          )}
        </div>
        
        {!selectedChantier && (
          <button
            onClick={() => navigate(`/outils/${outilId}`)}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Retour à l'outil
          </button>
        )}
      </div>

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
        <div className="space-y-6">
          {/* Workflow controls */}
          {selectedChantier.current_step === 0 ? (
            <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
              <p className="text-neutral-700 mb-4">
                Ce chantier n'a pas encore démarré. Assignez un conducteur ou chef de file pour commencer.
              </p>
              <div className="flex gap-4">
                <select
                  value={selectedChantier.conducteur_id || ''}
                  onChange={async (e) => {
                    await handleUpdateChantier({ conducteur_id: e.target.value || null });
                  }}
                  className="flex-1 px-3 py-2 border border-neutral-300 bg-white"
                  style={{ borderRadius: 0 }}
                >
                  <option value="">Sélectionner un conducteur...</option>
                  {conducteurs.filter(c => c.role === 'conducteur').map(c => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
                <button
                  onClick={handleStartChantier}
                  disabled={!selectedChantier.conducteur_id && !selectedChantier.chef_de_file_id}
                  className="px-6 py-2 bg-neutral-900 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-600"
                  style={{ borderRadius: 0 }}
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
              <div className="p-4 border border-neutral-300 bg-white" style={{ borderRadius: 0 }}>
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">
                  Étape {selectedChantier.current_step} - {
                    ['', 'Vue globale', 'Planification', 'Devis / Contre-étude', 'Préparation'][selectedChantier.current_step]
                  }
                </h2>

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

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  onClick={() => handleGoToStep(Math.max(1, selectedChantier.current_step - 1))}
                  disabled={selectedChantier.current_step === 1}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 disabled:opacity-50 hover:bg-neutral-100"
                  style={{ borderRadius: 0 }}
                >
                  Retour
                </button>
                <div className="flex gap-4">
                  <button
                    onClick={handleSkipStep}
                    className="px-4 py-2 border text-white"
                    style={{ borderRadius: 0, backgroundColor: flowStyles.rouge, borderColor: flowStyles.rouge }}
                  >
                    Sauter cette étape
                  </button>
                  <button
                    onClick={handleValidateStep}
                    className="px-4 py-2 text-white"
                    style={{ borderRadius: 0, backgroundColor: flowStyles.vert }}
                  >
                    Valider et continuer
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 border border-neutral-300 bg-white text-center" style={{ borderRadius: 0 }}>
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: flowStyles.vert, borderRadius: 0 }}>
                <Check size={32} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Chantier terminé</h2>
              <p className="text-neutral-600">
                Toutes les étapes ont été complétées pour ce chantier.
              </p>
              <Breadcrumb
                currentStep={5}
                stepsStatus={selectedChantier.steps_status}
                onGoToStep={handleGoToStep}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
