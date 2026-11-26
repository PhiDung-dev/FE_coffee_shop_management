import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import accountService from '../../service/accountService';
import userService from '../../service/userService';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    dob: '',
    gender: 'MALE',
    avatarUrl: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password) {
      setError('Vui lòng nhập đầy đủ họ tên, email và mật khẩu.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Bước 1: Tạo tài khoản Customer (POST /api/accounts/customer)
      const accountRes = await accountService.createCustomerAccount({
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim() || null,
      });

      const accountId = accountRes?.result?.id;
      if (!accountId) {
        throw new Error('Không nhận được mã tài khoản từ máy chủ.');
      }

      // Bước 2: Tạo thông tin User gắn với accountId vừa tạo (POST /api/users)
      try {
        await userService.createUser({
          fullName: formData.fullName.trim(),
          avatarUrl: formData.avatarUrl.trim() || null,
          dob: formData.dob || null,
          gender: formData.gender || null,
          accountId,
        });
      } catch {
        navigate('/login', {
          replace: true,
          state: {
            message:
              'Tài khoản đã được tạo nhưng chưa lưu được hồ sơ cá nhân. Vui lòng đăng nhập để cập nhật.',
          },
        });
        return;
      }

      navigate('/login', {
        replace: true,
        state: { message: 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.' },
      });
    } catch (err) {
      setError(err?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[82vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Cột trái: Ảnh thật & thông tin gọn gàng */}
        <div className="hidden lg:block lg:col-span-5 relative bg-stone-900">
          <img
            src={HERO_IMAGE}
            alt="CoffeeHouse"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-stone-950/50 flex flex-col justify-between p-9 text-white">
            <div>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                CoffeeHouse
              </span>
            </div>

            <div className="space-y-4">
              <p className="text-2xl font-semibold leading-snug">
                Trở thành thành viên để đặt bàn và nhận ưu đãi mỗi ngày.
              </p>
              <ul className="space-y-2 text-xs text-stone-300 border-t border-white/15 pt-4">
                <li>• Đặt trước chỗ ngồi yêu thích chỉ trong vài giây</li>
                <li>• Lưu voucher giảm giá và theo dõi lịch sử đơn hàng</li>
                <li>• Gợi ý đồ uống theo khẩu vị cá nhân</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Cột phải: Form đăng ký sạch sẽ, phân tầng rõ ràng */}
        <div className="lg:col-span-7 p-7 sm:p-10">
          <div className="max-w-lg mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Tạo tài khoản</h1>
              <p className="text-sm text-stone-500 mt-1">
                Điền thông tin bên dưới để đăng ký khách hàng mới
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Họ và tên */}
              <div>
                <label htmlFor="fullName" className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Họ và tên <span className="text-red-600">*</span>
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                />
              </div>

              {/* Email & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    maxLength={15}
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="0901234567"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
                </div>
              </div>

              {/* Ngày sinh & Giới tính */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="dob" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Ngày sinh
                  </label>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    value={formData.dob}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Giới tính
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 bg-white focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              {/* Ảnh đại diện (tùy chọn) */}
              <div>
                <label htmlFor="avatarUrl" className="block text-xs font-semibold text-stone-700 mb-1.5">
                  URL ảnh đại diện <span className="font-normal text-stone-400">(tùy chọn)</span>
                </label>
                <input
                  id="avatarUrl"
                  name="avatarUrl"
                  type="url"
                  value={formData.avatarUrl}
                  onChange={handleChange}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                />
              </div>

              {/* Mật khẩu & Xác nhận mật khẩu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Mật khẩu <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                    />
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

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Xác nhận mật khẩu <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Nhập lại mật khẩu"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                  />
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
                    <span>Tạo tài khoản</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-stone-500">
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-semibold text-stone-900 hover:text-amber-800 underline underline-offset-4"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;