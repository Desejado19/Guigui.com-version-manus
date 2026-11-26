import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole, SubscriptionTier, CategoryGroupId, SubscriptionPlan, BusinessModelConfig, Language } from '../types';
import type { Business } from '../types';
import {
  Building2,
  User,
  Mail,
  Lock,
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
  Eye,
  EyeOff,
  CalendarDays,
  Store,
  Drama,
} from 'lucide-react';
import { GuiguiStar } from './GuiguiStar';
import { usePersistentState } from '../utils/persistentState';
import { getBusinessProfileCompletion } from '../utils/businessProfile';
import { useLocationCatalog } from '../hooks/useLocationCatalog';
import { DEFAULT_SUBSCRIPTION_PLANS, getAnnualPlanPrice, getPlanById, limitLabel, normaliseSubscriptionPlans } from '../data/subscriptionCatalog';
import { getTranslation } from '../utils/i18n';
import { GOOGLE_SIGN_IN_URL, googleLoginErrorMessage, isGoogleSignInConfigured } from '../services/googleIdentity';
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

const GoogleGlyph: React.FC = () => (
  <svg viewBox="0 0 48 48" className="h-4 w-4 shrink-0" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.46-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

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
  const [modalView, setModalView] = useState<'login' | 'register' | 'forgot' | 'team_invite'>('login');
  const [mfaCode, setMfaCode] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  // Credenciais já validadas que aguardam o segundo factor. Nunca são enviadas
  // ao servidor antes de o utilizador introduzir o código MFA.
  const [pendingMfa, setPendingMfa] = useState<
    | { kind: 'password'; email: string; password: string; googleIdToken?: string }
    | { kind: 'google'; credential: string }
    | null
  >(null);
  // Google verificado cujo e-mail já pertence a uma conta com palavra-passe.
  // Só fica ligado depois de o utilizador confirmar a palavra-passe dessa conta.
  const [pendingGoogleLink, setPendingGoogleLink] = useState<{ credential: string; email: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      setModalView(teamInviteToken ? 'team_invite' : 'login');
      setError(null);
      // Regresso do login Google por redireccionamento: mostra o motivo e retira
      // os parâmetros do URL para não repetirem o aviso em recarregamentos.
      const params = new URLSearchParams(window.location.search);
      if (params.get('google_login') === 'error') {
        setError(googleLoginErrorMessage(params.get('google_reason')));
        params.delete('google_login');
        params.delete('google_reason');
        const query = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
      }
      setMfaRequired(false);
      setPendingMfa(null);
      setPendingGoogleLink(null);
      setMfaCode('');
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
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  // Business Subscription & Payment State
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [regCategoryGroup, setRegCategoryGroup] = useState<CategoryGroupId>('restauracao');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('professional');
  const [selectedPlanId, setSelectedPlanId] = useState('plan-professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'orange_money' | 'telecel'>('orange_money');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'pending' | 'success'>('idle');
  // A conta é criada antes do pagamento para que /api/payments/create tenha
  // sessão e possa validar a posse do businessId. O botão final apenas entra.
  const [registeredBusinessAccount, setRegisteredBusinessAccount] = useState<{ user: UserProfile; business?: Partial<Business> } | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  // Modo devolvido pelo backend para cada provider. A UI adapta-se a simulated,
  // sandbox ou live sem precisar de conhecer a API concreta da operadora.
  const [paymentProviderModes, setPaymentProviderModes] = useState<Partial<Record<'orange_money' | 'telecel', 'simulated' | 'sandbox' | 'live'>>>({});
  const [transactionMode, setTransactionMode] = useState<'simulated' | 'sandbox' | 'live'>('simulated');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState('');
  const [subscriptionPlans] = usePersistentState<SubscriptionPlan[]>('guigui_subscription_plans', DEFAULT_SUBSCRIPTION_PLANS);
  const [businessModelConfig] = usePersistentState<BusinessModelConfig>('guigui_admin_business_model_config', {
    ticketCommissionPercent: 10, ticketFixedFeeXOF: 200, extraPostPriceXOF: 5000, extraPromotionPriceXOF: 10000, bannerWeeklyPriceXOF: 50000, annualDiscountPercent: 15, includedPostsPerMonth: 3, automaticSubscriptionSuspensionEnabled: true,
  });

  const formScrollRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void fetch('/api/payments/config', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((body: { providers?: Array<{ id?: string; mode?: string }> } | null) => {
        if (cancelled || !Array.isArray(body?.providers)) return;
        const next: Partial<Record<'orange_money' | 'telecel', 'simulated' | 'sandbox' | 'live'>> = {};
        for (const provider of body.providers) {
          if (provider.id !== 'orange_money' && provider.id !== 'telecel') continue;
          if (provider.mode === 'simulated' || provider.mode === 'sandbox' || provider.mode === 'live') {
            next[provider.id] = provider.mode;
          }
        }
        setPaymentProviderModes(next);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setRegisteredBusinessAccount(null);
      return;
    }
    if (formScrollRef.current) formScrollRef.current.scrollTop = 0;
  }, [isOpen, modalView, regStep]);

  if (!isOpen) return null;

  const authTitle = modalView === 'register'
    ? 'Crie a sua conta'
    : modalView === 'forgot'
      ? 'Recuperar acesso'
      : modalView === 'team_invite'
        ? 'Aceitar convite'
        : 'Acesse a sua conta';
  const authSubtitle = modalView === 'register'
    ? 'Registe-se como cidadão ou empresa'
    : modalView === 'forgot'
      ? 'Recupere o acesso à sua conta'
      : modalView === 'team_invite'
        ? 'Conclua o convite da sua empresa'
        : 'Entre com o seu email, senha ou Google';

  const availablePlans = normaliseSubscriptionPlans(subscriptionPlans).filter((plan) => plan.isActive && plan.isPublic);
  const selectedPlan = getPlanById(availablePlans.length > 0 ? availablePlans : DEFAULT_SUBSCRIPTION_PLANS, selectedPlanId, selectedTier);
  const selectedProviderMode = paymentProviderModes[paymentMethod] || 'simulated';
  const isSimulatedPayment = selectedProviderMode === 'simulated';
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
        body: JSON.stringify({
          email: email.trim(),
          password,
          ...(pendingGoogleLink ? { googleIdToken: pendingGoogleLink.credential } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (payload.code === 'MFA_REQUIRED') {
        setPendingMfa({
          kind: 'password',
          email: email.trim(),
          password,
          ...(pendingGoogleLink ? { googleIdToken: pendingGoogleLink.credential } : {}),
        });
        setMfaRequired(true);
        setMfaCode('');
        return;
      }
      if (!response.ok || !payload.user) throw new Error(payload.error || t('requestFailed'));
      setPendingGoogleLink(null);
      onLogin(payload.user as UserProfile);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('requestFailed'));
    }
  };

  const handleRequestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setResetMessage('');
    const response = await fetch('/api/auth/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: resetEmail }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setError(payload.error || t('requestFailed')); return; }
    // O código chega por email; a resposta nunca o devolve.
    setResetToken('');
    setResetMessage(payload.message || t('auth.resetGenerated'));
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

  const handleMfaSubmit = () => {
    if (!mfaCode?.trim()) {
      setError('Indique o código MFA.');
      return;
    }
    if (!pendingMfa) {
      setError('Volte a iniciar sessão para pedir um novo código MFA.');
      setMfaRequired(false);
      return;
    }
    const credentials = pendingMfa.kind === 'google'
      ? { googleIdToken: pendingMfa.credential, mfaCode: mfaCode.trim() }
      : {
          email: pendingMfa.email,
          password: pendingMfa.password,
          ...(pendingMfa.googleIdToken ? { googleIdToken: pendingMfa.googleIdToken } : {}),
          mfaCode: mfaCode.trim(),
        };
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(payload.error || 'Falha na verificação MFA.');
          setMfaRequired(false);
          setPendingMfa(null);
          setMfaCode('');
          return;
        }
        const { user } = payload;
        setPendingGoogleLink(null);
        onLogin(user, user.business || undefined);
        setMfaRequired(false);
        setPendingMfa(null);
        setMfaCode('');
      })
      .catch(() => setError('Erro de conexão com o servidor'));
  };

  const passwordConfirmationError = () => {
    if (regPassword.length < 6) return 'Indique uma palavra-passe com pelo menos 6 carateres.';
    if (!regPasswordConfirm) return 'Confirme a palavra-passe.';
    if (regPassword !== regPasswordConfirm) return 'As palavras-passe não coincidem.';
    return null;
  };

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim());
    const passwordError = passwordConfirmationError();
    if (!regName.trim() || !emailIsValid || passwordError) {
      setError(!regName.trim() || !emailIsValid
        ? 'Indique um nome e um e-mail válido.'
        : passwordError as string);
      return;
    }
    setRegStep(2);
  };

  const handleNextToStep3 = () => {
    setPaymentPhone(regPhone);
    setRegStep(3);
  };

  const businessRegistrationPayload = () => ({
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
  });

  const ensureBusinessAccount = async () => {
    if (registeredBusinessAccount) return registeredBusinessAccount;
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(businessRegistrationPayload()),
    });
    let payload = await response.json().catch(() => ({})) as {
      user?: UserProfile;
      business?: Partial<Business>;
      error?: string;
    };
    if (!response.ok && response.status === 409) {
      // Registo já concluído numa tentativa anterior: recupera a sessão.
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      payload = await login.json().catch(() => ({}));
      if (!login.ok) throw new Error(payload.error || 'Não foi possível iniciar sessão.');
    }
    if (!payload.user) throw new Error(payload.error || 'Não foi possível criar a conta empresarial.');
    const account = { user: payload.user, business: payload.business };
    setRegisteredBusinessAccount(account);
    return account;
  };

  const handleExecuteOrangeMoneyPayment = async () => {
    setError(null);
    if (!paymentPhone.trim()) {
      setError(`Por favor indique o número associado ao ${paymentMethod === 'orange_money' ? 'Orange Money' : 'Telecel'}.`);
      return;
    }

    setPaymentStatus('processing');
    try {
      const businessAccount = await ensureBusinessAccount();
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          useCase: 'subscription_initial',
          useCaseLabel: `Subscrição ${selectedPlan.name} · ${regName}`,
          businessId: businessAccount.business?.id || businessAccount.user.businessId,
          businessName: businessAccount.business?.name || regName,
          payerName: regName,
          payerPhone: paymentPhone,
          amountXOF: calculateFinalAmount(),
          provider: paymentMethod,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.transaction) throw new Error(payload.error || 'Não foi possível criar o pagamento.');
      const transaction = payload.transaction as {
        id?: string;
        providerRef?: string;
        providerMode?: 'simulated' | 'sandbox' | 'live';
        status?: string;
        checkoutUrl?: string;
        paymentInstructions?: string;
      };
      setTransactionRef(transaction.providerRef || transaction.id || '');
      setTransactionMode(transaction.providerMode || selectedProviderMode);
      setPaymentCheckoutUrl(transaction.checkoutUrl || '');
      setPaymentInstructions(transaction.paymentInstructions || '');
      // Um adapter real pode devolver pending_provider (USSD/checkout à espera do
      // cliente). Só uma confirmação imediata deve abrir a conclusão do registo.
      setPaymentStatus(transaction.status === 'pending_provider' ? 'pending' : 'success');
    } catch (paymentError) {
      setPaymentStatus('idle');
      setError(paymentError instanceof Error ? paymentError.message : 'Não foi possível processar o pagamento.');
    }
  };

  const handleFinalizeBusinessRegistration = async () => {
    setError(null);
    try {
      const account = await ensureBusinessAccount();
      onLogin(account.user, account.business);
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
    const passwordError = passwordConfirmationError();
    if (!regName.trim() || !emailIsValid || passwordError) {
      setError(!regName.trim() || !emailIsValid
        ? 'Indique um nome e um e-mail válido.'
        : passwordError as string);
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
      className="fixed inset-0 z-[200] flex items-stretch justify-center overflow-y-auto overscroll-contain bg-[var(--color-bg-canvas)] p-0 no-scrollbar sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl lg:h-auto lg:max-h-[min(900px,calc(100dvh-3rem))] lg:flex-row">

        {/* Brand hero panel */}
        <div className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-[#0B3B37] p-10 text-white lg:flex lg:w-[53%]">
          <img
            src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1400&q=80"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0B3B37]/95 via-[#0F4A44]/90 to-[#071f1d]/98" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg">
              <GuiguiStar className="h-9 w-9" />
            </div>
            <div>
              <div className="text-3xl font-black leading-none tracking-tight">
                Guigui<span className="text-[#F0B65B]">.com</span>
              </div>
              <div className="mt-1.5 text-xs font-semibold text-white/80">Diretório &amp; Agenda Cultural de Bissau</div>
            </div>
          </div>

          <div className="relative space-y-6">
            <h2 className="text-4xl font-black leading-[1.05] xl:text-5xl">
              Bem-vindo ao<br /><span className="text-[#F0B65B]">Guigui.com!</span>
            </h2>
            <p className="max-w-md text-sm font-medium leading-relaxed text-white/85">
              Descubra eventos, empresas, serviços e muito mais em Bissau. Faça parte da nossa comunidade!
            </p>
            <ul className="space-y-3">
              {[
                { icon: CalendarDays, title: 'Eventos e Bilhetes', text: 'Não perca os melhores eventos' },
                { icon: Store, title: 'Empresas e Negócios', text: 'Encontre o que precisa' },
                { icon: Drama, title: 'Cultura e Entretenimento', text: 'Viva a cultura guineense' },
              ].map((item) => (
                <li key={item.title} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-green-800)] ring-1 ring-[#3c8574]">
                    <item.icon className="h-5 w-5 text-[#F0B65B]" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-white">{item.title}</span>
                    <span className="block text-xs text-white/70">{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <p className="font-serif text-2xl italic leading-none text-white/95">Guigui.com</p>
            <p className="mt-1.5 font-serif text-sm italic text-white/75">… a nossa cidade, a nossa vida!</p>
            <div className="mt-2.5 h-1 w-24 rounded-full bg-[#F0B65B]" />
          </div>
        </div>

        {/* Form panel */}
        <div className="relative flex h-full min-h-0 w-full flex-col bg-white dark:bg-[var(--color-bg-surface-dark)] sm:h-auto lg:w-[47%]">
          {onClose && (
                          <button type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-20 rounded-full border border-[var(--color-border-subtle)] bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-subtle)] dark:text-[#EEF7F4] dark:hover:bg-[#16332f] dark:hover:text-white sm:right-4 sm:top-4"
              title={`${t('close')} / Navegar como Visitante`}
              aria-label={`${t('close')} janela de autenticação`}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div ref={formScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 no-scrollbar sm:px-10 sm:py-10">

            {/* Compact brand on small screens */}
            <div className="mb-4 flex items-center gap-2.5 pr-12 lg:hidden sm:mb-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B3B37] shadow-sm sm:h-11 sm:w-11">
                <GuiguiStar className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black leading-none text-slate-900 dark:text-[#EEF7F4] sm:text-xl">
                  Guigui<span className="text-[#176158]">.com</span>
                </div>
                <div className="mt-1 truncate text-[10px] font-semibold text-slate-500 dark:text-[#9BCDBB] sm:text-[11px]">Diretório &amp; Agenda Cultural de Bissau</div>
              </div>
            </div>

            {(modalView === 'login' || modalView === 'register' || modalView === 'forgot') && (
              <div role="tablist" aria-label="Entrar ou criar conta" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#EEF7F4] p-1.5 dark:bg-[var(--color-bg-subtle)]">
                <button
                  type="button"
                  role="tab"
                  aria-selected={modalView !== 'register'}
                  onClick={() => { setModalView('login'); setError(null); setResetMessage(''); }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${modalView !== 'register' ? 'bg-[#0B3B37] text-white shadow-md shadow-[#0B3B37]/25 dark:bg-[#3FAE80] dark:text-[#071f1d]' : 'text-[#176158] hover:text-[#0B3B37] dark:text-[#C2DFD4] dark:hover:text-white'}`}
                >
                  <LogIn className="h-4 w-4" />
                  Entrar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={modalView === 'register'}
                  onClick={() => { setModalView('register'); setRegStep(1); setError(null); }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${modalView === 'register' ? 'bg-[#0B3B37] text-white shadow-md shadow-[#0B3B37]/25 dark:bg-[#3FAE80] dark:text-[#071f1d]' : 'text-[#176158] hover:text-[#0B3B37] dark:text-[#C2DFD4] dark:hover:text-white'}`}
                >
                  <UserPlus className="h-4 w-4" />
                  Criar Conta
                </button>
              </div>
            )}

            <div className="mt-5 space-y-1 text-center sm:mt-6">
              <h2 className="text-xl font-black tracking-tight text-[#0B3B37] dark:text-[#EEF7F4] sm:text-2xl">{authTitle}</h2>
              <p className="text-xs text-[#176158]/80 dark:text-[#9BCDBB] sm:text-sm">{authSubtitle}</p>
            </div>

            {messageNotice && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-500" />
                <span>{messageNotice}</span>
              </div>
            )}

            <div className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
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
                <input value={invitePhone} onChange={(event) => setInvitePhone(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" placeholder="+245 ..." />
              </label>
              <label className="block text-xs font-bold text-slate-700">Nova palavra-passe
                <input required minLength={6} type="password" value={invitePassword} onChange={(event) => setInvitePassword(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" />
              </label>
              <label className="block text-xs font-bold text-slate-700">Confirmar palavra-passe
                <input required minLength={6} type="password" value={inviteConfirm} onChange={(event) => setInviteConfirm(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-slate-900" />
              </label>
              <button type="submit" disabled={!invite} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50">Aceitar convite e entrar</button>
            </form>
          )}

          {/* VIEW 1: LOGIN FLOW */}
          {modalView === 'login' && (
            <div className="space-y-5">
              {isGoogleSignInConfigured() ? (
                // Redireccionamento completo para o servidor, que troca o código
                // de autorização pelo ID token com o client secret.
                <a
                  href={GOOGLE_SIGN_IN_URL}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-[var(--color-border-default)] bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-surface-dark)] dark:text-slate-100 dark:hover:bg-[#0f2f2a]"
                >
                  <GoogleGlyph />
                  <span>Continuar com a Google</span>
                </a>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--color-border-default)] bg-slate-50 px-4 py-3 text-center text-[11px] font-semibold text-slate-500 dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-surface-dark)] dark:text-[#9BCDBB]">
                  Login com Google indisponível. Configure VITE_GOOGLE_CLIENT_ID.
                </div>
              )}

              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#9BCDBB]">
                <span className="h-px flex-1 bg-slate-200 dark:bg-[var(--color-green-800)]" />
                <span>ou</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-[var(--color-green-800)]" />
              </div>

              {mfaRequired && (
                <div className="space-y-2 rounded-2xl border border-[#F8D18C] bg-[#FFF9ED] p-4">
                  <p className="text-xs font-bold text-[#6B3F0D]">
                    {t('auth.mfaRequired')}: introduza o código de 8 dígitos
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={mfaCode || ''}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      maxLength={8}
                      placeholder="00000000"
                      aria-label="Código MFA"
                      className="w-full rounded-xl border border-[#F0B65B] bg-white px-3 py-2.5 text-center font-mono text-base font-bold tracking-[0.3em] text-[#0B3B37] focus:outline-none focus:ring-2 focus:ring-[#E8A23A] sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleMfaSubmit}
                      className="shrink-0 rounded-xl bg-[#0B3B37] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0F4A44]"
                    >
                      Verificar
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleManualLogin} className="space-y-4">
                {pendingGoogleLink && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <p className="font-black">Confirmação necessária</p>
                    <p className="mt-1">
                      {pendingGoogleLink.email || 'Este e-mail'} já pertence a uma conta Guigui.com. Introduza a palavra-passe dessa conta para confirmar que é o titular e ligar o Google.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setPendingGoogleLink(null); setError(null); }}
                      className="mt-2 font-bold underline underline-offset-2"
                    >
                      Cancelar ligação
                    </button>
                  </div>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-[#DCEAE6]">Endereço de email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="o.seu.email@exemplo.com"
                      className="w-full rounded-xl border border-[#C2DFD4] bg-[#F7F5F1] dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-surface-dark)] py-3 pl-11 pr-4 text-base font-semibold text-slate-900 transition placeholder:text-slate-500 focus:border-[#0B3B37] focus:bg-white dark:text-[#EEF7F4] dark:placeholder:text-[var(--color-text-muted)] dark:focus:border-[#66BE9C] dark:focus:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[#0B3B37]/20 sm:text-sm"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-[#DCEAE6]">Senha</span>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Introduza a sua senha"
                      className="w-full rounded-xl border border-[#C2DFD4] bg-[#F7F5F1] dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-surface-dark)] py-3 pl-11 pr-12 text-base font-semibold text-slate-900 transition placeholder:text-slate-500 focus:border-[#0B3B37] focus:bg-white dark:text-[#EEF7F4] dark:placeholder:text-[var(--color-text-muted)] dark:focus:border-[#66BE9C] dark:focus:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[#0B3B37]/20 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 transition hover:text-slate-700 dark:text-[#9BCDBB] dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-[#C2DFD4]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--color-border-default)] accent-[#0B3B37]"
                    />
                    Lembrar-me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setModalView('forgot'); setError(null); setResetMessage(''); }}
                    className="text-xs font-bold text-[#0B3B37] hover:underline dark:text-[#F0B65B]"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B3B37] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#0B3B37]/20 transition hover:bg-[#0F4A44] dark:bg-[#E8A23A] dark:text-[#071f1d] dark:shadow-[#E8A23A]/20 dark:hover:bg-[#C9852A]"
                >
                  <LogIn className="h-4 w-4" />
                  Entrar
                </button>
              </form>

              <p className="text-center text-xs font-semibold text-slate-500 dark:text-[#9BCDBB]">
                Ainda não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => { setModalView('register'); setRegStep(1); setError(null); }}
                  className="font-bold text-[#0B3B37] hover:underline dark:text-[#F0B65B]"
                >
                  Criar conta agora →
                </button>
              </p>

            </div>
          )}

          {modalView === 'forgot' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]/80">
                <button type="button" onClick={() => { setModalView('login'); setError(null); }} className="text-xs font-bold text-[#176158] hover:text-[#0B3B37] flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-200/60">
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>
                <span className="text-[11px] font-bold text-slate-500 dark:text-[#9BCDBB]">Recuperar acesso</span>
              </div>
              <form onSubmit={handleRequestPasswordReset} className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">E-mail da conta
                  <input type="email" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="ex: nome@exemplo.com" className="mt-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-[var(--color-border-default)] dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <button type="submit" className="w-full px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">Enviar código de recuperação</button>
              </form>
              {resetMessage && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{resetMessage}</p>}
              <form onSubmit={handleResetPassword} className="space-y-3 border-t border-[var(--color-border-subtle)] dark:border-slate-700 pt-4">
                <label className="block text-xs font-bold text-slate-700">Código de recuperação
                  <input required value={resetToken} onChange={(event) => setResetToken(event.target.value)} className="mt-1 w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-[var(--color-border-default)] dark:border-slate-600 rounded-xl text-xs font-mono text-slate-900" />
                </label>
                <input type="password" required minLength={8} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} placeholder="Nova palavra-passe (mínimo 8)" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-[var(--color-border-default)] dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900" />
                <input type="password" required minLength={8} value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} placeholder="Confirmar nova palavra-passe" className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-[var(--color-border-default)] dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900" />
                <button type="submit" className="w-full px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl">Redefinir palavra-passe</button>
              </form>
              {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
            </div>
          )}

          {/* VIEW 2: REGISTER FLOW */}
          {modalView === 'register' && (
            <div className="space-y-5">
              {/* Back button */}
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]/80">
                <button
                  type="button"
                  onClick={() => {
                    if (regStep > 1) {
                      setRegStep((prev) => (prev - 1) as 1 | 2 | 3);
                    } else {
                      setModalView('login');
                    }
                    setError(null);
                  }}
                  className="text-xs font-bold text-[#176158] hover:text-[#0B3B37] flex items-center gap-1.5 transition px-2 py-1 rounded-lg hover:bg-slate-200/60"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{regStep > 1 ? `${t('back')} ao passo anterior` : `${t('back')} ao login`}</span>
                </button>

                <span className="text-[11px] font-bold text-slate-500 dark:text-[#9BCDBB]">
                  Registo: <strong>{regType === 'business' ? `Empresa (Passo ${regStep}/3)` : 'Cidadão'}</strong>
                </span>
              </div>

              {/* Step Bar for Business Registration */}
              {regType === 'business' && (
                <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-slate-100 p-2.5 dark:border-slate-700 dark:bg-slate-800 sm:p-3">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-600 sm:text-[11px]">
                    <div className={`flex items-center gap-1.5 ${regStep >= 1 ? 'text-blue-600 font-extrabold' : ''}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${regStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>1</span>
                      <span>Dados</span>
                    </div>
                    <div className="h-0.5 w-4 bg-slate-300 sm:w-8" />
                    <div className={`flex items-center gap-1.5 ${regStep >= 2 ? 'text-blue-600 font-extrabold' : ''}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${regStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-700'}`}>2</span>
                      <span>Escalão</span>
                    </div>
                    <div className="h-0.5 w-4 bg-slate-300 sm:w-8" />
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
                        className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition sm:gap-3 sm:p-3 ${
                          regType === 'user'
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm dark:border-[#3FAE80] dark:bg-[var(--color-bg-subtle)] dark:text-[#EEF7F4]'
                            : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${regType === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold">Cidadão</div>
                          <div className="text-[10px] opacity-75">Perfil Pessoal Grátis</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRegType('business')}
                        className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition sm:gap-3 sm:p-3 ${
                          regType === 'business'
                            ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-sm dark:border-[#3FAE80] dark:bg-[var(--color-bg-subtle)] dark:text-[#EEF7F4]'
                            : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${regType === 'business' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
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
                        className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                          className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
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
                        className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="registration-account-phone" className="block text-xs font-bold text-slate-700 mb-1">
                        {regType === 'business' ? 'Contacto Telefónico da Conta / Pagamento' : 'Contacto Telefónico *'}
                      </label>
                      <input
                        id="registration-account-phone"
                        type="text"
                        required={regType === 'user'}
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+245 955 88 99"
                        className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
                      />
                    </div>

                    {regType === 'business' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Localização em Bissau
                        </label>
                        <select
                          value={regNeighborhood}
                          onChange={(e) => setRegNeighborhood(e.target.value)}
                          className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
                        >
                          {bissauLocations.map((entry) => (
                            <option key={entry.id} value={entry.name}>{entry.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label htmlFor="registration-password" className="block text-xs font-bold text-slate-700 mb-1">
                        Crie uma Palavra-passe *
                      </label>
                      <input
                        id="registration-password"
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="⬢⬢⬢⬢⬢⬢⬢⬢"
                        className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
                      />
                    </div>

                    <div>
                      <label htmlFor="registration-password-confirm" className="block text-xs font-bold text-slate-700 mb-1">
                        Confirme a Palavra-passe *
                      </label>
                      <input
                        id="registration-password-confirm"
                        type="password"
                        required
                        minLength={6}
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        placeholder="Repita a palavra-passe"
                        className="w-full rounded-xl border border-[var(--color-border-default)] bg-white px-3 py-2.5 text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 sm:text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {regType === 'business'
                        ? 'Irá escolher o escalão no próximo passo.'
                        : 'A sua conta pessoal é 100% gratuita.'}
                    </span>

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-700 sm:w-auto"
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
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50/80 p-3 text-xs dark:border-[var(--color-green-800)] dark:bg-[var(--color-bg-subtle)]">
                    <div className="min-w-0">
                      <span className="text-slate-500 font-medium dark:text-[#9BCDBB]">Sector da Empresa:</span>
                      <div className="break-words font-extrabold text-blue-900 dark:text-[#EEF7F4]">
                        {CATEGORY_GROUP_PRICES[regCategoryGroup]?.name}
                      </div>
                    </div>

                    {/* Monthly vs Annual Toggle */}
                    <div className="flex shrink-0 items-center gap-1 rounded-xl border border-blue-200 bg-white p-1 dark:bg-slate-900">
                      <button
                        type="button"
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] transition ${
                          billingCycle === 'monthly'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-[#176158] hover:text-[#0B3B37] dark:text-[#C2DFD4] dark:hover:text-white'
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
                            : 'text-[#176158] hover:text-[#0B3B37] dark:text-[#C2DFD4] dark:hover:text-white'
                        }`}
                      >
                        <span>Anual</span>
                        <span className="bg-emerald-200 text-emerald-900 text-[9px] px-1 rounded font-black">-15%</span>
                      </button>
                    </div>
                  </div>

                  {/* Configurable plan catalogue */}
                  <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-2.5 text-[11px] text-indigo-950 dark:border-[#2b4a63] dark:bg-[#12273a] dark:text-[#D6E9F7]">
                    <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span><strong>Planos configuráveis:</strong> limites, benefícios e preços sincronizados com a Administração. Desconto anual actual: <strong>{businessModelConfig.annualDiscountPercent}%</strong>.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availablePlans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      const monthlyPrice = plan.price > 0 ? plan.price : getMonthlyPrice(regCategoryGroup, plan.legacyTier || selectedTier);
                      return (
                        <div key={plan.id} onClick={() => { setSelectedPlanId(plan.id); if (plan.legacyTier) setSelectedTier(plan.legacyTier); }} className={`p-3.5 rounded-2xl border-2 cursor-pointer transition space-y-1.5 relative select-none ${isSelected ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-md dark:border-[#3FAE80] dark:bg-[#123a34] dark:ring-[#3FAE80]/25' : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 hover:border-[var(--color-border-default)]'}`}>
                          <div className="flex items-center justify-between"><span className="min-w-0 break-words pr-2 font-black text-slate-900 text-sm">{plan.name}</span>{isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}</div>
                          <div className="font-mono text-base font-black text-slate-900">{monthlyPrice > 0 ? `${monthlyPrice.toLocaleString('pt-PT')} ${plan.currency}` : 'Preço negociado'}<span className="text-[10px] text-slate-500 font-normal"> /mês</span></div>
                          <ul className="space-y-1 text-[11px] text-slate-600"><li className="flex items-center gap-1.5 font-bold text-blue-700"><Check className="w-3.5 h-3.5 text-blue-600" /><span>{limitLabel(plan.postsPerMonth)} posts/mês</span></li><li className="flex items-center gap-1.5 font-bold text-amber-700"><Check className="w-3.5 h-3.5 text-amber-600" /><span>{limitLabel(plan.promotionsPerMonth)} promoções/mês</span></li><li className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600" /><span>{limitLabel(plan.maxCategories)} categoria(s) · {plan.featureSlugs.slice(0, 2).join(', ').replaceAll('_', ' ')}</span></li></ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-300 sm:w-auto"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t('back')} aos Dados</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextToStep3}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-blue-700 sm:w-auto"
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
                    <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                      <div className="min-w-0">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Empresa</span>
                        <h4 className="break-words text-sm font-extrabold text-white">{regName}</h4>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Escalão</span>
                        <span className="text-xs font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {selectedTier} ({billingCycle === 'annual' ? 'Anual' : 'Mensal'})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-300">Total a Pagar:</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {calculateFinalAmount().toLocaleString('pt-PT')} XOF
                      </span>
                    </div>
                  </div>

                  {isSimulatedPayment && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-[11px] leading-relaxed text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                      <strong className="block text-xs font-black">Modo de simulação ativo</strong>
                      A API da Orange Money/Telecel ainda não está ligada. Nenhum valor será debitado e nenhuma operadora será contactada; o pagamento é confirmado localmente para testar todo o fluxo empresarial.
                    </div>
                  )}

                  {/* Payment Method Selector */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#DCEAE6]">
                      Método de Pagamento Digital
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('orange_money')}
                        className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition sm:gap-2.5 sm:p-3 ${
                          paymentMethod === 'orange_money'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-950 font-black shadow-sm ring-2 ring-amber-500 dark:bg-amber-500/15 dark:text-amber-50'
                            : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-amber-900 dark:text-amber-200">Orange Money</div>
                          <div className="text-[10px] text-amber-700 font-medium dark:text-amber-300">#144#</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('telecel')}
                        className={`flex items-center gap-2 rounded-2xl border p-2.5 text-left transition sm:gap-2.5 sm:p-3 ${
                          paymentMethod === 'telecel'
                            ? 'bg-yellow-500/10 border-yellow-500 text-yellow-950 font-black shadow-sm ring-2 ring-yellow-500 dark:bg-yellow-500/15 dark:text-yellow-50'
                            : 'bg-white dark:bg-slate-900 border-[var(--color-border-subtle)] dark:border-slate-700 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-yellow-900 dark:text-yellow-200">MTN MoMo</div>
                          <div className="text-[10px] text-yellow-700 font-medium dark:text-yellow-300">*177#</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Phone Input for Orange Money Payment */}
                  {paymentStatus === 'idle' && (
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 space-y-3">
                      <div>
                        <label htmlFor="payment-phone" className="block text-xs font-bold text-slate-800 mb-1">
                          Número para Débito ({paymentMethod === 'orange_money' ? 'Orange Money +245 95...' : 'Telecel +245 96...'})
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                          <input
                            id="payment-phone"
                            type="text"
                            required
                            value={paymentPhone}
                            onChange={(e) => setPaymentPhone(e.target.value)}
                            placeholder="+245 955 88 99"
                            className="w-full rounded-xl border border-[var(--color-border-default)] bg-slate-50 py-2.5 pl-9 pr-3 text-base font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 sm:text-xs"
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 leading-relaxed">
                        {isSimulatedPayment
                          ? <>Ao simular, nenhum pedido é enviado à operadora e o plano não é activado. A conta é criada e o pagamento fica pendente de liquidação real.</>
                          : <>Ao clicar em confirmar, será aberto o pedido de pagamento de <strong>{calculateFinalAmount().toLocaleString('pt-PT')} XOF</strong> no provider selecionado.</>}
                      </div>

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                        <button
                          type="button"
                          onClick={() => setRegStep(2)}
                          className="w-full rounded-xl bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-300 sm:w-auto"
                        >
                          ← Alterar Escalão
                        </button>

                        <button
                          type="button"
                          onClick={handleExecuteOrangeMoneyPayment}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-600 sm:w-auto"
                        >
                          <Zap className="w-4 h-4 text-slate-950" />
                          <span>{isSimulatedPayment ? 'Simular' : 'Pagar'} {calculateFinalAmount().toLocaleString('pt-PT')} XOF</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Payment Processing Animation */}
                  {paymentStatus === 'processing' && (
                    <div className="p-5 bg-amber-50 border border-amber-300 rounded-3xl text-center space-y-2.5 animate-pulse">
                      <Loader2 className="w-9 h-9 text-amber-600 animate-spin mx-auto" />
                      <div className="font-extrabold text-amber-950 text-sm">
                        {isSimulatedPayment ? 'A processar pagamento simulado...' : 'A contactar o provider de pagamento...'}
                      </div>
                      <p className="text-xs text-amber-800 max-w-sm mx-auto leading-relaxed">
                        {isSimulatedPayment
                          ? <>Nenhuma operadora está a ser contactada. A confirmar <strong>{calculateFinalAmount().toLocaleString('pt-PT')} XOF</strong> em modo de teste.</>
                          : <>A aguardar a resposta do provider para o pagamento de <strong>{calculateFinalAmount().toLocaleString('pt-PT')} XOF</strong>.</>}
                      </p>
                    </div>
                  )}

                  {paymentStatus === 'pending' && (
                    <div className="space-y-2 rounded-3xl border border-sky-300 bg-sky-50 p-5 text-center">
                      <Loader2 className="mx-auto h-8 w-8 text-sky-600" />
                      <h4 className="text-sm font-black text-sky-950">Pagamento pendente de confirmação</h4>
                      <p className="mx-auto max-w-sm text-xs leading-relaxed text-sky-800">
                        {paymentInstructions || 'O provider ainda não confirmou o pagamento. Conclua o pedido e aguarde a confirmação.'}
                      </p>
                      {paymentCheckoutUrl && (
                        <a href={paymentCheckoutUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-700">
                          Abrir página de pagamento
                        </a>
                      )}
                      <div className="font-mono text-[11px] text-sky-900">Ref.: {transactionRef} · Modo: {transactionMode}</div>
                      <button
                        type="button"
                        onClick={handleFinalizeBusinessRegistration}
                        className="mx-auto block w-full rounded-xl bg-[#0B3B37] px-4 py-2.5 text-xs font-black text-white hover:bg-[#176158]"
                      >
                        Continuar para o painel da empresa
                      </button>
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
                          <h4 className="font-black text-emerald-950 text-sm sm:text-base">
                            {transactionMode === 'simulated' ? 'Pagamento Simulado Confirmado!' : 'Pagamento Confirmado com Sucesso!'}
                          </h4>
                          <p className="text-xs text-emerald-800">
                            {transactionMode === 'simulated' ? 'Recibo de demonstração · Subscrição ativa para testes' : 'Recibo Digital do Provider & Subscrição Ativa'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-2xl border border-emerald-200 space-y-1 text-xs text-slate-800 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Ref. Transacção:</span>
                          <span className="font-bold text-slate-900">{transactionRef}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Modo:</span>
                          <span className="font-bold uppercase text-slate-900">{transactionMode}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Empresa:</span>
                          <span className="font-bold text-slate-900">{regName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Escalão:</span>
                          <span className="font-bold text-blue-700 uppercase">{selectedTier} (3 posts/mês)</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 border-[var(--color-border-subtle)] dark:border-slate-700">
                          <span className="text-slate-500">{transactionMode === 'simulated' ? 'Valor Simulado:' : 'Valor Pago:'}</span>
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
          {onClose && (
            <div className="pt-4 text-center">
              <button type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-500 underline transition hover:text-slate-800 dark:text-[#9BCDBB] dark:hover:text-white"
              >
                Continuar apenas a visualizar conteúdos (Visitante sem conta)
              </button>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
