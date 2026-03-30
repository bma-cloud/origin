import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatApiError } from '../lib/api';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 relative"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1774156702241-f916f9cd11ce?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA0MTJ8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBjb25zdHJ1Y3Rpb24lMjBidWlsZGluZyUyMGRhcmslMjBkcmFtYXRpY3xlbnwwfHx8fDE3NzQ4NTY1ODV8MA&ixlib=rb-4.1.0&q=85)',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-[#0a0a0a]/90" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#FF3B30] flex items-center justify-center shadow-[0_0_30px_rgba(255,59,48,0.4)]">
              <span className="text-white font-bold text-xl">BTP</span>
            </div>
            <span className="text-2xl font-semibold text-white">Manager</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Gérez vos chantiers<br />en toute simplicité
          </h1>
          <p className="text-zinc-400 text-lg max-w-md">
            Une plateforme moderne pour la gestion de vos projets de construction, 
            équipes et outils.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-[#FF3B30] flex items-center justify-center">
              <span className="text-white font-bold">BTP</span>
            </div>
            <span className="text-xl font-semibold">Manager</span>
          </div>

          <h2 className="text-3xl font-bold mb-2 tracking-tight">Connexion</h2>
          <p className="text-zinc-400 mb-8">
            Connectez-vous pour accéder à votre espace
          </p>

          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400" data-testid="login-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 input-field"
                placeholder="votre@email.com"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 input-field"
                  placeholder="••••••••"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  data-testid="toggle-password-btn"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 btn-primary font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="login-submit-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Se connecter</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-zinc-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-[#FF3B30] hover:underline" data-testid="register-link">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
