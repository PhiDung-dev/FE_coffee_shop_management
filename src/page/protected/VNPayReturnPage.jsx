import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Receipt,
  Building2,
  Hash,
  CreditCard,
  ShoppingBag,
  Ban,
} from 'lucide-react';
import paymentService from '../../service/paymentService';

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const VNPayReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasCalledRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(4);
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (hasCalledRef.current) return;
    hasCalledRef.current = true;

    const queryObject = Object.fromEntries(searchParams.entries());
    if (!queryObject.vnp_ResponseCode && !queryObject.vnp_TxnRef) {
      setError('Không tìm thấy thông tin phản hồi giao dịch từ VNPay.');
      setLoading(false);
      return;
    }

    const verifyTransaction = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await paymentService.verifyVnpayReturn(queryObject);
        const data = res?.result ?? res;
        setResult(data);
      } catch (err) {
        setError(err?.message || 'Không thể xác thực kết quả thanh toán với máy chủ.');
      } finally {
        setLoading(false);
      }
    };

    verifyTransaction();
  }, [searchParams]);

  const isSuccess = Boolean(result?.validSignature && result?.success);
  const responseCode = result?.responseCode || searchParams.get('vnp_ResponseCode');
  const isUserCancelled = responseCode === '24';

  // Tự động chuyển sang /my-orders sau 4 giây khi thanh toán thành công
  useEffect(() => {
    if (!isSuccess || !autoRedirect) return;

    if (countdown <= 0) {
      navigate('/my-orders', {
        replace: true,
        state: {
          highlightOrderCode: result?.orderCode,
          message: `Đơn hàng ${result?.orderCode || ''} đã thanh toán thành công qua VNPay.`,
        },
      });
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isSuccess, autoRedirect, countdown, navigate, result?.orderCode]);

  // Tạo bản ghi Payment mới cho cùng orderId để tránh gửi trùng vnp_TxnRef cũ sang VNPay
  const handleRetryPayment = async () => {
    const oldPaymentId = result?.paymentId || searchParams.get('vnp_TxnRef');
    if (!oldPaymentId) {
      navigate('/my-orders', { replace: true });
      return;
    }

    setRetrying(true);
    try {
      const oldPayRes = await paymentService.getPaymentById(oldPaymentId);
      const oldPayment = oldPayRes?.result || oldPayRes;

      if (oldPayment?.orderId) {
        const newPayRes = await paymentService.createPayment({
          orderId: Number(oldPayment.orderId),
          amount: oldPayment.amount,
          paymentGateway: 'VNPAY',
          paymentMethod: 'VNPAY',
        });
        const newPayment = newPayRes?.result || newPayRes;

        const params = new URLSearchParams({
          orderId: String(oldPayment.orderId),
        });
        if (newPayment?.id) {
          params.set('paymentId', String(newPayment.id));
        }

        navigate(`/payment?${params.toString()}`, {
          replace: true,
          state: { payment: newPayment },
        });
        return;
      }
    } catch {
      // Nếu không tạo mới được thì quay về trang Đơn hàng của tôi
    } finally {
      setRetrying(false);
    }

    navigate('/my-orders', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-stone-800">Đang xác thực giao dịch VNPay...</h2>
          <p className="text-sm text-stone-500">
            Vui lòng giữ nguyên trang trong giây lát để hệ thống đối soát thanh toán.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 max-w-lg w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold text-stone-800">Không thể xác minh giao dịch</h1>
            <p className="text-sm text-stone-600">{error}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/my-orders"
              className="flex-1 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors"
            >
              Kiểm tra đơn hàng của tôi
            </Link>
            <Link
              to="/"
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm max-w-xl w-full overflow-hidden">
        <div
          className={`h-2 ${
            isSuccess
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
              : isUserCancelled
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-red-500 to-rose-600'
          }`}
        />

        <div className="p-6 sm:p-8 text-center space-y-5">
          {isSuccess ? (
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-4 ring-emerald-100/70">
              <CheckCircle2 className="w-9 h-9" />
            </div>
          ) : isUserCancelled ? (
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-4 ring-amber-100/70">
              <Ban className="w-9 h-9" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto ring-4 ring-red-100/70">
              <XCircle className="w-9 h-9" />
            </div>
          )}

          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold text-stone-800">
              {isSuccess
                ? 'Thanh toán VNPay thành công!'
                : isUserCancelled
                  ? 'Bạn đã hủy thanh toán'
                  : 'Thanh toán không thành công'}
            </h1>
            <p className="text-sm text-stone-500">
              {isSuccess
                ? result?.message || 'Giao dịch đã được xác nhận. Quán đang chuẩn bị đơn hàng cho bạn.'
                : isUserCancelled
                  ? 'Đơn hàng của bạn vẫn được giữ lại. Bạn có thể bấm thanh toán lại bất cứ lúc nào.'
                  : result?.message || 'Giao dịch gặp lỗi hoặc đã hết thời gian chờ thanh toán.'}
            </p>
          </div>

          {!result?.validSignature && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              Cảnh báo: Chữ ký phản hồi (SecureHash) không hợp lệ.
            </div>
          )}

          {/* Chi tiết giao dịch */}
          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 text-left space-y-3 text-sm">
            {result?.orderCode && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 inline-flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-stone-400" />
                  <span>Mã đơn hàng</span>
                </span>
                <span className="font-mono font-bold text-amber-800">{result.orderCode}</span>
              </div>
            )}

            {result?.paymentId != null && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 inline-flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-stone-400" />
                  <span>Mã giao dịch hệ thống</span>
                </span>
                <span className="font-mono font-semibold text-stone-800">#{result.paymentId}</span>
              </div>
            )}

            {result?.transactionNo && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 inline-flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-stone-400" />
                  <span>Mã giao dịch VNPay</span>
                </span>
                <span className="font-mono font-semibold text-stone-800">
                  {result.transactionNo}
                </span>
              </div>
            )}

            {result?.bankCode && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500 inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-stone-400" />
                  <span>Ngân hàng / Ví</span>
                </span>
                <span className="font-semibold text-stone-800">{result.bankCode}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-stone-500 inline-flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-stone-400" />
                <span>Trạng thái</span>
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isSuccess
                    ? 'bg-emerald-100 text-emerald-800'
                    : isUserCancelled
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {isUserCancelled
                  ? 'Đã hủy giao dịch'
                  : result?.paymentStatus || (isSuccess ? 'SUCCESS' : 'FAILED')}
              </span>
            </div>

            {result?.amount != null && (
              <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                <span className="font-semibold text-stone-700">Số tiền</span>
                <span className="text-lg font-extrabold text-amber-800">
                  {formatPrice(result.amount)}
                </span>
              </div>
            )}
          </div>

          {/* Điều hướng sau khi xử lý */}
          {isSuccess ? (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/my-orders"
                  className="flex-1 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <span>
                    {autoRedirect
                      ? `Theo dõi đơn hàng (${countdown}s)`
                      : 'Theo dõi đơn hàng'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {autoRedirect ? (
                  <button
                    type="button"
                    onClick={() => setAutoRedirect(false)}
                    className="py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Ở lại xem biên lai
                  </button>
                ) : (
                  <Link
                    to="/menu"
                    className="py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors"
                  >
                    Về thực đơn
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetryPayment}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                <span>{retrying ? 'Đang khởi tạo...' : 'Quay lại thanh toán'}</span>
              </button>
              <Link
                to="/my-orders"
                className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                <span>Xem đơn hàng của tôi</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VNPayReturnPage;