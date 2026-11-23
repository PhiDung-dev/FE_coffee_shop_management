import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  KeyRound,
  Mail,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import passwordResetService from '../../service/passwordResetService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatExpiryTime = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [apiMessage, setApiMessage] = useState('');
  const [resetData, setResetData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email đã đăng ký.');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('Địa chỉ email không đúng định dạng.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await passwordResetService.forgotPassword({
        email: trimmedEmail,
      });

      setSentEmail(trimmedEmail);
      setApiMessage(response?.message || 'Đã gửi mã đặt lại mật khẩu qua email.');
      setResetData(response?.result || null);
      setCooldown(60);
    } catch (err) {
      setError(err?.message || 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const formattedExpiry = formatExpiryTime(resetData?.expiresAt);

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">Quên mật khẩu</h1>
          <p className="text-sm text-stone-500 mt-1">
            Nhập email tài khoản để nhận mã token và liên kết đặt lại mật khẩu
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {sentEmail && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm space-y-2.5">
            <div className="flex items-start gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{apiMessage}</span>
            </div>

            <p className="text-xs text-emerald-800 pl-6 leading-relaxed">
              Mã token đã được gửi tới <strong>{sentEmail}</strong>. Vui lòng kiểm tra hộp thư đến
              (hoặc mục Thư rác/Spam) và nhấn vào liên kết trong email.
            </p>

            <div className="pl-6 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {formattedExpiry
                  ? `Mã có hiệu lực đến ${formattedExpiry}.`
                  : 'Mã xác nhận có hiệu lực trong 15 phút.'}
              </span>
            </div>

            <div className="pl-6 pt-1">
              <Link
                to="/reset-password"
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2"
              >
                <span>Đã sao chép token từ email? Nhập mã ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
              Email đăng ký
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="email@example.com"
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
              />
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || cooldown > 0}
            className="w-full py-2.5 px-4 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : sentEmail ? (
              <RefreshCw className="w-4 h-4" />
            ) : null}
            <span>
              {submitting
                ? 'Đang gửi email...'
                : cooldown > 0
                  ? `Gửi lại sau (${cooldown}s)`
                  : sentEmail
                    ? 'Gửi lại mã đặt lại mật khẩu'
                    : 'Gửi yêu cầu đặt lại mật khẩu'}
            </span>
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-amber-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;