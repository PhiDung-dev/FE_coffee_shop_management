import { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  ShoppingBag,
  MapPin,
  Phone,
  User,
  Ticket,
  CheckCircle2,
  Coffee,
} from 'lucide-react';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';
import VNPayReturnPage from './VNPayReturnPage';

const DELIVERY_INFO_STORAGE_KEY = 'cf_last_delivery_info';

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const loadStoredDeliveryInfo = (targetOrderId) => {
  try {
    const raw = localStorage.getItem(DELIVERY_INFO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!targetOrderId || Number(parsed?.orderId) === Number(targetOrderId)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const isPaymentSuccessful = (payment) => {
  const st = (payment?.status || '').toUpperCase();
  return st === 'SUCCESS' || st === 'PAID' || st === 'COMPLETED';
};

const PaymentPage = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Nếu VNPay trả kết quả trực tiếp về /payment?vnp_ResponseCode=... thì hiển thị luôn màn kết quả
  const isVnpayCallback =
    searchParams.has('vnp_ResponseCode') || searchParams.has('vnp_TxnRef');

  const queryOrderId = searchParams.get('orderId');
  const queryPaymentId = searchParams.get('paymentId');

  const [order, setOrder] = useState(location.state?.order || null);
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [deliveryInfo, setDeliveryInfo] = useState(
    () => location.state?.deliveryInfo || loadStoredDeliveryInfo(queryOrderId)
  );

  const [loading, setLoading] = useState(!location.state?.order || !location.state?.payment);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isVnpayCallback) return;

    const loadPaymentContext = async () => {
      if (!queryOrderId && !queryPaymentId && !order && !payment) {
        setError('Thiếu thông tin đơn hàng hoặc giao dịch thanh toán.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        let currentPayment = payment;
        let currentOrder = order;

        // 1. Lấy thông tin giao dịch thanh toán nếu chưa có trong state
        if (!currentPayment && queryPaymentId) {
          const payRes = await paymentService.getPaymentById(queryPaymentId);
          currentPayment = payRes?.result || null;
          setPayment(currentPayment);
        }

        const resolvedOrderId = queryOrderId || currentPayment?.orderId || currentOrder?.id;

        // 2. Lấy chi tiết đơn hàng nếu chưa có
        if (!currentOrder && resolvedOrderId) {
          const orderRes = await orderService.getOrderById(resolvedOrderId);
          currentOrder = orderRes?.result || null;
          setOrder(currentOrder);
        }

        // 3. Nếu chỉ có orderId mà chưa có paymentId -> kiểm tra giao dịch đã hoàn tất hoặc tạo bản ghi mới
        if (!currentPayment && resolvedOrderId) {
          const listRes = await paymentService.getPaymentsByOrderId(resolvedOrderId);
          const payments = Array.isArray(listRes?.result) ? listRes.result : [];
          const paidPayment = payments.find((p) => isPaymentSuccessful(p));

          if (paidPayment) {
            currentPayment = paidPayment;
            setPayment(currentPayment);
          } else if (currentOrder) {
            const createRes = await paymentService.createPayment({
              orderId: currentOrder.id,
              amount: currentOrder.finalAmount,
              paymentGateway: 'VNPAY',
              paymentMethod: 'VNPAY',
            });
            currentPayment = createRes?.result || null;
            setPayment(currentPayment);
          }
        }

        if (!deliveryInfo && resolvedOrderId) {
          setDeliveryInfo(loadStoredDeliveryInfo(resolvedOrderId));
        }
      } catch (err) {
        setError(err?.message || 'Không thể tải thông tin thanh toán.');
      } finally {
        setLoading(false);
      }
    };

    loadPaymentContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVnpayCallback, queryOrderId, queryPaymentId]);

  if (isVnpayCallback) {
    return <VNPayReturnPage />;
  }

  const handleProceedToVnpay = async () => {
    const targetPaymentId = payment?.id || queryPaymentId;
    if (!targetPaymentId) {
      setError('Không xác định được mã giao dịch thanh toán (paymentId).');
      return;
    }

    setRedirecting(true);
    setError('');

    try {
      const res = await paymentService.createVnpayUrl(targetPaymentId);
      const data = res?.result ?? res;
      const paymentUrl = data?.paymentUrl;

      if (!paymentUrl) {
        throw new Error('Máy chủ không trả về đường dẫn thanh toán VNPay.');
      }

      window.location.href = paymentUrl;
    } catch (err) {
      setError(err?.message || 'Không thể khởi tạo liên kết thanh toán VNPay.');
      setRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-stone-200 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-72 bg-white rounded-2xl border border-stone-200" />
          <div className="lg:col-span-5 h-72 bg-white rounded-2xl border border-stone-200" />
        </div>
      </div>
    );
  }

  const isAlreadyPaid = isPaymentSuccessful(payment);
  const payableAmount = payment?.amount ?? order?.finalAmount ?? 0;
  const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <Link
          to="/my-orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-amber-800 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách đơn hàng</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
          Thanh toán trực tuyến qua VNPay
        </h1>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: Thông tin đơn hàng & Địa chỉ nhận */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-800">Thông tin đơn hàng</h2>
                  <p className="text-xs text-stone-500">
                    Mã đơn:{' '}
                    <span className="font-mono font-bold text-amber-800">
                      {order?.orderCode || payment?.orderCode || `#${order?.id || queryOrderId}`}
                    </span>
                  </p>
                </div>
              </div>

              {payment?.id && (
                <span className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 font-mono text-xs font-semibold">
                  GD #{payment.id}
                </span>
              )}
            </div>

            {orderItems.length > 0 && (
              <div className="space-y-2.5">
                {orderItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-stone-100 last:border-b-0 text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                        <Coffee className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 truncate">
                          {item.productName}{' '}
                          <span className="text-stone-500 font-normal">x{item.quantity}</span>
                        </p>
                        {item.selectedOptions && (
                          <p className="text-xs text-stone-500 truncate">{item.selectedOptions}</p>
                        )}
                      </div>
                    </div>

                    <span className="font-semibold text-stone-800 shrink-0">
                      {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 space-y-2 text-sm">
              {order?.subtotal != null && (
                <div className="flex items-center justify-between text-stone-600">
                  <span>Tạm tính</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
              )}

              {Number(order?.discountAmount) > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="inline-flex items-center gap-1">
                    <Ticket className="w-3.5 h-3.5" />
                    <span>
                      Giảm giá{order.appliedVoucherCode ? ` (${order.appliedVoucherCode})` : ''}
                    </span>
                  </span>
                  <span>- {formatPrice(order.discountAmount)}</span>
                </div>
              )}

              <div className="pt-2.5 border-t border-stone-200 flex items-center justify-between">
                <span className="font-bold text-stone-800">Số tiền cần thanh toán</span>
                <span className="text-xl font-extrabold text-amber-800">
                  {formatPrice(payableAmount)}
                </span>
              </div>
            </div>
          </div>

          {deliveryInfo?.deliveryAddress && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-3 text-sm">
              <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-700" />
                <span>Địa chỉ nhận hàng</span>
              </h3>

              <div className="space-y-1.5 text-stone-600">
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-stone-400 shrink-0" />
                  <span className="font-medium text-stone-800">{deliveryInfo.recipientName}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>{deliveryInfo.recipientPhone}</span>
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <span>{deliveryInfo.deliveryAddress}</span>
                </p>
                {deliveryInfo.deliveryNote && (
                  <p className="text-xs text-stone-500 pl-6">
                    Ghi chú: {deliveryInfo.deliveryNote}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cột phải: Thẻ chuyển hướng sang cổng VNPay */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-800">Cổng thanh toán VNPay</h2>
              <p className="text-xs text-stone-500">Hỗ trợ VNPAY-QR, thẻ ATM nội địa & thẻ quốc tế</p>
            </div>
          </div>

          <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 space-y-2 text-xs text-stone-600 leading-relaxed">
            <p className="font-semibold text-stone-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Giao dịch được bảo mật bởi VNPay</span>
            </p>
            <p>
              Sau khi nhấn nút bên dưới, trình duyệt sẽ chuyển sang trang thanh toán chính thức của
              VNPay. Hoàn tất xong, bạn sẽ tự động quay về hệ thống để xem biên lai.
            </p>
          </div>

          {isAlreadyPaid ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Giao dịch này đã được thanh toán hoàn tất.</span>
              </div>
              <Link
                to="/my-orders"
                className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors flex items-center justify-center"
              >
                Xem đơn hàng của tôi
              </Link>
            </div>
          ) : (
            <button
              type="button"
              disabled={redirecting || (!payment?.id && !queryPaymentId)}
              onClick={handleProceedToVnpay}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {redirecting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              <span>
                {redirecting
                  ? 'Đang chuyển sang VNPay...'
                  : `Thanh toán ${formatPrice(payableAmount)} qua VNPay`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;