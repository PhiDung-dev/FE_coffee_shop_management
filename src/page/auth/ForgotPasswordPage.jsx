import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import passwordResetService from '../../service/passwordResetService';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [resetInfo, setResetInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email đã đăng ký.');
      return;
    }

    setSubmitting(true);
    setError('');
    setResetInfo(null);

    try {
      const response = await passwordResetService.forgotPassword({ email: email.trim() });
      setResetInfo({
        message: response?.message || 'Tạo mã token đặt lại mật khẩu thành công.',
        token: response?.result?.token || '',
        expiresAt: response?.result?.expiresAt || '',
      });
    } catch (err) {
      setError(err?.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mb-3">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800">Quên mật khẩu</h1>
          <p className="text-sm text-stone-500 mt-1">
            Nhập email tài khoản để nhận mã xác nhận đặt lại mật khẩu
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resetInfo && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm space-y-2.5">
            <div className="flex items-start gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{resetInfo.message}</span>
            </div>

            {resetInfo.token && (
              <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs break-all">
                <span className="text-stone-500 block mb-1">Mã token của bạn:</span>
                <code className="font-mono font-semibold text-stone-800">{resetInfo.token}</code>
              </div>
            )}

            <Link
              to={
                resetInfo.token
                  ? `/reset-password?token=${encodeURIComponent(resetInfo.token)}`
                  : '/reset-password'
              }
              className="inline-block w-full text-center py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs transition-colors"
            >
              Tiếp tục đặt lại mật khẩu
            </Link>
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
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{submitting ? 'Đang xử lý...' : 'Gửi yêu cầu'}</span>
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