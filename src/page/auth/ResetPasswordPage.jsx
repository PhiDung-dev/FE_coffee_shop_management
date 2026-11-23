import { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
  Check,
  RefreshCw,
} from 'lucide-react';
import passwordResetService from '../../service/passwordResetService';

const OTP_LENGTH = 6;

const parseInitialOtp = (rawToken) => {
  const digits = (rawToken || '').replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
  return Array.from({ length: OTP_LENGTH }, (_, idx) => digits[idx] || '');
};

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [otpDigits, setOtpDigits] = useState(() => parseInitialOtp(searchParams.get('token')));
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otpRefs = useRef([]);
  const navigate = useNavigate();

  const token = otpDigits.join('');
  const isTokenComplete = token.length === OTP_LENGTH;
  const isLengthValid = formData.newPassword.length >= 6;
  const isMatchValid =
    formData.confirmPassword.length > 0 && formData.newPassword === formData.confirmPassword;

  const handleOtpChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (error) setError('');

    if (digit && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    const next = Array.from({ length: OTP_LENGTH }, (_, idx) => pasted[idx] || '');
    setOtpDigits(next);
    if (error) setError('');

    const focusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIndex]?.focus();
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isTokenComplete) {
      setError('Vui lòng nhập đầy đủ mã xác nhận gồm 6 chữ số.');
      const firstEmpty = otpDigits.findIndex((d) => !d);
      otpRefs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
      return;
    }

    if (!isLengthValid) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (!isMatchValid) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await passwordResetService.resetPassword({
        token,
        newPassword: formData.newPassword,
      });

      navigate('/login', {
        replace: true,
        state: {
          message: response?.result || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
        },
      });
    } catch (err) {
      setError(err?.message || 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[78vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-stone-200/90 shadow-lg shadow-stone-200/50 overflow-hidden">
        {/* Dải trang trí phía trên */}
        <div className="h-1.5 bg-gradient-to-r from-amber-600 via-amber-700 to-stone-800" />

        <div className="p-6 sm:p-8">
          {/* Tiêu đề */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 ring-4 ring-amber-100/70 mb-3.5">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Đặt lại mật khẩu</h1>
            <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">
              Nhập mã OTP 6 số đã gửi về email và thiết lập mật khẩu mới
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Bước 1: 6 ô nhập mã OTP */}
            <div className="bg-stone-50/80 border border-stone-200/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                  1. Mã xác nhận (OTP)
                </span>
                <span
                  className={`text-xs font-medium ${
                    isTokenComplete ? 'text-emerald-700' : 'text-stone-400'
                  }`}
                >
                  {token.length}/{OTP_LENGTH} số
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    aria-label={`Chữ số thứ ${index + 1}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onFocus={(e) => e.target.select()}
                    className={`h-12 sm:h-13 w-full text-center text-lg sm:text-xl font-bold font-mono rounded-xl border bg-white transition-all focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent ${
                      digit
                        ? 'border-amber-500 text-amber-900 shadow-2xs'
                        : 'border-stone-300 text-stone-800'
                    }`}
                  />
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                <span>Có thể dán trực tiếp chuỗi 6 số</span>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-1 font-medium text-amber-800 hover:text-amber-900"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Gửi lại mã</span>
                </Link>
              </div>
            </div>

            {/* Bước 2: Mật khẩu mới */}
            <div className="space-y-3.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                2. Mật khẩu mới
              </span>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.newPassword}
                    onChange={handlePasswordChange}
                    placeholder="Nhập ít nhất 6 ký tự"
                    className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-stone-700 mb-1.5"
                >
                  Xác nhận mật khẩu mới
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handlePasswordChange}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Chỉ báo điều kiện mật khẩu trực quan */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 transition-colors ${
                    isLengthValid ? 'text-emerald-700 font-medium' : 'text-stone-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isLengthValid
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  Tối thiểu 6 ký tự
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 transition-colors ${
                    isMatchValid ? 'text-emerald-700 font-medium' : 'text-stone-400'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isMatchValid
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-stone-100 text-stone-400'
                    }`}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  Mật khẩu trùng khớp
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{submitting ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-amber-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại đăng nhập</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;