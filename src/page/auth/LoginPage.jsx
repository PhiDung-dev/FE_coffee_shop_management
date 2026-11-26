import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import useAuth from '../../hook/useAuth';
import { getDefaultRouteByRole } from '../../routes/ProtectedRoute';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const successMessage = location.state?.message || '';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const userData = await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      const fromPath = location.state?.from?.pathname;
      const targetPath = fromPath || getDefaultRouteByRole(userData?.role);
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
        {/* Cột trái: Ảnh quán cà phê thật & thông tin tối giản */}
        <div className="hidden md:block md:col-span-5 relative bg-stone-900">
          <img
            src={HERO_IMAGE}
            alt="Không gian CoffeeHouse"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-stone-950/45 flex flex-col justify-between p-8 text-white">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                CoffeeHouse
              </span>
            </div>

            <div className="space-y-2.5">
              <p className="text-xl font-semibold leading-snug">
                Một ly cà phê ngon bắt đầu ngày làm việc trọn vẹn.
              </p>
              <p className="text-xs text-stone-300 leading-relaxed">
                Đăng nhập để đặt bàn trước, theo dõi đơn hàng và tích lũy ưu đãi thành viên.
              </p>
            </div>
          </div>
        </div>

        {/* Cột phải: Form đăng nhập gọn gàng */}
        <div className="md:col-span-7 p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-7">
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Đăng nhập</h1>
              <p className="text-sm text-stone-500 mt-1">
                Nhập thông tin tài khoản của bạn để tiếp tục
              </p>
            </div>

            {successMessage && (
              <div className="mb-5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 pl-10 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-stone-700">
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="enter your password"
                    className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-stone-900 hover:bg-amber-900 disabled:bg-stone-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-xs text-stone-500">
              Chưa có tài khoản?{' '}
              <Link
                to="/register"
                className="font-semibold text-stone-900 hover:text-amber-800 underline underline-offset-4"
              >
                Tạo tài khoản mới
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;