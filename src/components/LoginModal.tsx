import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, SubscriptionTier, CategoryGroupId, SubscriptionPlan, BusinessModelConfig, Language } from '../types';
import type { Business } from '../types';
import {
  ShieldCheck,
  Building2,
  User,
  Key,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  X,
  UserPlus,
  LogIn,
  Phone,
  CheckCircle2,
  Smartphone,
  Check,
  Zap,
  Loader2,
  Award,
} from 'lucide-react';
import { usePersistentState } from '../utils/persistentState';
import { getBusinessProfileCompletion } from '../utils/businessProfile';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { DEFAULT_SUBSCRIPTION_PLANS, getAnnualPlanPrice, getPlanById, limitLabel, normaliseSubscriptionPlans } from '../data/subscriptionCatalog';
import { getTranslation } from '../utils/i18n';
import { Button } from './ui';

interface LoginModalProps {
  isOpen: boolean;
  currentLang: Language;
  onLogin: (user: UserProfile, business?: Partial<Business>) => void;
  onClose?: () => void;
  messageNotice?: string;
  teamInviteToken?: string | null;
}

export const CATEGORY_GROUP_PRICES: Record<string, { name: string; prices: Record<SubscriptionTier, number> }> = {
  restauracao: {
    name: 'Restauração, Cafés e Pequeno Comércio',
    prices: { basic: 10000, professional: 25000, premium: 45000, enterprise: 85000 },
  },
  hotelaria_saude_educacao: {
    name: 'Hotelaria, Clínicas, Escolas e Comércio Médio',
    prices: { basic: 15000, professional: 35000, premium: 65000, enterprise: 120000 },
  },
  corporativo_financeiro: {
    name: 'Bancos, Seguradoras, Telecoms e Construção',
    prices: { basic: 35000, professional: 75000, premium: 150000, enterprise: 300000 },
  },
  'ongs_artesãos': {
    name: 'ONGs, Associações e Artesãos Local',
    prices: { basic: 5000, professional: 12000, premium: 25000, enterprise: 50000 },
  },
  servicos_profissionais: {
    name: 'Serviços Profissionais e Consultoria',
    prices: { basic: 12000, professional: 28000, premium: 50000, enterprise: 95000 },
  },
};

