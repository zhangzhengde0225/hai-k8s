import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../config';
import { useAuthStore } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';

type LoginTab = 'sso' | 'local';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const [agree, setAgree] = useState(false);
  const [activeTab, setActiveTab] = useState<LoginTab>('sso');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  // 页面加载时从localStorage读取协议勾选状态
  useEffect(() => {
    const savedAgree = localStorage.getItem('user_agreement_accepted');
    if (savedAgree === 'true') {
      setAgree(true);
    }
  }, []);

  // 处理协议勾选变化，并保存到localStorage
  const handleAgreeChange = (checked: boolean) => {
    setAgree(checked);
    if (checked) {
      localStorage.setItem('user_agreement_accepted', 'true');
    } else {
      localStorage.removeItem('user_agreement_accepted');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agree) {
      setShowAgreementModal(true);
      return;
    }

    await doLogin();
  };

  const doLogin = async () => {
    if (activeTab === 'local') {
      // 本地账号登录
      if (!username || !password) {
        setError(t('agreeFirst'));
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/auth/login/local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || t('loginFailed'));
        }

        const data = await response.json();

        // 保存token到localStorage，供API client使用
        localStorage.setItem('token', data.access_token);

        // 获取完整的用户信息
        try {
          const userResponse = await fetch(`${API_BASE}/users/me`, {
            headers: {
              'Authorization': `Bearer ${data.access_token}`,
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            setAuth(data.access_token, userData);
          } else {
            // 如果获取用户信息失败，使用登录响应中的基本信息
            setAuth(data.access_token, {
              id: 0,
              username: data.username,
              email: data.email,
              full_name: data.username,
              role: data.role,
              is_active: true,
              cpu_quota: 4.0,
              memory_quota: 8.0,
              gpu_quota: 1,
              cpu_used: 0,
              memory_used: 0,
              gpu_used: 0,
              created_at: new Date().toISOString(),
              last_login_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          // 使用登录响应中的基本信息
          setAuth(data.access_token, {
            id: 0,
            username: data.username,
            email: data.email,
            full_name: data.username,
            role: data.role,
            is_active: true,
            cpu_quota: 4.0,
            memory_quota: 8.0,
            gpu_quota: 1,
            cpu_used: 0,
            memory_used: 0,
            gpu_used: 0,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          });
        }

        // 跳转到主页
        navigate('/');
      } catch (error: any) {
        setError(error.message || t('loginFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      // SSO 登录
      setIsLoading(true);
      window.location.href = `${API_BASE}/auth/login/sso`;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen [min-height:100svh] bg-gray-50 dark:bg-slate-950 relative">
      {/* 右上角主题和语言切换 */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      {/* 左侧介绍 - 移动端隐藏或显示为顶部横幅 */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 to-blue-800 dark:from-slate-900 dark:via-blue-950 dark:to-slate-950 text-white flex-col justify-center px-8 py-12 xl:px-16 relative overflow-hidden dark:border-r dark:border-blue-900/30">
        {/* 夜间模式装饰渐变 */}
        <div className="hidden dark:block absolute inset-0 bg-gradient-to-br from-blue-500/20 via-cyan-500/10 to-transparent pointer-events-none"></div>
        <div className="hidden dark:block absolute bottom-0 right-0 w-96 h-96 bg-blue-500/5 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10">
          <div className="text-2xl xl:text-3xl font-bold mb-4 dark:bg-gradient-to-r dark:from-blue-300 dark:via-cyan-300 dark:to-blue-400 dark:bg-clip-text dark:text-transparent safari-gradient-text">{t('appName', { ns: 'common' })}</div>
          <div className="text-lg xl:text-xl mb-6 tracking-wide dark:text-blue-200/90">{t('platformSubtitle')}</div>
          <ul className="text-sm xl:text-base leading-relaxed pl-5 space-y-3">
            <li className="mb-3">
              <span className="text-cyan-300 dark:text-cyan-300 mr-2">●</span>
              <span className="dark:text-blue-100">{t('featureConvenient')}</span>
              <div className="text-xs text-blue-100 dark:text-blue-300/70 ml-5 mt-1">
                {t('featureConvenientDesc')}
              </div>
            </li>
            <li className="mb-3">
              <span className="text-cyan-300 dark:text-cyan-300 mr-2">●</span>
              <span className="dark:text-blue-100">{t('featurePowerful')}</span>
              <div className="text-xs text-blue-100 dark:text-blue-300/70 ml-5 mt-1">
                {t('featurePowerfulDesc')}
              </div>
            </li>
            <li>
              <span className="text-cyan-300 dark:text-cyan-300 mr-2">●</span>
              <span className="dark:text-blue-100">{t('featureSecure')}</span>
              <div className="text-xs text-blue-100 dark:text-blue-300/70 ml-5 mt-1">
                {t('featureSecureDesc')}
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* 移动端顶部Logo横幅 */}
      <div className="lg:hidden bg-gradient-to-r from-blue-600 to-blue-700 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900 dark:border-b dark:border-blue-900/30 text-white py-5 px-6 text-center relative overflow-hidden">
        <div className="hidden dark:block absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/10 pointer-events-none"></div>
        <div className="relative z-10">
          <div className="text-xl font-bold mb-1 dark:bg-gradient-to-r dark:from-blue-300 dark:to-cyan-300 dark:bg-clip-text dark:text-transparent safari-gradient-text">{t('appName', { ns: 'common' })}</div>
          <div className="text-xs opacity-90 dark:text-blue-200/80">{t('platformSubtitle')}</div>
        </div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white dark:bg-slate-900 px-4 py-8 lg:py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 shadow-lg rounded-xl p-6 sm:p-8 lg:p-10 lg:-mt-12"
        >
          {/* Logo+标题 */}
          <div className="flex items-center justify-center mb-5">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mr-2.5 shadow-blue-500/30">
              <span className="text-white font-bold text-sm">K8S</span>
            </div>
            <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:bg-gradient-to-r dark:from-blue-400 dark:to-cyan-400 dark:bg-clip-text dark:text-transparent safari-gradient-text">
              {t('appName', { ns: 'common' })}
            </div>
            <span className="text-gray-400 text-sm sm:text-base ml-2 font-normal">{t('platformTitle')}</span>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-2 mb-5 mt-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('sso');
                setError('');
                setUsername('');
                setPassword('');
              }}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold border-none rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'sso'
                  ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
              }`}
            >
              {t('ssoLogin')}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('local');
                setError('');
                setUsername('');
                setPassword('');
              }}
              className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold border-none rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'local'
                  ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400'
              }`}
            >
              {t('localLogin')}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-2 px-3 rounded-md text-xs sm:text-sm mb-4 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* 标签内容 */}
          {activeTab === 'sso' ? (
            <div>
              <div className="text-center text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-5">
                {t('ssoDescription')}
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <input
                type="text"
                placeholder={t('enterUsername')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full py-2 px-3 text-xs sm:text-sm mb-3 border border-gray-300 dark:border-slate-600 dark:bg-slate-950 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder={t('enterPassword')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full py-2 px-3 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-950 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                {t('localAccountTip')}
              </div>
            </div>
          )}

          {/* 协议 */}
          <div className="mb-5">
            <label className="text-xs text-gray-700 dark:text-slate-300 flex items-start">
              <input
                type="checkbox"
                checked={agree}
                onChange={e => handleAgreeChange(e.target.checked)}
                className="mr-2 mt-0.5 accent-blue-600"
              />
              <div>
                {t('agreement')}
                <a href="#" className="text-blue-600 dark:text-blue-400 underline ml-1">{t('userAgreement')}</a>
                {agree && (
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {t('agreementSaved')}
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white border-none rounded-lg flex items-center justify-center transition-all ${
              !isLoading
                ? (activeTab === 'sso'
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30 cursor-pointer hover:from-purple-700 hover:to-pink-700'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-500/30 cursor-pointer hover:from-blue-700 hover:to-cyan-700')
                : 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <>
                <span className="mr-2">{t('loggingIn')}</span>
                <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </>
            ) : (
              activeTab === 'sso' ? t('ssoLogin') : t('localLogin')
            )}
          </button>

          {/* 注册提醒 - 仅在统一认证标签显示 */}
          {activeTab === 'sso' && (
            <div className="mt-4 text-center">
              <a
                href="https://newlogin.ihep.ac.cn/admin/register"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400 no-underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <HelpCircle size={14} className="flex-shrink-0" />
                <span>{t('noAccount')}</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{t('registerNow')}</span>
              </a>
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-slate-500 mt-5 sm:mt-6 text-center">
            京ICP备05002790号-1 © 中国科学院高能物理研究所
            <a href="#" className="text-blue-600 dark:text-blue-400 ml-2 hover:underline">联系我们</a>
          </div>
        </form>
      </div>

      {/* Agreement confirmation modal */}
      {showAgreementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 mx-4 w-full max-w-sm">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {t('agreementModalTitle')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-300 mb-5">
              {t('agreementModalBody')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAgreementModal(false);
                  handleAgreeChange(true);
                  doLogin();
                }}
                className={`flex-1 py-2 text-sm font-semibold text-white rounded-lg transition-all ${
                  activeTab === 'sso'
                    ? 'bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'
                }`}
              >
                {t('agreeAndLogin')}
              </button>
              <button
                type="button"
                onClick={() => setShowAgreementModal(false)}
                className="flex-1 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-all"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
