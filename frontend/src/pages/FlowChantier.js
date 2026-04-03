import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { formatApiError } from '../lib/api';
import {
  ArrowLeft, Plus, Search, Building2, MapPin,
  Check, AlertCircle, Clock, FileText,
  Users, FolderOpen, History, Truck, ShieldAlert,
  Wrench, BarChart3, AlertTriangle, Save, Trash2, Play,
  ChevronRight, X
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';

// ============== VUE GLOBALE (Liste des chantiers) ==============
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
    if (step === 0) return { text: 'À assigner', variant: 'destructive' };
    if (step === 5) return { text: 'Terminé', variant: 'default', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
    const hasSkipped = Object.values(chantier.steps_status || {}).some(s => s.skipped);
    if (hasSkipped) return { text: `Étape ${step}/4`, variant: 'destructive' };
    return { text: `Étape ${step}/4`, variant: 'secondary' };
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-white' },
          { label: 'En cours', value: stats.en_cours, color: 'text-blue-400' },
          { label: 'À assigner', value: stats.a_assigner, color: 'text-[#FF3B30]' }
        ].map((stat) => (
          <Card key={stat.label} className="bg-white/[0.03] border-white/[0.08]">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-zinc-500 font-medium">{stat.label}</p>
              <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/[0.03] border-white/[0.08] focus:border-white/20"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white focus:border-white/20 outline-none"
        >
          <option value="all">Tous</option>
          <option value="a_assigner">À assigner</option>
          <option value="en_cours">En cours</option>
          <option value="termines">Terminés</option>
        </select>
        <Button onClick={onCreateChantier} className="gap-2">
          <Plus size={18} />
          Nouveau
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredChantiers.map((chantier) => {
          const badge = getStepBadge(chantier);
          return (
            <Card 
              key={chantier.id} 
              className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer group"
              onClick={() => onSelectChantier(chantier)}
            >
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <code className="text-xs text-zinc-500">{chantier.reference}</code>
                  <Badge variant={badge.variant} className={badge.className}>{badge.text}</Badge>
                </div>
                <h3 className="font-semibold text-white text-lg mb-3 group-hover:text-[#FF3B30] transition-colors">
                  {chantier.nom}
                </h3>
                <div className="space-y-1.5 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-zinc-600" />
                    <span className="truncate">{chantier.client || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-zinc-600" />
                    <span className="truncate">{chantier.adresse || '—'}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex justify-end">
                  <ChevronRight size={18} className="text-zinc-600 group-hover:text-[#FF3B30] transition-colors" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredChantiers.length === 0 && (
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardContent className="py-16 text-center">
            <Building2 size={48} className="mx-auto mb-4 text-zinc-700" />
            <p className="text-zinc-500">Aucun chantier trouvé</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============== STEPPER / FIL D'ARIANE ==============
function Stepper({ currentStep, stepsStatus, onGoToStep }) {
  const steps = [
    { num: 1, label: 'Vue globale' },
    { num: 2, label: 'Planification' },
    { num: 3, label: 'Devis' },
    { num: 4, label: 'Préparation' }
  ];

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      {steps.map((step, idx) => {
        const status = stepsStatus?.[String(step.num)];
        const isValidated = status?.status === 'validated';
        const isSkipped = status?.skipped;
        const isCurrent = currentStep === step.num;
        const isPending = currentStep < step.num;

        return (
          <div key={step.num} className="flex items-center flex-1">
            <button
              onClick={() => !isPending && onGoToStep(step.num)}
              disabled={isPending}
              className={`flex items-center gap-3 ${isPending ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                ${isValidated ? 'bg-emerald-500 text-white' : ''}
                ${isSkipped ? 'bg-[#FF3B30] text-white' : ''}
                ${isCurrent && !isSkipped ? 'bg-[#FF3B30] text-white ring-4 ring-[#FF3B30]/20' : ''}
                ${!isValidated && !isSkipped && !isCurrent ? 'bg-white/[0.06] text-zinc-500' : ''}
              `}>
                {isValidated ? <Check size={18} /> : step.num}
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-zinc-400'}`}>{step.label}</p>
                {isSkipped && <p className="text-xs text-[#FF3B30]">Sautée</p>}
              </div>
            </button>
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-[2px] mx-4 rounded ${isValidated || (currentStep > step.num) ? 'bg-emerald-500' : 'bg-white/[0.08]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============== ÉTAPE 1 ==============
function Etape1({ chantier, conducteurs }) {
  const conducteur = conducteurs.find(c => c.id === chantier.conducteur_id);
  const chefDeFile = conducteurs.find(c => c.id === chantier.chef_de_file_id);

  const InfoRow = ({ label, value }) => (
    <div className="flex justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-zinc-500 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value || '—'}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={18} className="text-zinc-500" />
            Informations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Référence" value={<code className="text-zinc-300">{chantier.reference}</code>} />
          <InfoRow label="Nom" value={chantier.nom} />
          <InfoRow label="Client" value={chantier.client} />
          <InfoRow label="Adresse" value={chantier.adresse} />
        </CardContent>
      </Card>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users size={18} className="text-zinc-500" />
            Équipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Conducteur" value={conducteur ? `${conducteur.prenom} ${conducteur.nom}` : null} />
          <InfoRow label="Chef de file" value={chefDeFile ? `${chefDeFile.prenom} ${chefDeFile.nom}` : null} />
        </CardContent>
      </Card>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen size={18} className="text-zinc-500" />
            Dossier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { key: 'acompte_recu', label: 'Acompte reçu' },
            { key: 'os_signe', label: 'OS signé' },
            { key: 'contrat_signe', label: 'Contrat signé' }
          ].map(item => (
            <div key={item.key} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded flex items-center justify-center ${chantier.dossier?.[item.key] ? 'bg-emerald-500/20' : 'bg-white/[0.04]'}`}>
                {chantier.dossier?.[item.key] ? <Check size={12} className="text-emerald-400" /> : <X size={12} className="text-zinc-600" />}
              </div>
              <span className={chantier.dossier?.[item.key] ? 'text-white' : 'text-zinc-500'}>{item.label}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History size={18} className="text-zinc-500" />
            Historique
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {chantier.historique?.length > 0 ? chantier.historique.slice().reverse().slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Clock size={12} className="mt-1 text-zinc-600 flex-shrink-0" />
                <div>
                  <p className="text-zinc-300">{h.action}</p>
                  <p className="text-xs text-zinc-600">{h.user_nom}</p>
                </div>
              </div>
            )) : <p className="text-zinc-600 text-sm">Aucun historique</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============== ÉTAPE 2 ==============
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
    toast.success('Enregistré');
  };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save size={14} />
            Enregistrer
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conducteur de travaux</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <select
                value={localData.conducteur_id}
                onChange={(e) => handleChange('conducteur_id', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white focus:border-white/20 outline-none"
              >
                <option value="">Sélectionner...</option>
                {conducteurs.filter(c => c.role === 'conducteur').map(c => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
              <Button variant="outline" size="icon" onClick={() => { setCreateRole('conducteur'); setShowCreateDialog(true); }}>
                <Plus size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/[0.02] border-white/[0.06]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chef de file</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <select
                value={localData.chef_de_file_id}
                onChange={(e) => handleChange('chef_de_file_id', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white focus:border-white/20 outline-none"
              >
                <option value="">Sélectionner...</option>
                {conducteurs.filter(c => c.role === 'chef_de_file').map(c => (
                  <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                ))}
              </select>
              <Button variant="outline" size="icon" onClick={() => { setCreateRole('chef_de_file'); setShowCreateDialog(true); }}>
                <Plus size={18} />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/[0.02] border-white/[0.06]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dossier administratif</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'acompte_recu', label: 'Acompte reçu' },
              { key: 'os_signe', label: 'OS signé' },
              { key: 'contrat_signe', label: 'Contrat signé' }
            ].map(item => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={localData.dossier[item.key]}
                  onCheckedChange={(checked) => handleChange(`dossier.${item.key}`, checked)}
                />
                <span className="text-sm text-zinc-300">{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <CreateConducteurDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} role={createRole} onCreate={onCreateConducteur} />
    </div>
  );
}

// ============== ÉTAPE 3 ==============
function Etape3({ chantier, onUpdate }) {
  const [contreEtude, setContreEtude] = useState(chantier.contre_etude || { montant_estime: 0, commentaires: '' });
  const [hasChanges, setHasChanges] = useState(false);
  const devis = chantier.devis || { montant_ht: 0, tva: 20 };
  const ecart = contreEtude.montant_estime - devis.montant_ht;

  const handleSave = async () => {
    await onUpdate({ contre_etude: contreEtude });
    setHasChanges(false);
    toast.success('Enregistré');
  };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save size={14} />
            Enregistrer
          </Button>
        </div>
      )}

      <Tabs defaultValue="devis" className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/[0.08]">
          <TabsTrigger value="devis">Devis</TabsTrigger>
          <TabsTrigger value="contre_etude">Contre-étude</TabsTrigger>
        </TabsList>
        
        <TabsContent value="devis" className="mt-4">
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Montant HT</p>
                  <p className="text-2xl font-bold text-white">{devis.montant_ht.toLocaleString('fr-FR')} €</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">TVA ({devis.tva}%)</p>
                  <p className="text-2xl font-bold text-white">{(devis.montant_ht * devis.tva / 100).toLocaleString('fr-FR')} €</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Montant TTC</p>
                  <p className="text-2xl font-bold text-white">{(devis.montant_ht * (1 + devis.tva / 100)).toLocaleString('fr-FR')} €</p>
                </div>
              </div>
              <p className="text-xs text-zinc-600 text-center mt-4">Lecture seule</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contre_etude" className="mt-4">
          <Card className="bg-white/[0.02] border-white/[0.06]">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label className="text-zinc-400">Montant estimé (HT)</Label>
                  <div className="relative mt-1.5">
                    <Input
                      type="number"
                      value={contreEtude.montant_estime}
                      onChange={(e) => { setContreEtude(prev => ({ ...prev, montant_estime: parseFloat(e.target.value) || 0 })); setHasChanges(true); }}
                      className="pr-8 bg-white/[0.04] border-white/[0.08]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">€</span>
                  </div>
                </div>
                <div>
                  <Label className="text-zinc-400">Écart</Label>
                  <p className={`text-2xl font-bold mt-1.5 ${ecart > 0 ? 'text-red-400' : ecart < 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {ecart > 0 ? '+' : ''}{ecart.toLocaleString('fr-FR')} €
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-zinc-400">Commentaires</Label>
                <Textarea
                  value={contreEtude.commentaires}
                  onChange={(e) => { setContreEtude(prev => ({ ...prev, commentaires: e.target.value })); setHasChanges(true); }}
                  placeholder="Notes..."
                  className="mt-1.5 bg-white/[0.04] border-white/[0.08] min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== ÉTAPE 4 ==============
function Etape4({ chantier, onUpdate }) {
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
    { id: 'risques_ppsps', label: 'Risques', icon: ShieldAlert },
    { id: 'moyens', label: 'Moyens', icon: Wrench },
    { id: 'planning', label: 'Planning', icon: BarChart3 },
    { id: 'blocages', label: 'Blocages', icon: AlertTriangle }
  ];

  const handleAdd = (field) => {
    setData(prev => ({ ...prev, [field]: [...prev[field], { id: Date.now().toString(), text: '' }] }));
    setHasChanges(true);
  };

  const handleRemove = (field, id) => {
    setData(prev => ({ ...prev, [field]: prev[field].filter(item => item.id !== id) }));
    setHasChanges(true);
  };

  const handleItemChange = (field, id, value) => {
    setData(prev => ({ ...prev, [field]: prev[field].map(item => item.id === id ? { ...item, text: value } : item) }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onUpdate(data);
    setHasChanges(false);
    toast.success('Enregistré');
  };

  return (
    <div className="space-y-4">
      {hasChanges && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <span className="text-sm text-amber-400 flex items-center gap-2">
            <AlertCircle size={16} />
            Modifications non enregistrées
          </span>
          <Button size="sm" onClick={handleSave} className="gap-2">
            <Save size={14} />
            Enregistrer
          </Button>
        </div>
      )}

      <Tabs defaultValue="logistique" className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/[0.08] flex-wrap h-auto p-1">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 data-[state=active]:bg-white/[0.08]">
              <tab.icon size={14} />
              {tab.label}
              {data[tab.id]?.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{data[tab.id].length}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            <Card className="bg-white/[0.02] border-white/[0.06]">
              <CardContent className="p-4 space-y-2">
                {data[tab.id]?.map(item => (
                  <div key={item.id} className="flex gap-2">
                    <Input
                      value={item.text}
                      onChange={(e) => handleItemChange(tab.id, item.id, e.target.value)}
                      placeholder="Saisissez..."
                      className="bg-white/[0.04] border-white/[0.08]"
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(tab.id, item.id)} className="text-zinc-500 hover:text-red-400">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" onClick={() => handleAdd(tab.id)} className="w-full border-dashed gap-2">
                  <Plus size={16} />
                  Ajouter
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ============== DIALOGS ==============
function CreateChantierDialog({ open, onClose, onCreate }) {
  const [formData, setFormData] = useState({ nom: '', client: '', adresse: '', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim()) { toast.error('Nom requis'); return; }
    setLoading(true);
    try {
      await onCreate(formData);
      setFormData({ nom: '', client: '', adresse: '', description: '' });
      onClose();
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Nom *</Label><Input value={formData.nom} onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))} className="mt-1" /></div>
          <div><Label>Client</Label><Input value={formData.client} onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))} className="mt-1" /></div>
          <div><Label>Adresse</Label><Input value={formData.adresse} onChange={(e) => setFormData(prev => ({ ...prev, adresse: e.target.value }))} className="mt-1" /></div>
          <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} className="mt-1" rows={2} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? '...' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateConducteurDialog({ open, onClose, role, onCreate }) {
  const [formData, setFormData] = useState({ nom: '', prenom: '', telephone: '', email: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nom.trim() || !formData.prenom.trim()) { toast.error('Nom et prénom requis'); return; }
    setLoading(true);
    try {
      await onCreate({ ...formData, role });
      setFormData({ nom: '', prenom: '', telephone: '', email: '' });
      onClose();
      toast.success('Créé');
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role === 'conducteur' ? 'Nouveau conducteur' : 'Nouveau chef de file'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prénom *</Label><Input value={formData.prenom} onChange={(e) => setFormData(prev => ({ ...prev, prenom: e.target.value }))} className="mt-1" /></div>
            <div><Label>Nom *</Label><Input value={formData.nom} onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))} className="mt-1" /></div>
          </div>
          <div><Label>Téléphone</Label><Input value={formData.telephone} onChange={(e) => setFormData(prev => ({ ...prev, telephone: e.target.value }))} className="mt-1" /></div>
          <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className="mt-1" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? '...' : 'Créer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============== MAIN ==============
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
      const [c, d, s] = await Promise.all([
        api.get('/flowchantier/chantiers'),
        api.get('/flowchantier/conducteurs'),
        api.get('/flowchantier/stats')
      ]);
      setChantiers(c.data);
      setConducteurs(d.data);
      setStats(s.data);
    } catch (error) { toast.error(formatApiError(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/validate-step`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
    fetchData();
    toast.success('Étape validée');
  };

  const handleSkipStep = async () => {
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/skip-step`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
    fetchData();
  };

  const handleGoToStep = async (step) => {
    const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/go-to-step/${step}`);
    setSelectedChantier(res.data);
    setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
  };

  const handleStartChantier = async () => {
    try {
      const res = await api.post(`/flowchantier/chantiers/${selectedChantier.id}/start`);
      setSelectedChantier(res.data);
      setChantiers(prev => prev.map(c => c.id === res.data.id ? res.data : c));
      fetchData();
      toast.success('Démarré');
    } catch (error) { toast.error(formatApiError(error)); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedChantier && (
              <Button variant="ghost" size="icon" onClick={() => setSelectedChantier(null)}>
                <ArrowLeft size={20} />
              </Button>
            )}
            <h1 className="text-xl font-bold">
              <span className="text-[#FF3B30]">Flow</span>Chantier
            </h1>
            {selectedChantier && (
              <span className="text-zinc-500 hidden sm:inline">
                / <code className="text-zinc-400">{selectedChantier.reference}</code> — {selectedChantier.nom}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 hidden sm:inline">{user?.prenom} {user?.nom}</span>
            <div className="w-8 h-8 rounded-full bg-[#FF3B30] flex items-center justify-center text-xs font-bold">
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {!selectedChantier ? (
          <>
            <VueGlobale chantiers={chantiers} stats={stats} onSelectChantier={setSelectedChantier} onCreateChantier={() => setShowCreateDialog(true)} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterStatus={filterStatus} setFilterStatus={setFilterStatus} />
            <CreateChantierDialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} onCreate={handleCreateChantier} />
          </>
        ) : (
          <div className="space-y-6">
            {selectedChantier.current_step === 0 ? (
              <Card className="bg-white/[0.02] border-white/[0.06]">
                <CardContent className="p-6">
                  <h2 className="font-semibold text-lg mb-2">Démarrer le chantier</h2>
                  <p className="text-zinc-400 text-sm mb-4">Assignez un conducteur pour commencer.</p>
                  <div className="flex gap-3">
                    <select
                      value={selectedChantier.conducteur_id || ''}
                      onChange={async (e) => await handleUpdateChantier({ conducteur_id: e.target.value || null })}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white outline-none"
                    >
                      <option value="">Sélectionner un conducteur...</option>
                      {conducteurs.filter(c => c.role === 'conducteur').map(c => (
                        <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                      ))}
                    </select>
                    <Button onClick={handleStartChantier} disabled={!selectedChantier.conducteur_id && !selectedChantier.chef_de_file_id} className="gap-2">
                      <Play size={16} />
                      Démarrer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : selectedChantier.current_step <= 4 ? (
              <>
                <Stepper currentStep={selectedChantier.current_step} stepsStatus={selectedChantier.steps_status} onGoToStep={handleGoToStep} />
                
                <Card className="bg-white/[0.02] border-white/[0.06]">
                  <CardHeader>
                    <CardTitle>
                      Étape {selectedChantier.current_step} — {['', 'Vue globale', 'Planification', 'Devis / Contre-étude', 'Préparation'][selectedChantier.current_step]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedChantier.current_step === 1 && <Etape1 chantier={selectedChantier} conducteurs={conducteurs} />}
                    {selectedChantier.current_step === 2 && <Etape2 chantier={selectedChantier} conducteurs={conducteurs} onUpdate={handleUpdateChantier} onCreateConducteur={handleCreateConducteur} />}
                    {selectedChantier.current_step === 3 && <Etape3 chantier={selectedChantier} onUpdate={handleUpdateChantier} />}
                    {selectedChantier.current_step === 4 && <Etape4 chantier={selectedChantier} onUpdate={handleUpdateChantier} />}
                  </CardContent>
                </Card>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => handleGoToStep(Math.max(1, selectedChantier.current_step - 1))} disabled={selectedChantier.current_step === 1}>
                    ← Précédent
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={handleSkipStep}>Sauter</Button>
                    <Button onClick={handleValidateStep} className="bg-emerald-600 hover:bg-emerald-700">Valider →</Button>
                  </div>
                </div>
              </>
            ) : (
              <Card className="bg-white/[0.02] border-white/[0.06]">
                <CardContent className="py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Chantier terminé</h2>
                  <p className="text-zinc-400">Toutes les étapes ont été complétées.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
