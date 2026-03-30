import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { domainesApi, usersApi, formatApiError } from '../lib/api';
import { 
  Plus, Search, Edit2, Trash2, Wrench,
  AlertCircle, ChevronDown, ChevronUp, UserPlus, X, Layers
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Domaines() {
  const { isDirection } = useAuth();
  const [domaines, setDomaines] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDomaine, setExpandedDomaine] = useState(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingDomaine, setEditingDomaine] = useState(null);
  const [assigningDomaine, setAssigningDomaine] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const [formData, setFormData] = useState({ nom: '', description: '' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [domainesRes, usersRes] = await Promise.all([
        domainesApi.getAll(),
        usersApi.getAll().catch(() => ({ data: [] }))
      ]);
      setDomaines(domainesRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDomaine(null);
    setFormData({ nom: '', description: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (domaine) => {
    setEditingDomaine(domaine);
    setFormData({ nom: domaine.nom, description: domaine.description || '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openAssignModal = (domaine) => {
    setAssigningDomaine(domaine);
    setSelectedUserId('');
    setFormError('');
    setIsAssignModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (editingDomaine) {
        await domainesApi.update(editingDomaine.id, formData);
      } else {
        await domainesApi.create(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    setFormError('');
    setFormLoading(true);

    try {
      await domainesApi.assignUser(assigningDomaine.id, selectedUserId);
      setIsAssignModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (domaineId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce domaine ?')) return;
    
    try {
      await domainesApi.delete(domaineId);
      fetchData();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const filteredDomaines = domaines.filter(d =>
    d.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="domaines-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domaines</h1>
          <p className="text-zinc-400 mt-1">Gérez les domaines de l'entreprise</p>
        </div>
        {isDirection && (
          <button
            onClick={openCreateModal}
            className="btn-primary px-4 py-2 flex items-center gap-2"
            data-testid="create-domaine-btn"
          >
            <Plus size={20} />
            <span>Nouveau domaine</span>
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un domaine..."
          className="w-full pl-12 pr-4 py-3.5 input-field rounded-xl"
          data-testid="domaine-search-input"
        />
      </div>

      {/* Domaines Grid - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDomaines.map((domaine) => {
          const isExpanded = expandedDomaine === domaine.id;
          
          return (
            <div 
              key={domaine.id} 
              className="glass-card overflow-hidden flex flex-col"
              data-testid={`domaine-card-${domaine.id}`}
            >
              <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-500/5 border border-zinc-500/10">
                    <Layers size={20} className="text-zinc-300" />
                  </div>
                  <div className="flex items-center gap-1">
                    {isDirection && (
                      <>
                        <button
                          onClick={() => openAssignModal(domaine)}
                          className="p-1.5 text-zinc-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-all"
                          title="Assigner utilisateur"
                          data-testid={`assign-domaine-${domaine.id}`}
                        >
                          <UserPlus size={16} />
                        </button>
                        <button
                          onClick={() => openEditModal(domaine)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all"
                          title="Modifier"
                          data-testid={`edit-domaine-${domaine.id}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(domaine.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Supprimer"
                          data-testid={`delete-domaine-${domaine.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-semibold text-lg mb-1">{domaine.nom}</h3>
                {domaine.description && (
                  <p className="text-sm text-zinc-400 mb-3 line-clamp-2">{domaine.description}</p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <button
                    onClick={() => setExpandedDomaine(isExpanded ? null : domaine.id)}
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <Wrench size={14} />
                    <span>{domaine.outils?.length || 0} outils</span>
                    {domaine.outils?.length > 0 && (
                      isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </button>
                </div>

                {/* Expanded outils list */}
                {isExpanded && domaine.outils?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
                    {domaine.outils.map((outil) => (
                      <div 
                        key={outil.id} 
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                      >
                        <span className="text-sm font-medium">{outil.nom}</span>
                        <div className="flex gap-1">
                          {outil.roles_disponibles?.slice(0, 2).map((role) => (
                            <span key={role} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500">
                              {role}
                            </span>
                          ))}
                          {outil.roles_disponibles?.length > 2 && (
                            <span className="text-xs text-zinc-600">+{outil.roles_disponibles.length - 2}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredDomaines.length === 0 && (
          <div className="col-span-full glass-card text-center py-16">
            <Layers size={48} className="mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">Aucun domaine trouvé</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              {editingDomaine ? 'Modifier le domaine' : 'Nouveau domaine'}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Nom</label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                placeholder="Ex: Production"
                required
                data-testid="domaine-nom-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2.5 input-field resize-none rounded-xl"
                rows={3}
                placeholder="Description du domaine..."
                data-testid="domaine-description-input"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 btn-secondary rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 px-4 py-2.5 btn-primary rounded-xl disabled:opacity-50"
                data-testid="domaine-submit-btn"
              >
                {formLoading ? 'Enregistrement...' : (editingDomaine ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign User Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/[0.08] max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Assigner à "{assigningDomaine?.nom}"
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAssignUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Utilisateur</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-2.5 input-field rounded-xl"
                required
                data-testid="assign-user-select"
              >
                <option value="">Sélectionner un utilisateur</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.prenom} {user.nom} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-zinc-500">
              Note: Si l'utilisateur est un Encadrant, il sera automatiquement assigné à tous les outils de ce domaine.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 px-4 py-2.5 btn-secondary rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading || !selectedUserId}
                className="flex-1 px-4 py-2.5 btn-primary rounded-xl disabled:opacity-50"
                data-testid="assign-submit-btn"
              >
                {formLoading ? 'Assignation...' : 'Assigner'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
