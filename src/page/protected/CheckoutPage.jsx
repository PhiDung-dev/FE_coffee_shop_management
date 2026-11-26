import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  MapPin,
  Phone,
  User,
  Ticket,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  Coffee,
  FileText,
  ArrowRight,
  Tag,
  X,
  Wallet,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';
import accountService from '../../service/accountService';
import userService from '../../service/userService';
import voucherService from '../../service/voucherService';
import userVoucherService from '../../service/userVoucherService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const CART_STORAGE_KEY = 'cf_menu_selection';
const DELIVERY_INFO_STORAGE_KEY = 'cf_last_delivery_info';

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const isPercentDiscount = (discountType) => {
  const normalized = (discountType || '').toUpperCase();
  return normalized === 'PERCENT' || normalized === 'PERCENTAGE';
};

const formatDiscountSummary = (voucher) => {
  const val = Number(voucher.discountValue ?? 0);
  if (isPercentDiscount(voucher.discountType)) {
    const maxVal = Number(voucher.maxDiscountAmount ?? 0);
    return maxVal > 0 ? `Giảm ${val}% (tối đa ${formatPrice(maxVal)})` : `Giảm ${val}%`;
  }
  return `Giảm ${formatPrice(val)}`;
};

const calculateVoucherDiscount = (voucher, subtotal) => {
  if (!voucher) return 0;
  const minOrder = Number(voucher.minOrderValue ?? 0);
  if (subtotal < minOrder) return 0;

  const val = Number(voucher.discountValue ?? 0);
  if (isPercentDiscount(voucher.discountType)) {
    const rawDiscount = (subtotal * val) / 100;
    const maxDiscount = Number(voucher.maxDiscountAmount ?? 0);
    return maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
  }

  return Math.min(val, subtotal);
};

const isVoucherCatalogUsable = (v, now = new Date()) => {
  if (!v) return false;
  if (v.isActive === false) return false;
  if (v.startDate && new Date(v.startDate) > now) return false;
  if (v.endDate && new Date(v.endDate) < now) return false;
  if (
    v.usageLimit != null &&
    v.usedCount != null &&
    Number(v.usedCount) >= Number(v.usageLimit)
  ) {
    return false;
  }
  return true;
};

const loadStoredCart = () => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const SafeImage = ({ src, alt, className }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-800/40">
        <Coffee className="w-6 h-6" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};

