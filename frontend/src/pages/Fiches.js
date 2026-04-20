import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatApiError } from '../lib/api';
import { Search, ChevronRight, Loader2, RefreshCw, User } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function progressPercent(etapes) {
  if (!etapes?.length) return 0;
  const done = etapes.filter(e => e.statut === 'termine').length;
  return Math.round((done / etapes.length) * 100);
}

function ProgressBar({ percent }) {
  const color =
    percent === 100 ? 'bg-emerald-500' :
    percent > 0     ? 'bg-amber-500'   :
    'bg-zinc-700';

  return (
    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden w-24">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Fiches() {
  const navigate        = useNavigate();
  const [fiches, setFiches]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');

  const fetchFiches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/fiches');
      setFiches(res.data?.fiches ?? []);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiches(); }, [fetchFiches]);

  const filtered = fiches.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.code?.toLowerCase().includes(q) ||
      f.nom?.toLowerCase().includes(q)  ||
      f.ca?.nom_complet?.toLowerCase().includes(q) ||
      f.cf?.nom_complet?.toLowerCase().includes(q)
    );
  });

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
        <button onClick={fetchFiches} className="flex items-center gap-2 mx-auto text-sm text-zinc-400 hover:text-white">
          <RefreshCw size={16} /> Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Titre + recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Fiches Chef de File</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{fiches.length} chantier{fiches.length > 1 ? 's' : ''} synchronisé{fiches.length > 1 ? 's' : ''}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <Input
            placeholder="Rechercher code, nom, CA, CF…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.08] focus:border-white/20 h-9 text-sm"
          />
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <p className="text-center text-zinc-500 py-16">Aucun résultat</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {filtered.map(f => {
            const pct = progressPercent(f.etapes);
            return (
              <Card
                key={f.code}
                onClick={() => navigate(`/fiches/${f.code}`)}
                className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.14] cursor-pointer transition-all"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Code + nom */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{f.nom}</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-zinc-500 border-zinc-700 flex-shrink-0">
                        {f.code}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {f.ca?.nom_complet && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <User size={11} /> CA : {f.ca.nom_complet}
                        </span>
                      )}
                      {f.cf?.nom_complet ? (
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <User size={11} /> CF : {f.cf.nom_complet}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600 italic">CF non renseigné</span>
                      )}
                    </div>
                  </div>

                  {/* Progression */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <ProgressBar percent={pct} />
                    <span className="text-xs text-zinc-500 w-8 text-right">{pct}%</span>
                    <ChevronRight size={16} className="text-zinc-600" />
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
