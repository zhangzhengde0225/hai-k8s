import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../config';
import { useAuthStore } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

type LoginTab = 'sso' | 'local';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const [agree, setAgree] = useState(false);
  const [activeTab, setActiveTab] = useState<LoginTab>('sso');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(t('agreeFirst'));
      return;
    }

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
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 左侧介绍 - 移动端隐藏或显示为顶部横幅 */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 to-blue-800 text-white flex-col justify-center px-8 py-12 xl:px-16">
        <div className="text-3xl xl:text-4xl font-bold mb-5">{t('appName', { ns: 'common' })}</div>
        <div className="text-xl xl:text-2xl mb-8 tracking-wide">{t('platformSubtitle')}</div>
        <ul className="text-base xl:text-lg leading-relaxed pl-5 space-y-3">
          <li className="mb-3">
            <span className="text-cyan-300 mr-2">●</span>
            {t('featureConvenient')}
            <div className="text-sm text-blue-100 ml-5 mt-1">
              {t('featureConvenientDesc')}
            </div>
          </li>
          <li className="mb-3">
            <span className="text-cyan-300 mr-2">●</span>
            {t('featurePowerful')}
            <div className="text-sm text-blue-100 ml-5 mt-1">
              {t('featurePowerfulDesc')}
            </div>
          </li>
          <li>
            <span className="text-cyan-300 mr-2">●</span>
            {t('featureSecure')}
            <div className="text-sm text-blue-100 ml-5 mt-1">
              {t('featureSecureDesc')}
            </div>
          </li>
        </ul>
      </div>

      {/* 移动端顶部Logo横幅 */}
      <div className="lg:hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white py-6 px-6 text-center">
        <div className="text-2xl font-bold mb-1">{t('appName', { ns: 'common' })}</div>
        <div className="text-sm opacity-90">{t('platformSubtitle')}</div>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white dark:bg-gray-800 px-4 py-8 lg:py-12">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 lg:p-10 lg:-mt-12"
        >
          {/* Logo+标题 */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-base">K8S</span>
            </div>
            <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              {t('appName', { ns: 'common' })}
            </div>
            <span className="text-gray-400 text-base sm:text-lg ml-2 font-normal">{t('platformTitle')}</span>
          </div>

          {/* 标签切换 */}
          <div className="flex gap-2 mb-6 mt-5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('sso');
                setError('');
                setUsername('');
                setPassword('');
              }}
              className={`flex-1 py-2.5 px-4 text-sm sm:text-base font-semibold border-none rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'sso'
                  ? 'bg-gradient-to-br from-blue-800 to-blue-500 text-white shadow-lg shadow-blue-800/30'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
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
              className={`flex-1 py-2.5 px-4 text-sm sm:text-base font-semibold border-none rounded-lg cursor-pointer transition-all duration-200 ${
                activeTab === 'local'
                  ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {t('localLogin')}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-2.5 px-3.5 rounded-md text-sm mb-5 border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* 标签内容 */}
          {activeTab === 'sso' ? (
            <div>
              <div className="text-center text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6">
                {t('ssoDescription')}
              </div>
            </div>
          ) : (
            <div className="mb-5">
              <input
                type="text"
                placeholder={t('enterUsername')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full py-2.5 px-3.5 text-sm sm:text-base mb-4 border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="password"
                placeholder={t('enterPassword')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full py-2.5 px-3.5 text-sm sm:text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* 协议 */}
          <div className="mb-6">
            <label className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 flex items-start">
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
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('agreementSaved')}
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={!agree || isLoading}
            className={`w-full py-3 sm:py-3.5 text-base sm:text-lg font-bold text-white border-none rounded-lg flex items-center justify-center transition-all ${
              agree && !isLoading
                ? (activeTab === 'sso'
                    ? 'bg-gradient-to-br from-blue-800 to-blue-500 shadow-lg shadow-blue-800/30 cursor-pointer hover:from-blue-900 hover:to-blue-600'
                    : 'bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-600/30 cursor-pointer hover:from-blue-700 hover:to-cyan-600')
                : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
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
            <div className="mt-5 text-center">
              <a
                href="https://newlogin.ihep.ac.cn/admin/register"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 no-underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <HelpCircle size={16} className="flex-shrink-0" />
                <span>{t('noAccount')}</span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">{t('registerNow')}</span>
              </a>
            </div>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500 mt-6 sm:mt-8 text-center">
            京ICP备05002790号-1 © 中国科学院高能物理研究所
            <a href="#" className="text-blue-600 dark:text-blue-400 ml-2.5 hover:underline">联系我们</a>
          </div>
        </form>
      </div>
    </div>
  );
}