const CheckoutPage = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  const [items, setItems] = useState(() => {
    const fromState = location.state?.preselectedItems;
    if (Array.isArray(fromState) && fromState.length > 0) return fromState;
    return loadStoredCart();
  });

  const [deliveryForm, setDeliveryForm] = useState({
    recipientName: user?.fullName || '',
    recipientPhone: '',
    deliveryAddress: '',
    deliveryNote: '',
  });

  const [paymentMethod, setPaymentMethod] = useState('VNPAY');

  // Voucher đã lưu trong ví của user (UserVoucherController -> /api/user-vouchers/account/{accountId})
  const [walletVouchers, setWalletVouchers] = useState([]);
  // Voucher khả dụng từ hệ thống (VoucherController -> /api/vouchers/active) để lưu vào ví
  const [catalogVouchers, setCatalogVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(true);
  const [savingVoucherId, setSavingVoucherId] = useState(null);

  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [searchingCode, setSearchingCode] = useState(false);
  const [voucherFeedback, setVoucherFeedback] = useState({ type: '', message: '' });
  // Chỉ nhận voucher từ walletVouchers (có userVoucherId)
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [confirmedPayment, setConfirmedPayment] = useState(null);

  useEffect(() => {
    if (confirmedOrder) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Bỏ qua lỗi storage
    }
  }, [items, confirmedOrder]);

  const loadVoucherData = useCallback(async () => {
    setLoadingVouchers(true);
    const now = new Date();

    const tasks = [voucherService.getActiveVouchers().catch(() => null)];
    if (accountId) {
      tasks.push(userVoucherService.getUserVouchersByAccountId(accountId).catch(() => null));
    }

    const [activeVoucherRes, userVoucherRes] = await Promise.all(tasks);

    let usableWallet = [];
    if (accountId) {
      const rawUserVouchers = Array.isArray(userVoucherRes?.result) ? userVoucherRes.result : [];
      usableWallet = rawUserVouchers
        .filter((uv) => {
          if (uv.isUsed) return false;
          if (uv.voucherEndDate && new Date(uv.voucherEndDate) < now) return false;
          return true;
        })
        .map((uv) => ({
          voucherId: uv.voucherId,
          userVoucherId: uv.id,
          code: uv.voucherCode,
          title: uv.voucherTitle,
          discountType: uv.discountType,
          discountValue: uv.discountValue,
          maxDiscountAmount: uv.maxDiscountAmount,
          minOrderValue: uv.minOrderValue,
          endDate: uv.voucherEndDate,
        }));
      setWalletVouchers(usableWallet);
    } else {
      setWalletVouchers([]);
    }

    const rawActive = Array.isArray(activeVoucherRes?.result) ? activeVoucherRes.result : [];
    const usableCatalog = rawActive
      .filter((v) => isVoucherCatalogUsable(v, now))
      .map((v) => ({
        voucherId: v.id,
        code: v.code,
        title: v.title,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscountAmount: v.maxDiscountAmount,
        minOrderValue: v.minOrderValue,
        endDate: v.endDate,
      }));

    setCatalogVouchers(usableCatalog);
    setLoadingVouchers(false);
    return usableWallet;
  }, [accountId]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const tasks = [loadVoucherData()];
      if (accountId) {
        tasks.push(accountService.getAccountById(accountId).catch(() => null));
        tasks.push(userService.getAllUsers().catch(() => null));
      }

      const [, accRes, usersRes] = await Promise.all(tasks);

      if (accountId) {
        const acc = accRes?.result;
        const allUsers = Array.isArray(usersRes?.result) ? usersRes.result : [];
        const matchedUser = allUsers.find((u) => Number(u.accountId) === Number(accountId));

        setDeliveryForm((prev) => ({
          ...prev,
          recipientName: prev.recipientName || matchedUser?.fullName || '',
          recipientPhone: prev.recipientPhone || acc?.phone || '',
        }));
      }
    };

    fetchInitialData();
  }, [accountId, loadVoucherData]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.basePrice) || 0) * item.quantity, 0),
    [items]
  );

  // Danh sách voucher khả dụng chưa có trong ví của user (cần lưu trước mới dùng được)
  const unsavedCatalogVouchers = useMemo(() => {
    const walletVoucherIds = new Set(walletVouchers.map((w) => Number(w.voucherId)));
    return catalogVouchers.filter((v) => !walletVoucherIds.has(Number(v.voucherId)));
  }, [walletVouchers, catalogVouchers]);

  const isAppliedVoucherEligible = useMemo(() => {
    if (!appliedVoucher || !appliedVoucher.userVoucherId) return false;
    return subtotal >= Number(appliedVoucher.minOrderValue ?? 0);
  }, [appliedVoucher, subtotal]);

  const estimatedDiscount = useMemo(() => {
    if (!appliedVoucher || !isAppliedVoucherEligible) return 0;
    return calculateVoucherDiscount(appliedVoucher, subtotal);
  }, [appliedVoucher, isAppliedVoucherEligible, subtotal]);

  const estimatedFinalAmount = Math.max(0, subtotal - estimatedDiscount);

  // Lưu voucher -> gọi POST /api/user-vouchers để tạo UserVoucher
  const handleSaveVoucherToWallet = async (catalogVoucher) => {
    if (!accountId) {
      setVoucherFeedback({
        type: 'error',
        message: 'Vui lòng đăng nhập để lưu voucher vào ví.',
      });
      return;
    }

    setSavingVoucherId(catalogVoucher.voucherId);
    setVoucherFeedback({ type: '', message: '' });

    try {
      const res = await userVoucherService.createUserVoucher({
        accountId: Number(accountId),
        voucherId: Number(catalogVoucher.voucherId),
      });
      const createdUv = res?.result;
      const updatedWallet = await loadVoucherData();

      const savedItem =
        updatedWallet.find(
          (w) =>
            Number(w.userVoucherId) === Number(createdUv?.id) ||
            Number(w.voucherId) === Number(catalogVoucher.voucherId)
        ) || null;

      setVoucherFeedback({
        type: 'success',
        message: `Đã lưu mã ${catalogVoucher.code} vào ví. Bạn có thể bấm áp dụng ngay.`,
      });

      return savedItem;
    } catch (err) {
      setVoucherFeedback({
        type: 'error',
        message: err?.message || 'Không thể lưu voucher vào ví.',
      });
      return null;
    } finally {
      setSavingVoucherId(null);
    }
  };

  // Chỉ áp dụng voucher đã có trong ví (user_vouchers)
  const handleApplyWalletVoucher = (walletItem) => {
    if (!walletItem?.userVoucherId) {
      setVoucherFeedback({
        type: 'error',
        message: 'Vui lòng lưu mã vào ví trước khi áp dụng.',
      });
      return;
    }

    const minOrder = Number(walletItem.minOrderValue ?? 0);
    if (subtotal < minOrder) {
      setVoucherFeedback({
        type: 'error',
        message: `Mã ${walletItem.code} yêu cầu đơn tối thiểu ${formatPrice(minOrder)}.`,
      });
      return;
    }

    setAppliedVoucher(walletItem);
    setVoucherCodeInput(walletItem.code || '');
    setVoucherFeedback({
      type: 'success',
      message: `Đã áp dụng mã ${walletItem.code} từ ví (${formatDiscountSummary(walletItem)}).`,
    });
    setIsVoucherModalOpen(false);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherFeedback({ type: '', message: '' });
  };

  // Nhập mã: chỉ áp dụng nếu mã đã nằm trong ví user_vouchers; nếu chưa lưu thì báo cần lưu trước
  const handleApplyCodeSubmit = async (e) => {
    e.preventDefault();
    const rawCode = voucherCodeInput.trim();
    if (!rawCode) {
      setVoucherFeedback({ type: 'error', message: 'Vui lòng nhập mã giảm giá.' });
      return;
    }

    if (!accountId) {
      setVoucherFeedback({
        type: 'error',
        message: 'Vui lòng đăng nhập để sử dụng mã giảm giá trong ví.',
      });
      return;
    }

    const upperCode = rawCode.toUpperCase();
    const inWallet = walletVouchers.find((v) => (v.code || '').toUpperCase() === upperCode);
    if (inWallet) {
      handleApplyWalletVoucher(inWallet);
      return;
    }

    setSearchingCode(true);
    setVoucherFeedback({ type: '', message: '' });

    try {
      const res = await voucherService.getVoucherByCode(rawCode);
      const v = res?.result;
      if (!v?.id) {
        setVoucherFeedback({ type: 'error', message: 'Không tìm thấy mã giảm giá này.' });
        return;
      }

      if (!isVoucherCatalogUsable(v, new Date())) {
        setVoucherFeedback({
          type: 'error',
          message: 'Mã giảm giá đã hết hạn, tạm ngưng hoặc hết lượt sử dụng.',
        });
        return;
      }

      setVoucherFeedback({
        type: 'error',
        message: `Mã ${v.code} chưa có trong ví của bạn. Mở "Chọn từ ví" để lưu mã trước khi áp dụng.`,
      });
    } catch (err) {
      setVoucherFeedback({
        type: 'error',
        message: err?.message || 'Mã giảm giá không hợp lệ hoặc chưa có trong ví của bạn.',
      });
    } finally {
      setSearchingCode(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setDeliveryForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleUpdateQty = (key, delta) => {
    setItems((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleConfirmOrder = async () => {
    if (items.length === 0) {
      setError('Khay chọn món đang trống. Vui lòng chọn ít nhất 1 món từ thực đơn.');
      return;
    }

    if (!deliveryForm.recipientName.trim()) {
      setError('Vui lòng nhập họ tên người nhận.');
      return;
    }

    if (!deliveryForm.recipientPhone.trim()) {
      setError('Vui lòng nhập số điện thoại nhận hàng.');
      return;
    }

    if (!deliveryForm.deliveryAddress.trim()) {
      setError('Vui lòng nhập địa chỉ giao hàng.');
      return;
    }

    if (appliedVoucher && !isAppliedVoucherEligible) {
      setError(
        `Đơn hàng chưa đạt mức tối thiểu ${formatPrice(
          appliedVoucher.minOrderValue
        )} để dùng mã ${appliedVoucher.code}.`
      );
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const validWalletVoucher =
        appliedVoucher && appliedVoucher.userVoucherId && isAppliedVoucherEligible
          ? appliedVoucher
          : null;

      // 1. Tạo đơn hàng mới (POST /api/orders) với voucher đã có trong ví
      const orderPayload = {
        orderType: 'DELIVERY',
        status: 'PENDING',
        customerAccountId: accountId,
        appliedVoucherId: validWalletVoucher ? Number(validWalletVoucher.voucherId) : null,
        items: items.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          selectedOptions: item.note?.trim() || null,
        })),
      };

      const orderRes = await orderService.createOrder(orderPayload);
      const createdOrder = orderRes?.result;

      if (!createdOrder?.id) {
        throw new Error('Không nhận được thông tin đơn hàng từ máy chủ.');
      }

      // 2. Đánh dấu đã sử dụng bản ghi UserVoucher (PUT /api/user-vouchers/{id})
      if (validWalletVoucher?.userVoucherId) {
        const localNowIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 19);

        await userVoucherService
          .updateUserVoucher(validWalletVoucher.userVoucherId, {
            isUsed: true,
            usedAt: localNowIso,
          })
          .catch(() => null);
      }

      // 3. Khởi tạo bản ghi thanh toán (POST /api/payments)
      const finalAmount = createdOrder.finalAmount ?? estimatedFinalAmount;
      const paymentPayload = {
        orderId: createdOrder.id,
        amount: finalAmount,
        paymentGateway: paymentMethod === 'VNPAY' ? 'VNPAY' : 'NONE',
        paymentMethod: paymentMethod === 'VNPAY' ? 'VNPAY' : 'CASH',
      };

      const paymentRes = await paymentService.createPayment(paymentPayload);
      const createdPayment = paymentRes?.result || null;

      const deliverySnapshot = {
        orderId: createdOrder.id,
        orderCode: createdOrder.orderCode,
        ...deliveryForm,
      };
      try {
        localStorage.setItem(DELIVERY_INFO_STORAGE_KEY, JSON.stringify(deliverySnapshot));
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch {
        // Bỏ qua lỗi storage
      }

      // 4. Chuyển sang trang thanh toán VNPay
      if (paymentMethod === 'VNPAY') {
        const params = new URLSearchParams({
          orderId: String(createdOrder.id),
        });
        if (createdPayment?.id) {
          params.set('paymentId', String(createdPayment.id));
        }

        navigate(`/payment?${params.toString()}`, {
          state: {
            order: createdOrder,
            payment: createdPayment,
            deliveryInfo: deliverySnapshot,
          },
        });
        return;
      }

      setConfirmedOrder(createdOrder);
      setConfirmedPayment(createdPayment);
      setItems([]);
    } catch (err) {
      setError(err?.message || 'Đặt món thất bại. Vui lòng kiểm tra lại thông tin và thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-stone-800">Đặt món thành công!</h1>
            <p className="text-sm text-stone-500">
              Đơn hàng của bạn đã được tiếp nhận và đang chờ quán xác nhận pha chế.
            </p>
          </div>

          <div className="bg-stone-50 rounded-2xl border border-stone-200 p-5 text-left space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-stone-500">Mã đơn hàng:</span>
              <span className="font-mono font-bold text-amber-800">
                {confirmedOrder.orderCode || `#${confirmedOrder.id}`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Người nhận:</span>
              <span className="font-semibold text-stone-800">
                {deliveryForm.recipientName} • {deliveryForm.recipientPhone}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <span className="text-stone-500 shrink-0">Địa chỉ giao:</span>
              <span className="font-medium text-stone-800 text-right">
                {deliveryForm.deliveryAddress}
              </span>
            </div>

            {(confirmedOrder.appliedVoucherCode || appliedVoucher?.code) && (
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Mã ưu đãi:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {confirmedOrder.appliedVoucherCode || appliedVoucher?.code} (-
                  {formatPrice(confirmedOrder.discountAmount ?? estimatedDiscount)})
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-stone-500">Thanh toán:</span>
              <span className="font-semibold text-stone-800">
                Tiền mặt khi nhận hàng (COD)
                {confirmedPayment?.id ? ` • GD #${confirmedPayment.id}` : ''}
              </span>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <span className="font-semibold text-stone-700">Tổng thanh toán:</span>
              <span className="text-lg font-extrabold text-amber-800">
                {formatPrice(confirmedOrder.finalAmount ?? estimatedFinalAmount)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/my-orders"
              className="flex-1 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors"
            >
              Xem đơn hàng của tôi
            </Link>
            <Link
              to="/menu"
              className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-semibold transition-colors"
            >
              Tiếp tục xem thực đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto space-y-6 pb-12">
      <div>
        <Link
          to="/menu"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-amber-800 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại thực đơn</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
          Xác nhận đặt món giao tận nơi
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center space-y-3">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
          <h2 className="text-base font-bold text-stone-800">Chưa có món nào trong đơn</h2>
          <p className="text-sm text-stone-500">
            Hãy quay lại thực đơn để chọn đồ uống yêu thích trước khi đặt hàng nhé.
          </p>
          <div className="pt-2">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors"
            >
              <span>Chọn món ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột trái (7 phần): Thông tin giao hàng & Phương thức thanh toán */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-800">Thông tin giao hàng</h2>
                  <p className="text-xs text-stone-500">
                    Nhập chính xác địa chỉ và số điện thoại để shipper liên hệ
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="recipientName"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    Họ tên người nhận <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="recipientName"
                      name="recipientName"
                      type="text"
                      value={deliveryForm.recipientName}
                      onChange={handleFormChange}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    />
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="recipientPhone"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="recipientPhone"
                      name="recipientPhone"
                      type="tel"
                      value={deliveryForm.recipientPhone}
                      onChange={handleFormChange}
                      placeholder="0901234567"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="deliveryAddress"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Địa chỉ nhận hàng <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="deliveryAddress"
                    name="deliveryAddress"
                    type="text"
                    value={deliveryForm.deliveryAddress}
                    onChange={handleFormChange}
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="deliveryNote"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Ghi chú giao hàng (tùy chọn)
                </label>
                <div className="relative">
                  <input
                    id="deliveryNote"
                    name="deliveryNote"
                    type="text"
                    value={deliveryForm.deliveryNote}
                    onChange={handleFormChange}
                    placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi tới..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <FileText className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-stone-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-stone-800">Phương thức thanh toán</h2>
                  <p className="text-xs text-stone-500">
                    Chọn hình thức thanh toán thuận tiện cho đơn hàng của bạn
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('VNPAY')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    paymentMethod === 'VNPAY'
                      ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-600'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'VNPAY'
                        ? 'bg-amber-700 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-800">Thanh toán VNPay</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Quét mã QR / Thẻ ngân hàng nội địa qua cổng VNPay
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                    paymentMethod === 'COD'
                      ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-600'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'COD'
                        ? 'bg-amber-700 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    <Banknote className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-stone-800">Tiền mặt (COD)</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Thanh toán trực tiếp cho nhân viên khi nhận đồ uống
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Cột phải (5 phần): Chi tiết món, Voucher & Nút xác nhận */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-5 lg:sticky lg:top-20">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-800" />
                <h2 className="text-base font-bold text-stone-800">
                  Chi tiết đơn hàng ({items.reduce((s, i) => s + i.quantity, 0)} món)
                </h2>
              </div>

              <Link
                to="/menu"
                className="text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                + Thêm món
              </Link>
            </div>

            <div className="max-h-64 overflow-y-auto pr-1 space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/60 flex items-start gap-3"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-stone-100 shrink-0 border border-stone-200">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-stone-800 truncate">{item.name}</h3>
                      <span className="text-xs font-bold text-amber-800 shrink-0">
                        {formatPrice((Number(item.basePrice) || 0) * item.quantity)}
                      </span>
                    </div>

                    {item.note && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                        Ghi chú: {item.note}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.key, -1)}
                          className="p-1 text-stone-600 hover:text-stone-900 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-stone-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.key, 1)}
                          className="p-1 text-stone-600 hover:text-stone-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.key)}
                        title="Xóa món"
                        className="p-1 text-stone-400 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Khối Voucher: chỉ áp dụng từ ví user_vouchers */}
            <div className="pt-3 border-t border-stone-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-600">
                  <Ticket className="w-3.5 h-3.5 text-amber-700" />
                  <span>Ví voucher của bạn</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(true)}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 cursor-pointer"
                >
                  {loadingVouchers
                    ? 'Đang tải...'
                    : `Ví (${walletVouchers.length}) • Lưu thêm (${unsavedCatalogVouchers.length})`}
                </button>
              </div>

              <form onSubmit={handleApplyCodeSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={voucherCodeInput}
                    onChange={(e) => {
                      setVoucherCodeInput(e.target.value.toUpperCase());
                      if (voucherFeedback.message) setVoucherFeedback({ type: '', message: '' });
                    }}
                    placeholder="Nhập mã đã lưu trong ví..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <button
                  type="submit"
                  disabled={searchingCode}
                  className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:bg-stone-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {searchingCode ? '...' : 'Áp dụng'}
                </button>
              </form>

              {appliedVoucher && (
                <div
                  className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
                    isAppliedVoucherEligible
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-white border border-current/20 font-mono text-xs font-bold">
                        {appliedVoucher.code}
                      </span>
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-900">
                        UserVoucher #{appliedVoucher.userVoucherId}
                      </span>
                    </div>
                    <p className="text-xs font-medium mt-1 truncate">
                      {appliedVoucher.title || formatDiscountSummary(appliedVoucher)}
                    </p>
                    {!isAppliedVoucherEligible && (
                      <p className="text-[11px] text-red-600 font-medium mt-0.5">
                        Cần mua thêm{' '}
                        {formatPrice(Number(appliedVoucher.minOrderValue ?? 0) - subtotal)} để đủ
                        điều kiện áp dụng.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    title="Gỡ mã giảm giá"
                    className="p-1 rounded-lg hover:bg-black/5 text-stone-500 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {voucherFeedback.message && !appliedVoucher && (
                <p
                  className={`text-xs ${
                    voucherFeedback.type === 'error' ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {voucherFeedback.message}
                </p>
              )}
            </div>

            {/* Tổng tiền */}
            <div className="pt-3 border-t border-stone-200 space-y-2 text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>Tạm tính</span>
                <span className="font-semibold text-stone-800">{formatPrice(subtotal)}</span>
              </div>

              {estimatedDiscount > 0 && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Giảm giá ({appliedVoucher?.code})</span>
                  <span className="font-semibold">- {formatPrice(estimatedDiscount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-stone-600">
                <span>Phí giao hàng</span>
                <span className="font-medium text-emerald-700">Miễn phí</span>
              </div>

              <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between">
                <span className="font-bold text-stone-800">Tổng thanh toán</span>
                <span className="text-xl font-extrabold text-amber-800">
                  {formatPrice(estimatedFinalAmount)}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>
                {submitting
                  ? 'Đang tạo đơn hàng...'
                  : paymentMethod === 'VNPAY'
                    ? 'Xác nhận & Chuyển sang thanh toán'
                    : 'Xác nhận đặt món'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal quản lý Ví UserVoucher & Lưu mã mới */}
      {isVoucherModalOpen && (
        <div
          onClick={() => setIsVoucherModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-amber-800" />
                <h3 className="text-base font-bold text-stone-800">Ví voucher & Kho ưu đãi</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* 1. Ví UserVoucher: chỉ những mã đã lưu mới dùng được */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-700" />
                  <span>Đã lưu trong ví ({walletVouchers.length})</span>
                </h4>

                {walletVouchers.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
                    Chưa có voucher nào trong ví. Hãy lưu mã ở danh sách bên dưới trước khi áp
                    dụng.
                  </p>
                ) : (
                  walletVouchers.map((v) => {
                    const minOrder = Number(v.minOrderValue ?? 0);
                    const eligible = subtotal >= minOrder;
                    const isSelected =
                      appliedVoucher &&
                      Number(appliedVoucher.userVoucherId) === Number(v.userVoucherId);

                    return (
                      <div
                        key={`wallet-${v.userVoucherId}`}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-amber-600 bg-amber-50/70'
                            : eligible
                              ? 'border-stone-200 hover:border-amber-400 bg-white'
                              : 'border-stone-200 bg-stone-50 opacity-70'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-bold">
                              {v.code}
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              {formatDiscountSummary(v)}
                            </span>
                          </div>
                          {v.title && (
                            <p className="text-xs font-medium text-stone-800 truncate">{v.title}</p>
                          )}
                          <p className="text-[11px] text-stone-500">
                            Đơn tối thiểu {formatPrice(minOrder)}
                            {v.endDate ? ` • HSD: ${formatDateShort(v.endDate)}` : ''}
                          </p>
                          {!eligible && (
                            <p className="text-[11px] font-medium text-red-600">
                              Mua thêm {formatPrice(minOrder - subtotal)} để áp dụng
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={!eligible}
                          onClick={() => handleApplyWalletVoucher(v)}
                          className="px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          {isSelected ? 'Đang dùng' : 'Áp dụng'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 2. Voucher chưa lưu: gọi POST /api/user-vouchers để lưu vào ví */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>Voucher chưa lưu ({unsavedCatalogVouchers.length})</span>
                </h4>

                {unsavedCatalogVouchers.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3.5">
                    Tất cả voucher khả dụng đã được lưu vào ví của bạn.
                  </p>
                ) : (
                  unsavedCatalogVouchers.map((v) => {
                    const minOrder = Number(v.minOrderValue ?? 0);
                    const isSaving = Number(savingVoucherId) === Number(v.voucherId);

                    return (
                      <div
                        key={`catalog-${v.voucherId}`}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/40 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-800 font-mono text-xs font-bold">
                              {v.code}
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              {formatDiscountSummary(v)}
                            </span>
                          </div>
                          {v.title && (
                            <p className="text-xs font-medium text-stone-800 truncate">{v.title}</p>
                          )}
                          <p className="text-[11px] text-stone-500">
                            Đơn tối thiểu {formatPrice(minOrder)}
                            {v.endDate ? ` • HSD: ${formatDateShort(v.endDate)}` : ''}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isSaving || !accountId}
                          onClick={() => handleSaveVoucherToWallet(v)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:bg-stone-300 text-white text-xs font-semibold shrink-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Đang lưu...' : 'Lưu mã'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;