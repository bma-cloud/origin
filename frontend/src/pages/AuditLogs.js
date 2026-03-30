import { useState, useEffect } from 'react';
import { auditLogsApi, formatApiError } from '../lib/api';
import { FileText, Search, RefreshCw, AlertCircle, User, Clock, Layers } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await auditLogsApi.getAll(200);
      setLogs(response.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      login: 'Connexion',
      register: 'Inscription',
      create_user: 'Création utilisateur',
      update_user: 'Modification utilisateur',
      delete_user: 'Suppression utilisateur',
      create_domaine: 'Création domaine',
      update_domaine: 'Modification domaine',
      delete_domaine: 'Suppression domaine',
      create_outil: 'Création outil',
      update_outil: 'Modification outil',
      delete_outil: 'Suppression outil',
      assign_user_domaine: 'Assignation domaine',
      unassign_user_domaine: 'Retrait domaine',
      assign_user_outil: 'Assignation outil',
      update_user_outil_role: 'Modification rôle outil',
      unassign_user_outil: 'Retrait outil'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('delete') || action.includes('unassign')) return 'text-red-400';
    if (action.includes('create') || action.includes('register')) return 'text-emerald-400';
    if (action.includes('update') || action.includes('assign')) return 'text-zinc-300';
    if (action === 'login') return 'text-zinc-200';
    return 'text-zinc-400';
  };

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = !filterAction || log.action === filterAction;
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#FF3B30]/30 border-t-[#FF3B30] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="audit-logs-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-zinc-400 mt-1">Historique des actions sur la plateforme</p>
        </div>
        <button
          onClick={fetchLogs}
          className="btn-secondary px-4 py-2 flex items-center gap-2"
          data-testid="refresh-logs-btn"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher dans les logs..."
            className="w-full pl-10 pr-4 py-3 input-field"
            data-testid="audit-search-input"
          />
        </div>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-4 py-3 input-field min-w-[200px]"
          data-testid="audit-filter-select"
        >
          <option value="">Toutes les actions</option>
          {uniqueActions.map(action => (
            <option key={action} value={action}>{getActionLabel(action)}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-zinc-400 text-sm">Total</p>
          <p className="text-2xl font-bold">{logs.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-400 text-sm">Connexions</p>
          <p className="text-2xl font-bold text-zinc-200">
            {logs.filter(l => l.action === 'login').length}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-400 text-sm">Créations</p>
          <p className="text-2xl font-bold text-emerald-400">
            {logs.filter(l => l.action.includes('create')).length}
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-zinc-400 text-sm">Modifications</p>
          <p className="text-2xl font-bold text-zinc-300">
            {logs.filter(l => l.action.includes('update') || l.action.includes('assign')).length}
          </p>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Horodatage</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Utilisateur</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Action</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Entité</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">Détails</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-zinc-400">IP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="table-row" data-testid={`audit-row-${log.id}`}>
                  <td className="px-6 py-4">
                    <span className="mono text-sm text-zinc-300">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center">
                        <User size={14} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{log.user_nom || 'Système'}</p>
                        <p className="text-xs text-zinc-500">{log.user_email || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-medium ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-zinc-400" />
                      <span className="text-sm text-zinc-300">{log.entity_type}</span>
                    </div>
                    {log.entity_id && (
                      <p className="mono text-xs text-zinc-500 mt-1 truncate max-w-[150px]">
                        {log.entity_id}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-zinc-400 max-w-[200px]">
                        {Object.entries(log.details).slice(0, 2).map(([key, value]) => (
                          <p key={key} className="truncate">
                            <span className="text-zinc-500">{key}:</span>{' '}
                            <span className="mono">{String(value)}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="mono text-sm text-zinc-400">
                      {log.ip_address || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            Aucun log trouvé
          </div>
        )}
      </div>
    </div>
  );
}