export const DEMO_ACCOUNTS: UserProfile[] = [
  {
    id: 'demo-citizen',
    name: 'Malam Bacar',
    email: 'cidadao.teste@guigui.com',
    role: 'user',
    phone: '+245 955 12 34',
    neighborhood: 'Bissau Velho',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'demo-business',
    name: 'Coqueiros Bissau',
    email: 'empresa.teste@guigui.com',
    role: 'business',
    phone: '+245 955 88 99',
    neighborhood: 'Praça dos Heróis',
    avatarUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80',
    businessId: 'biz-1',
    businessName: 'Coqueiros Bissau',
  },
  {
    id: 'demo-admin',
    name: 'Administração Guigui',
    email: 'admin.teste@guigui.com',
    role: 'admin',
    phone: '+245 955 00 00',
    neighborhood: 'Centro Administrativo',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
  },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  currentLang,
  onLogin,
  onClose,
  messageNotice,
  teamInviteToken,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const { locations: bissauLocations } = useLocationCatalog();
  // Modal flow states: 'choice' (Step 0) -> 'login' (Step 1 Login) | 'register' (Step 1 Register)
  const [modalView, setModalView] = useState<'choice' | 'login' | 'register' | 'forgot' | 'team_invite'>('choice');
  const [chosenOption, setChosenOption] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      setModalView(teamInviteToken ? 'team_invite' : 'choice');
      setChosenOption('login');
      setError(null);
      return () => {
        document.body.style.overflow = prevOverflow;
        document.body.classList.remove('modal-open');
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !teamInviteToken) return;
    fetch(`/api/business/team/invitations/${encodeURIComponent(teamInviteToken)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || t('auth.invalidInvite'));
        setInvite(payload.invitation);
      })
      .catch((error) => setError(error instanceof Error ? error.message : t('auth.invalidInvite')));
  }, [isOpen, teamInviteToken]);

  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [invite, setInvite] = useState<{ name: string; email: string; businessName: string; role: string } | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteConfirm, setInviteConfirm] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const handleAcceptInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!teamInviteToken || invitePassword.length < 6 || invitePassword !== inviteConfirm) {
      setError(invitePassword !== inviteConfirm ? t('auth.passwordMismatch') : t('auth.passwordMin', { count: 6 }));
      return;
    }
    try {
      const response = await fetch('/api/business/team/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: teamInviteToken, password: invitePassword, phone: invitePhone }),
      });
      const payload = await response.json() as { user?: UserProfile; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error || t('auth.inviteFailed'));
      onLogin(payload.user);
      window.history.replaceState({}, '', window.location.pathname);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : t('auth.inviteFailed'));
    }
  };

  // Register State
  const [regType, setRegType] = useState<'user' | 'business'>('user');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regNeighborhood, setRegNeighborhood] = useState('Bissau Velho');
  const [regBusinessPhone, setRegBusinessPhone] = useState('');
  const [regBusinessNeighborhood, setRegBusinessNeighborhood] = useState('');
  const [regSubcategory, setRegSubcategory] = useState('');
  const [regDescription, setRegDescription] = useState('');
  const [regPublicEmail, setRegPublicEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Business Subscription & Payment State
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regCategoryGroup, setRegCategoryGroup] = useState<CategoryGroupId>('restauracao');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('professional');
  const [selectedPlanId, setSelectedPlanId] = useState('plan-professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'orange_money' | 'telecel'>('orange_money');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [transactionRef, setTransactionRef] = useState('');
  const [subscriptionPlans] = usePersistentState<SubscriptionPlan[]>('guigui_subscription_plans', DEFAULT_SUBSCRIPTION_PLANS);
  const [businessModelConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10, ticketFixedFeeXOF: 200, extraPostPriceXOF: 5000, extraPromotionPriceXOF: 10000, bannerWeeklyPriceXOF: 50000, annualDiscountPercent: 15, includedPostsPerMonth: 3, automaticSubscriptionSuspensionEnabled: true,
  });

  if (!isOpen) return null;

  const availablePlans = normaliseSubscriptionPlans(subscriptionPlans).filter((plan) => plan.isActive && plan.isPublic);
  const selectedPlan = getPlanById(availablePlans.length > 0 ? availablePlans : DEFAULT_SUBSCRIPTION_PLANS, selectedPlanId, selectedTier);
  const getMonthlyPrice = (groupId: CategoryGroupId, tier: SubscriptionTier) => {
    const plan = getPlanById(availablePlans.length > 0 ? availablePlans : DEFAULT_SUBSCRIPTION_PLANS, selectedPlanId, tier);
    return plan.price > 0 ? plan.price : (CATEGORY_GROUP_PRICES[groupId]?.prices[tier] || 0);
  };

  const calculateFinalAmount = () => billingCycle === 'annual'
    ? (selectedPlan.price > 0 ? getAnnualPlanPrice(selectedPlan, businessModelConfig.annualDiscountPercent) : Math.round(getMonthlyPrice(regCategoryGroup, selectedTier) * 12 * (1 - businessModelConfig.annualDiscountPercent / 100)))
    : getMonthlyPrice(regCategoryGroup, selectedTier);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) throw new Error(payload.error || t('requestFailed'));
      onLogin(payload.user as UserProfile);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('requestFailed'));
    }
  };

  const handleDemoLogin = async (account: UserProfile) => {
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email, password: 'Guigui@2026!' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) throw new Error(payload.error || t('auth.demoFailed'));
      onLogin(payload.user as UserProfile);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('auth.demoFailed'));
    }
  };

  const handleRequestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResetMessage('');
    const response = await fetch('/api/auth/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setError(payload.error || t('requestFailed')); return; }
    setResetToken(payload.resetToken || '');
    setResetMessage(payload.resetToken ? t('auth.resetGenerated') : payload.message);
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (resetPassword.length < 8 || resetPassword !== resetConfirmation) { setError(resetPassword.length < 8 ? t('auth.passwordResetMin', { count: 8 }) : t('auth.confirmationMismatch')); return; }
    const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, newPassword: resetPassword }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setError(payload.error || t('requestFailed')); return; }
    setResetMessage(t('auth.resetSuccess'));
    setResetPassword('');
    setResetConfirmation('');
  };

  const handleProceedFromChoice = () => {
    setError(null);
    if (chosenOption === 'login') {
      setModalView('login');
    } else {
      setModalView('register');
      setRegStep(1);
    }
  };

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
    if (!regName.trim() || !emailIsValid || regPassword.length < 6) {
      setError('Indique um nome, um e-mail válido e uma palavra-passe com pelo menos 6 carateres.');
      return;
    }
    setRegStep(2);
  };

  const handleNextToStep3 = () => {
    setPaymentPhone(regPhone);
    setRegStep(3);
  };

  const handleExecuteOrangeMoneyPayment = async () => {
    setError(null);
    if (!paymentPhone.trim()) {
      setError(`Por favor indique o número associado ao ${paymentMethod === 'orange_money' ? 'Orange Money' : 'Telecel'}.`);
      return;
    }

    setPaymentStatus('processing');
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'subscription_initial',
          useCaseLabel: `Subscrição ${selectedPlan.name} · ${regName}`,
          businessName: regName,
          payerName: regName,
          payerPhone: paymentPhone,
          amountXOF: calculateFinalAmount(),
          provider: paymentMethod,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.transaction) throw new Error(payload.error || 'Não foi possível criar o pagamento.');
      setTransactionRef(payload.transaction.providerRef || payload.transaction.id);
      setPaymentStatus('success');
    } catch (paymentError) {
      setPaymentStatus('idle');
      setError(paymentError instanceof Error ? paymentError.message : 'Não foi possível processar o pagamento.');
    }
  };

  const handleFinalizeBusinessRegistration = async () => {
    setError(null);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: 'business',
          phone: regPhone,
          neighborhood: regNeighborhood || t('business.Todos'),
          businessName: regName,
          categoryId: regCategoryGroup,
          groupGroupId: regCategoryGroup,
          subcategoryId: regSubcategory.trim(),
          description: regDescription.trim(),
          businessPhone: regBusinessPhone.trim(),
          businessNeighborhood: regBusinessNeighborhood.trim(),
          ...(regPublicEmail.trim() ? { publicEmail: regPublicEmail.trim() } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        user?: UserProfile;
        business?: Partial<Business>;
        error?: string;
      };
      if (!response.ok || !payload.user) throw new Error(payload.error || 'Não foi possível criar a conta empresarial.');
      onLogin(payload.user, payload.business);
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Não foi possível criar a conta empresarial.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regType === 'business') {
      const completion = getBusinessProfileCompletion({
        name: regName,
        categoryId: regCategoryGroup,
        subcategoryId: regSubcategory,
        description: regDescription,
        phone: regBusinessPhone,
        neighborhood: regBusinessNeighborhood,
      });
      if (completion.missingFields.length > 0) {
        setError('Preencha os campos obrigatórios do perfil da empresa antes de continuar.');
        return;
      }
      if (regPublicEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regPublicEmail.trim())) {
        setError('Indique um e-mail público válido ou deixe o campo vazio.');
        return;
      }
      handleNextToStep2(e);
      return;
    }

    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
    if (!regName.trim() || !emailIsValid || regPassword.length < 6) {
      setError('Indique um nome, um e-mail válido e uma palavra-passe com pelo menos 6 carateres.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword, role: 'user', phone: regPhone || '+245 955 00 00', neighborhood: regNeighborhood || t('business.Todos') }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.user) throw new Error(payload.error || 'Não foi possível criar a conta.');
      onLogin(payload.user as UserProfile);
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Não foi possível criar a conta.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto overscroll-contain no-scrollbar"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 overscroll-contain">
        
        {/* Close Button for Guest / Visitor Exploration */}
        {onClose && (
          <button type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 guigui-close-button !border-white/20 !bg-white/10 !text-white hover:!bg-white/20 hover:!text-white"
            title={`${t('close')} / Navegar como Visitante`}
            aria-label={`${t('close')} janela de autenticação`}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 sm:p-7 border-b border-slate-800 relative">
          <div className="space-y-1.5 pr-8">
            <div className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-700 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Guigui.com</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              Acesso à Plataforma
            </h2>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {modalView === 'choice' && 'Escolha se deseja entrar na sua conta existente ou criar uma nova conta.'}
              {modalView === 'login' && 'Selecione uma conta de teste rápida ou introduza o seu e-mail e palavra-passe.'}
              {modalView === 'register' && 'Registe-se como Cidadão ou Empresário para usufruir de todas as funcionalidades.'}
              {modalView === 'team_invite' && 'Aceite o convite da sua empresa e crie a sua conta individual.'}
            </p>

            {messageNotice && (
              <div className="mt-2.5 p-3 bg-blue-950/90 border border-blue-700/80 rounded-2xl text-blue-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
                <span>{messageNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-800 p-5 sm:p-7 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {modalView === 'team_invite' && (
            <form onSubmit={handleAcceptInvitation} className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <strong>{invite?.name || 'Colaborador'}</strong>, foi convidado para a equipa de <strong>{invite?.businessName || 'empresa'}</strong> como <strong>{invite?.role || 'colaborador'}</strong>.
                {invite && <div className="mt-1 text-emerald-700">{invite.email}</div>}
              </div>
              <label className="block text-xs font-bold text-slate-700">Telemóvel (opcional)
                <input value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" placeholder="+245 ..." />
              </label>
              <label className="block text-xs font-bold text-slate-700">Nova palavra-passe
                <input required minLength={6} type="password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" />
              </label>
              <label className="block text-xs font-bold text-slate-700">Confirmar palavra-passe
                <input required minLength={6} type="password" value={inviteConfirm} onChange={(event) => setInviteConfirm(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" />
              </label>
              <button type="submit" disabled={!invite} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">Aceitar convite e entrar</button>
            </form>
          )}

          {/* VIEW 0: SELECTION SCREEN (Entrar ou Criar Conta) */}
          {modalView === 'choice' && (
            <div className="space-y-5 py-1">
              <div className="text-center sm:text-left">
                <h3 className="text-base font-black text-slate-900">
                  O que deseja fazer?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escolha uma opção e clique em <strong>Próximo Passo</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Entrar */}
                <div
                  onClick={() => setChosenOption('login')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 select-none ${
                    chosenOption === 'login'
                      ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        chosenOption === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                      }`}>
                        <LogIn className="w-5 h-5" />
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        chosenOption === 'login' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {chosenOption === 'login' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        Entrar na Conta
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Já tenho uma conta ou quero aceder rapidamente com uma conta de teste.
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    Acesso Imediato
                  </span>
                </div>

                {/* Option 2: Criar Conta */}
                <div
                  onClick={() => setChosenOption('register')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 select-none ${
                    chosenOption === 'register'
                      ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        chosenOption === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700'
                      }`}>
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        chosenOption === 'register' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {chosenOption === 'register' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        Criar Nova Conta
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Registar novo Cidadão ou Registar Empresa com Ficha e Publicações.
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    Novo Registo
                  </span>
                </div>
              </div>

              {/* Next Step Primary Button */}
              <div className="pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
                  >
                    Navegar como visitante
                  </button>
                ) : <div />}

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleProceedFromChoice}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </div>
          )}

          {/* VIEW 1: LOGIN FLOW */}
          {modalView === 'login' && (
            <div className="space-y-5">
              {/* Back to Choice button */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setModalView('choice');
                    setError(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition px-2 py-1 rounded-lg hover:bg-slate-200/60"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t('back')} à escolha anterior</span>
                </button>

                <span className="text-[11px] font-bold text-slate-500">
                  Modo: <strong>Entrar</strong>
                </span>
              </div>

              {/* Quick Select Public Accounts */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-blue-600" />
                    <span>Contas Rápidas de Teste e Demonstração (1-Clique)</span>
                  </h3>
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-200/80 px-2.5 py-1 rounded-xl">
                    <Lock className="w-3 h-3 text-slate-600" />
                    <span>Senha das contas de teste:</span>
                    <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono font-black text-blue-700 shadow-2xs">Guigui@2026!</code>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Account 1: Cidadão */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 group">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                          Cidadão
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-blue-600 transition">
                          Malam Bacar
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                          cidadao.teste@guigui.com
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Explorar feed, curtir, comentar, comprar bilhetes via SMS e seguir empresas.
                      </p>

                      <div className="pt-1 text-[10px] text-slate-500 font-medium border-t border-slate-100 flex items-center justify-between">
                        <span>Senha de teste:</span>
                        <code className="font-mono font-bold text-slate-800 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Guigui@2026!</code>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDemoLogin(DEMO_ACCOUNTS[0])}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Entrar como Cidadão</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Account 2: Comerciante / Empresa */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 group">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                          Empresa
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-600 transition">
                          Coqueiros Bissau
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                          empresa.teste@guigui.com
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Gerir ficha de empresa, menus, promoções, relatórios e validar bilhetes.
                      </p>

                      <div className="pt-1 text-[10px] text-slate-500 font-medium border-t border-slate-100 flex items-center justify-between">
                        <span>Senha de teste:</span>
                        <code className="font-mono font-bold text-slate-800 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Guigui@2026!</code>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDemoLogin(DEMO_ACCOUNTS[1])}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span>Entrar como Coqueiro</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Account 3: Administrador do Sistema */}
                  <div className="bg-white dark:bg-slate-900 border-2 border-amber-300/80 hover:border-amber-500 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3 group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-bl-full pointer-events-none" />
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                          <ShieldCheck className="w-4 h-4 text-amber-800" />
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-300">
                          🛡️ Super Admin
                        </span>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-amber-700 transition">
                          Administração Guigui
                        </h4>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                          admin.teste@guigui.com
                        </p>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Acesso total: moderação do feed, verificação de empresas e configurações.
                      </p>

                      <div className="pt-1 text-[10px] text-slate-500 font-medium border-t border-slate-100 flex items-center justify-between">
                        <span className="font-bold text-amber-900">Senha de Admin:</span>
                        <code className="font-mono font-black text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">Guigui@2026!</code>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDemoLogin(DEMO_ACCOUNTS[2])}
                      className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-amber-400 font-black text-xs transition flex items-center justify-center gap-1.5 shadow-sm border border-amber-500/30"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Entrar como Admin</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Manual Login Form */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>Ou entre com credenciais manuais</span>
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Preencher rápido:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('cidadao.teste@guigui.com');
                        setPassword('Guigui@2026!');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-blue-700 font-bold"
                    >
                      Cidadão
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('empresa.teste@guigui.com');
                        setPassword('Guigui@2026!');
                      }}
                      className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-emerald-700 font-bold"
                    >
                      Coqueiro
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('admin.teste@guigui.com');
                        setPassword('Guigui@2026!');
                      }}
                      className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold"
                    >
                      Admin (Guigui@2026!)
                    </button>
                  </div>
                </div>

                <form onSubmit={handleManualLogin} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Endereço de E-mail
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ex: admin.teste@guigui.com ou cidadao.teste@guigui.com"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Palavra-passe (Senha)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Guigui@2026!"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">
                      Senha das contas de teste: <strong className="text-slate-800 font-mono">Guigui@2026!</strong>
                    </span>

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => { setModalView('forgot'); setError(null); setResetMessage(''); }} className="text-[11px] font-bold text-blue-700 hover:underline">Esqueci-me da palavra-passe</button>
                      <Button type="submit" variant="primary" size="md" className="bg-slate-900 hover:bg-slate-800">
                        <span>Entrar Agora</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {modalView === 'forgot' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <button type="button" onClick={() => { setModalView('login'); setError(null); }} className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-200/60">
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>
                <span className="text-[11px] font-bold text-slate-500">Recuperar acesso</span>
              </div>
              <form onSubmit={handleRequestPasswordReset} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">E-mail da conta
                  <input type="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="ex: cidadao.teste@guigui.com" className="mt-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <button type="submit" className="w-full px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">Enviar código de recuperação</button>
              </form>
              {resetMessage && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{resetMessage}</p>}
              {resetToken && <form onSubmit={handleResetPassword} className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
                <label className="block text-xs font-bold text-slate-700">Código de recuperação
                  <input required value={resetToken} onChange={(event) => setResetToken(event.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono text-slate-900" />
                </label>
                <input type="password" required minLength={8} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="Nova palavra-passe (mínimo 8)" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900" />
                <input type="password" required minLength={8} value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} placeholder="Confirmar nova palavra-passe" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900" />
                <button type="submit" className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl">Redefinir palavra-passe</button>
              </form>}
              {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
            </div>
          )}

          {/* VIEW 2: REGISTER FLOW */}
          {modalView === 'register' && (
            <div className="space-y-5">
              {/* Back button */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    if (regStep > 1) {
                      setRegStep((prev) => (prev - 1) as 1 | 2 | 3);
                    } else {
                      setModalView('choice');
                    }
                    setError(null);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition px-2 py-1 rounded-lg hover:bg-slate-200/60"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{regStep > 1 ? `${t('back')} ao passo anterior` : `${t('back')} à escolha anterior`}</span>
                </button>

                <span className="text-[11px] font-bold text-slate-500">
                  Registo: <strong>{regType === 'business' ? `Empresa (Passo ${regStep}/3)` : 'Cidadão'}</strong>
                </span>
              </div>

              {/* Step Bar for Business Registration */}
              {regType === 'business' && (
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <div className={`flex items-center gap-1.5 ${regStep >= 1 ? 'text-blue-600 font-extrabold' : ''}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${regStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>1</span>
                      <span>Dados</span>
                    </div>
                    <div className="h-0.5 w-8 bg-slate-300" />
                    <div className={`flex items-center gap-1.5 ${regStep >= 2 ? 'text-blue-600 font-extrabold' : ''}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${regStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>2</span>
                      <span>Escalão</span>
                    </div>
                    <div className="h-0.5 w-8 bg-slate-300" />
                    <div className={`flex items-center gap-1.5 ${regStep >= 3 ? 'text-blue-600 font-extrabold' : ''}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${regStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>3</span>
                      <span>Pagamento</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: Main Info */}
              {regStep === 1 && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider mb-2">
                      Tipo de Conta a Criar
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRegType('user');
                          setRegStep(1);
                        }}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition ${
                          regType === 'user'
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${regType === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Cidadão</div>
                          <div className="text-[10px] opacity-75">Perfil Pessoal Grátis</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegType('business')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition ${
                          regType === 'business'
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${regType === 'business' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold">Empresa</div>
                          <div className="text-[10px] opacity-75">Com Ficha & Posts</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {regType === 'business' ? 'Nome da Empresa / Negócio *' : 'Seu Nome Completo *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder={regType === 'business' ? 'ex: Restaurante Coqueiros' : 'ex: Manuel Fernandes'}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {regType === 'business' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Sector / Categoria de Actividade *
                        </label>
                        <select
                          value={regCategoryGroup}
                          onChange={(e) => setRegCategoryGroup(e.target.value as CategoryGroupId)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="restauracao">Restauração, Cafés e Pequeno Comércio</option>
                          <option value="hotelaria_saude_educacao">Hotelaria, Clínicas, Escolas e Comércio Médio</option>
                          <option value="corporativo_financeiro">Bancos, Seguradoras, Telecoms e Construção</option>
                          <option value="ongs_artesãos">ONGs, Associações e Artesãos Local</option>
                          <option value="servicos_profissionais">Serviços Profissionais e Consultoria</option>
                        </select>
                      </div>
                    )}

                    {regType === 'business' && (
                      <>
                        <div>
                          <label htmlFor="business-registration-subcategory" className="block text-xs font-bold text-slate-700 mb-1">
                            Subcategoria da Empresa *
                          </label>
                          <input
                            id="business-registration-subcategory"
                            type="text"
                            required
                            value={regSubcategory}
                            onChange={(e) => setRegSubcategory(e.target.value)}
                            placeholder="ex: Costura, Padaria, Clínica"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label htmlFor="business-registration-description" className="block text-xs font-bold text-slate-700 mb-1">
                            Descrição da Empresa *
                          </label>
                          <textarea
                            id="business-registration-description"
                            required
                            minLength={30}
                            rows={3}
                            value={regDescription}
                            onChange={(e) => setRegDescription(e.target.value)}
                            placeholder="Descreva os produtos ou serviços da empresa (mínimo 30 caracteres)."
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="business-registration-phone" className="block text-xs font-bold text-slate-700 mb-1">
                            Telefone Público da Empresa *
                          </label>
                          <input
                            id="business-registration-phone"
                            type="tel"
                            required
                            value={regBusinessPhone}
                            onChange={(e) => setRegBusinessPhone(e.target.value)}
                            placeholder="ex: +245 955 88 99"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label htmlFor="business-registration-neighborhood" className="block text-xs font-bold text-slate-700 mb-1">
                            Bairro da Empresa *
                          </label>
                          <select
                            id="business-registration-neighborhood"
                            required
                            value={regBusinessNeighborhood}
                            onChange={(e) => setRegBusinessNeighborhood(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Selecione o bairro da empresa</option>
                            {bissauLocations.map((entry) => (
                              <option key={entry.id} value={entry.name}>{entry.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="business-registration-public-email" className="block text-xs font-bold text-slate-700 mb-1">
                            E-mail Público
                          </label>
                          <input
                            id="business-registration-public-email"
                            type="email"
                            value={regPublicEmail}
                            onChange={(e) => setRegPublicEmail(e.target.value)}
                            placeholder="contacto@empresa.com"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Endereço de E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="ex: contacto@exemplo.com"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="registration-account-phone" className="block text-xs font-bold text-slate-700 mb-1">
                        Contacto Telefónico da Conta / Pagamento
                      </label>
                      <input
                        id="registration-account-phone"
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+245 955 88 99"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Localização em Bissau
                      </label>
                      <select
                        value={regNeighborhood}
                        onChange={(e) => setRegNeighborhood(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {bissauLocations.map((entry) => (
                          <option key={entry.id} value={entry.name}>{entry.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className={regType === 'business' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Crie uma Palavra-passe *
                      </label>
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="⬢⬢⬢⬢⬢⬢⬢⬢"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {regType === 'business'
                        ? 'Irá escolher o escalão no próximo passo.'
                        : 'A sua conta pessoal é 100% gratuita.'}
                    </span>

                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                    >
                      <span>{regType === 'business' ? 'Próximo Passo (Escalão) →' : 'Concluir Registo e Entrar'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Tier Selection (Básico, Profissional, Premium, Enterprise) */}
              {regStep === 2 && regType === 'business' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/80 p-3 rounded-2xl border border-blue-200 text-xs">
                    <div>
                      <span className="text-slate-500 font-medium">Sector da Empresa:</span>
                      <div className="font-extrabold text-blue-900">
                        {CATEGORY_GROUP_PRICES[regCategoryGroup]?.name}
                      </div>
                    </div>

                    {/* Monthly vs Annual Toggle */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-blue-200">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] transition ${
                          billingCycle === 'monthly'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Mensal
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingCycle('annual')}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] transition flex items-center gap-1 ${
                          billingCycle === 'annual'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>Anual</span>
                        <span className="bg-emerald-200 text-emerald-900 text-[9px] px-1 rounded font-black">-15%</span>
                      </button>
                    </div>
                  </div>

                  {/* Configurable plan catalogue */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-2.5 text-[11px] text-indigo-950 flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><strong>Planos configuráveis:</strong> limites, benefícios e preços sincronizados com a Administração. Desconto anual actual: <strong>{businessModelConfig.annualDiscountPercent}%</strong>.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availablePlans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      const monthlyPrice = plan.price > 0 ? plan.price : getMonthlyPrice(regCategoryGroup, plan.legacyTier || selectedTier);
                      return (
                        <div key={plan.id} onClick={() => { setSelectedPlanId(plan.id); if (plan.legacyTier) setSelectedTier(plan.legacyTier); }} className={`p-3.5 rounded-2xl border-2 cursor-pointer transition space-y-1.5 relative select-none ${isSelected ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                          <div className="flex items-center justify-between"><span className="font-black text-slate-900 text-sm">{plan.name}</span>{isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}</div>
                          <div className="font-mono text-base font-black text-slate-900">{monthlyPrice > 0 ? `${monthlyPrice.toLocaleString('pt-PT')} ${plan.currency}` : 'Preço negociado'}<span className="text-[10px] text-slate-500 font-normal"> /mês</span></div>
                          <ul className="space-y-1 text-[11px] text-slate-600"><li className="flex items-center gap-1.5 font-bold text-blue-700"><Check className="w-3.5 h-3.5 text-blue-600" /><span>{limitLabel(plan.postsPerMonth)} posts/mês</span></li><li className="flex items-center gap-1.5 font-bold text-amber-700"><Check className="w-3.5 h-3.5 text-amber-600" /><span>{limitLabel(plan.promotionsPerMonth)} promoções/mês</span></li><li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /><span>{limitLabel(plan.maxCategories)} categoria(s) · {plan.featureSlugs.slice(0, 2).join(', ').replaceAll('_', ' ')}</span></li></ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t('back')} aos Dados</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextToStep3}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                    >
                      <span>Próximo Passo (Pagamento: {calculateFinalAmount().toLocaleString('pt-PT')} XOF) →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Digital Payment with Orange Money */}
              {regStep === 3 && regType === 'business' && (
                <div className="space-y-4">
                  {/* Subscription Summary */}
                  <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-3xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Empresa</span>
                        <h4 className="text-sm font-extrabold text-white">{regName}</h4>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Escalão</span>
                        <span className="text-xs font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {selectedTier} ({billingCycle === 'annual' ? 'Anual' : 'Mensal'})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">Total a Pagar:</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {calculateFinalAmount().toLocaleString('pt-PT')} XOF
                      </span>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-black uppercase text-slate-700 tracking-wider">
                      Método de Pagamento Digital
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('orange_money')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                          paymentMethod === 'orange_money'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-950 font-black shadow-sm ring-2 ring-amber-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-amber-900">Orange Money</div>
                          <div className="text-[10px] text-amber-700 font-medium">#144#</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('telecel')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                          paymentMethod === 'telecel'
                            ? 'bg-yellow-500/10 border-yellow-500 text-yellow-950 font-black shadow-sm ring-2 ring-yellow-500'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-yellow-900">MTN MoMo</div>
                          <div className="text-[10px] text-yellow-700 font-medium">*177#</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Phone Input for Orange Money Payment */}
                  {paymentStatus === 'idle' && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                      <div>
                        <label htmlFor="payment-phone" className="block text-xs font-bold text-slate-800 mb-1">
                          Número para Débito ({paymentMethod === 'orange_money' ? 'Orange Money +245 95...' : 'Telecel +245 96...'})
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          <input
                            id="payment-phone"
                            type="text"
                            required
                            value={paymentPhone}
                            onChange={(e) => setPaymentPhone(e.target.value)}
                            placeholder="+245 955 88 99"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        Ao clicar em confirmar, receberá uma notificação USSD para introduzir o seu código PIN e autorizar o débito de <strong>{calculateFinalAmount().toLocaleString('pt-PT')} XOF</strong>.
                      </div>

                      <div className="pt-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setRegStep(2)}
                          className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition"
                        >
                          ← Alterar Escalão
                        </button>

                        <button
                          type="button"
                          onClick={handleExecuteOrangeMoneyPayment}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2"
                        >
                          <Zap className="w-4 h-4 text-slate-950" />
                          <span>Pagar {calculateFinalAmount().toLocaleString('pt-PT')} XOF</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment Processing Animation */}
                  {paymentStatus === 'processing' && (
                    <div className="p-5 bg-amber-50 border border-amber-300 rounded-3xl text-center space-y-2.5 animate-pulse">
                      <Loader2 className="w-9 h-9 text-amber-600 animate-spin mx-auto" />
                      <div className="font-extrabold text-amber-950 text-sm">
                        Instrução USSD enviada para {paymentPhone}!
                      </div>
                      <p className="text-xs text-amber-800 max-w-sm mx-auto leading-relaxed">
                        Consulte o ecrã do seu telemóvel e digite o seu PIN para autorizar o pagamento de <strong>{calculateFinalAmount().toLocaleString('pt-PT')} XOF</strong>.
                      </p>
                    </div>
                  )}

                  {/* Payment Success Receipt */}
                  {paymentStatus === 'success' && (
                    <div className="p-5 bg-emerald-50 border border-emerald-300 rounded-3xl space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-black text-emerald-950 text-sm sm:text-base">Pagamento Confirmado com Sucesso!</h4>
                          <p className="text-xs text-emerald-800">Recibo Digital Orange Money & Subscrição Ativa</p>
                        </div>
                      </div>

                      <div className="bg-white/80 p-3 rounded-2xl border border-emerald-200 space-y-1 text-xs text-slate-800 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ref. Transacção:</span>
                          <span className="font-bold text-slate-900">{transactionRef}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Empresa:</span>
                          <span className="font-bold text-slate-900">{regName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Escalão:</span>
                          <span className="font-bold text-blue-700 uppercase">{selectedTier} (3 posts/mês)</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500">Valor Pago:</span>
                          <span className="font-black text-emerald-700">{calculateFinalAmount().toLocaleString('pt-PT')} XOF</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleFinalizeBusinessRegistration}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Concluir e Entrar no Painel da Empresa</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guest / Visitor Option Footer when in login or register */}
          {onClose && modalView !== 'choice' && (
            <div className="text-center pt-1 border-t border-slate-200/80">
              <button type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline transition"
              >
                Continuar apenas a visualizar conteúdos (Visitante sem conta)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
