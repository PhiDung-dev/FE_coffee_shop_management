import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  CreditCard,
  Banknote,
  RefreshCw,
  Search,
  Eye,
  X,
  Coffee,
  Ticket,
  AlertCircle,
  PackageCheck,
  ChefHat,
  ArrowRight,
  UserCheck,
  ClipboardList,
} from 'lucide-react';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';
import tableService from '../../service/tableService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const ORDER_STATUS_META = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: Clock,
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: CheckCircle2,
  },
  PREPARING: {
    label: 'Đang pha chế',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: ChefHat,
  },
  DELIVERING: {
    label: 'Đang giao hàng',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Truck,
  },
  COMPLETED: {
    label: 'Hoàn tất',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: PackageCheck,
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: XCircle,
  },
};

const ORDER_TYPE_META = {
  DELIVERY: { label: 'Giao tận nơi', badgeClass: 'bg-purple-50 text-purple-700' },
  DINE_IN: { label: 'Tại bàn', badgeClass: 'bg-amber-50 text-amber-800' },
  TAKEAWAY: { label: 'Mang về', badgeClass: 'bg-stone-100 text-stone-700' },
};

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'PREPARING', label: 'Đang pha chế' },
  { key: 'DELIVERING', label: 'Đang giao' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const TYPE_FILTERS = [
  { key: 'ALL', label: 'Mọi hình thức' },
  { key: 'DELIVERY', label: 'Giao tận nơi' },
  { key: 'DINE_IN', label: 'Tại bàn' },
  { key: 'TAKEAWAY', label: 'Mang về' },
];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const isPaymentSuccessful = (payment) => {
  const st = (payment?.status || '').toUpperCase();
  return st === 'SUCCESS' || st === 'PAID' || st === 'COMPLETED';
};

// Xác định bước trạng thái tiếp theo của đơn hàng
const getNextStepConfig = (order) => {
  const st = (order.status || 'PENDING').toUpperCase();
  const type = (order.orderType || 'DELIVERY').toUpperCase();

  switch (st) {
    case 'PENDING':
      return {
        nextStatus: 'CONFIRMED',
        label: 'Xác nhận đơn',
        btnClass: 'bg-sky-600 hover:bg-sky-700 text-white',
      };
    case 'CONFIRMED':
      return {
        nextStatus: 'PREPARING',
        label: 'Bắt đầu pha chế',
        btnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      };
    case 'PREPARING':
      if (type === 'DELIVERY') {
        return {
          nextStatus: 'DELIVERING',
          label: 'Giao cho shipper',
          btnClass: 'bg-purple-600 hover:bg-purple-700 text-white',
        };
      }
      return {
        nextStatus: 'COMPLETED',
        label: 'Hoàn tất phục vụ',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      };
    case 'DELIVERING':
      return {
        nextStatus: 'COMPLETED',
        label: 'Xác nhận đã giao',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      };
    default:
      return null;
  }
};

const StaffOrdersPage = () => {
  const { user, token } = useAuth();
  const claims = token ? parseJwt(token) : null;
  const staffAccountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  const [orders, setOrders] = useState([]);
  const [paymentsByOrder, setPaymentsByOrder] = useState({});

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');

  // Tách loading lần đầu và refreshing để không bao giờ unmount danh sách khi bấm làm mới/cập nhật
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOrderId, setProcessingOrderId] = useState(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modal chi tiết đơn hàng
  const [selectedOrder, setSelectedOrder] = useState(null);

  const highlightTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((type, message) => {
    setFeedback({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 3500);
  }, []);

  const flashOrderCard = useCallback((orderId) => {
    setHighlightedOrderId(orderId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedOrderId(null);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const fetchAllOrders = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const res = await orderService.getAllOrders({
          page: 0,
          size: 100,
          sortBy: 'createdAt',
          sortDir: 'desc',
        });

        const rawResult = res?.result;
        const list = Array.isArray(rawResult?.content)
          ? rawResult.content
          : Array.isArray(rawResult)
            ? rawResult
            : [];

        setOrders(list);

        // Lấy trạng thái thanh toán của từng đơn
        const paymentEntries = await Promise.all(
          list.map(async (ord) => {
            try {
              const pRes = await paymentService.getPaymentsByOrderId(ord.id);
              const pList = Array.isArray(pRes?.result) ? pRes.result : [];
              const chosen = pList.find((p) => isPaymentSuccessful(p)) || pList[0] || null;
              return [ord.id, chosen];
            } catch {
              return [ord.id, null];
            }
          })
        );

        setPaymentsByOrder(Object.fromEntries(paymentEntries));
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách đơn hàng.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchAllOrders({ isInitial: true });
  }, [fetchAllOrders]);

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: orders.length,
      PENDING: 0,
      CONFIRMED: 0,
      PREPARING: 0,
      DELIVERING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach((o) => {
      const key = (o.status || 'PENDING').toUpperCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const st = (ord.status || 'PENDING').toUpperCase();
      const type = (ord.orderType || 'DELIVERY').toUpperCase();

      const matchStatus = statusFilter === 'ALL' || st === statusFilter;
      const matchType = typeFilter === 'ALL' || type === typeFilter;

      const q = keyword.trim().toLowerCase();
      const matchKeyword =
        !q ||
        (ord.orderCode || '').toLowerCase().includes(q) ||
        String(ord.id).includes(q) ||
        (ord.tableNumber || '').toLowerCase().includes(q) ||
        (Array.isArray(ord.orderItems) &&
          ord.orderItems.some((item) => (item.productName || '').toLowerCase().includes(q)));

      return matchStatus && matchType && matchKeyword;
    });
  }, [orders, statusFilter, typeFilter, keyword]);

  // Cập nhật trạng thái đơn hàng tại chỗ (không reload/unmount DOM -> giữ nguyên vị trí cuộn)
  const handleAdvanceStatus = async (order, nextStatus) => {
    setProcessingOrderId(order.id);

    try {
      const res = await orderService.updateOrder(order.id, {
        orderType: order.orderType || 'DELIVERY',
        status: nextStatus,
        tableId: order.tableId || null,
        customerAccountId: order.customerAccountId || null,
        staffAccountId: staffAccountId ? Number(staffAccountId) : order.staffAccountId || null,
        appliedVoucherId: order.appliedVoucherId || null,
      });

      const updatedFromServer = res?.result || {};

      // Nếu đơn tại bàn hoàn tất hoặc hủy -> giải phóng bàn về AVAILABLE
      if (
        order.orderType === 'DINE_IN' &&
        order.tableId &&
        (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED')
      ) {
        await tableService.updateTableStatus(Number(order.tableId), 'AVAILABLE').catch(() => null);
      }

      // Cập nhật trực tiếp đơn hàng trong mảng state hiện tại
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, ...updatedFromServer, status: nextStatus } : o
        )
      );

      if (selectedOrder?.id === order.id) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, ...updatedFromServer, status: nextStatus } : null
        );
      }

      flashOrderCard(order.id);
      showToast(
        'success',
        `Đơn ${order.orderCode || `#${order.id}`} → ${
          ORDER_STATUS_META[nextStatus]?.label || nextStatus
        }`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái đơn hàng.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  // Xác nhận thu tiền mặt tại quầy / shipper thu COD tại chỗ
  const handleConfirmCashPayment = async (order) => {
    setProcessingOrderId(order.id);

    try {
      const existingPayment = paymentsByOrder[order.id];
      let targetPaymentId = existingPayment?.id;
      let latestPaymentObj = existingPayment;

      // Nếu chưa có bản ghi payment hoặc payment cũ là VNPAY chưa trả -> tạo bản ghi CASH mới
      if (!targetPaymentId || existingPayment?.paymentGateway === 'VNPAY') {
        const createRes = await paymentService.createPayment({
          orderId: Number(order.id),
          amount: order.finalAmount ?? order.subtotal ?? 0,
          paymentGateway: 'NONE',
          paymentMethod: 'CASH',
        });
        latestPaymentObj = createRes?.result || null;
        targetPaymentId = latestPaymentObj?.id;
      }

      if (targetPaymentId) {
        const updatePayRes = await paymentService.updatePayment(targetPaymentId, {
          status: 'SUCCESS',
          paymentMethod: 'CASH',
          paymentGateway: 'NONE',
        });
        latestPaymentObj = updatePayRes?.result || {
          ...(latestPaymentObj || {}),
          id: targetPaymentId,
          orderId: order.id,
          status: 'SUCCESS',
          paymentMethod: 'CASH',
          paymentGateway: 'NONE',
        };
      }

      setPaymentsByOrder((prev) => ({
        ...prev,
        [order.id]: latestPaymentObj,
      }));

      // Nếu đơn đang PENDING thì tự động chuyển sang CONFIRMED luôn
      if ((order.status || '').toUpperCase() === 'PENDING') {
        const orderRes = await orderService.updateOrder(order.id, {
          orderType: order.orderType || 'DELIVERY',
          status: 'CONFIRMED',
          tableId: order.tableId || null,
          customerAccountId: order.customerAccountId || null,
          staffAccountId: staffAccountId ? Number(staffAccountId) : order.staffAccountId || null,
          appliedVoucherId: order.appliedVoucherId || null,
        });
        const updatedFromServer = orderRes?.result || {};

        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id ? { ...o, ...updatedFromServer, status: 'CONFIRMED' } : o
          )
        );
      }

      flashOrderCard(order.id);
      showToast(
        'success',
        `Đã xác nhận thu tiền cho đơn ${order.orderCode || `#${order.id}`}.`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể xác nhận thanh toán cho đơn này.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header nổi bật đồng bộ màu sắc với các trang khác */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 shadow-md border border-stone-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/25 px-3 py-1 rounded-full">
            <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
            <span>Điều phối bếp & Giao vận CoffeeHouse</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản lý & Điều phối đơn hàng
          </h1>
          <p className="text-sm text-stone-300 max-w-2xl">
            Tiếp nhận đơn đặt online, cập nhật tiến độ pha chế, giao hàng và xác nhận thu tiền
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 self-start lg:self-center">
          <div className="px-4 py-2 rounded-2xl bg-stone-900/85 border border-stone-700/80 text-xs">
            <span className="text-stone-400 block">Chờ xác nhận</span>
            <span className="text-sm font-extrabold text-amber-300">
              {statusCounts.PENDING} / {statusCounts.ALL} đơn
            </span>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchAllOrders({ isInitial: false })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Đang tải...' : 'Làm mới danh sách'}</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc trạng thái, loại đơn & tìm kiếm */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        {/* Tabs trạng thái */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-amber-700 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] ${
                  statusFilter === tab.key
                    ? 'bg-amber-800 text-amber-100'
                    : 'bg-white text-stone-600'
                }`}
              >
                {statusCounts[tab.key] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Lọc hình thức phục vụ + Ô tìm kiếm */}
        <div className="pt-3 border-t border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_FILTERS.map((tf) => (
              <button
                key={tf.key}
                type="button"
                onClick={() => setTypeFilter(tf.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === tf.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm mã đơn, số bàn, tên món..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Danh sách đơn hàng */}
      {initialLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center space-y-2">
          <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
          <p className="text-base font-bold text-stone-800">Không có đơn hàng nào phù hợp</p>
          <p className="text-sm text-stone-500">
            Thử đổi bộ lọc trạng thái hoặc bấm Làm mới danh sách.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const st = (order.status || 'PENDING').toUpperCase();
            const type = (order.orderType || 'DELIVERY').toUpperCase();
            const statusMeta = ORDER_STATUS_META[st] || ORDER_STATUS_META.PENDING;
            const typeMeta = ORDER_TYPE_META[type] || ORDER_TYPE_META.DELIVERY;
            const StatusIcon = statusMeta.icon;

            const payment = paymentsByOrder[order.id];
            const isPaid = isPaymentSuccessful(payment);
            const isVnpay =
              payment?.paymentGateway === 'VNPAY' || payment?.paymentMethod === 'VNPAY';

            const nextStep = getNextStepConfig(order);
            const canCancel = st === 'PENDING' || st === 'CONFIRMED';
            const canCollectCash = !isPaid && st !== 'CANCELLED';
            const isBusy = processingOrderId === order.id;
            const isHighlighted = highlightedOrderId === order.id;

            const items = Array.isArray(order.orderItems) ? order.orderItems : [];

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border shadow-2xs overflow-hidden transition-all duration-300 ${
                  isHighlighted
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/10'
                    : 'border-stone-200'
                }`}
              >
                {/* Dòng thông tin đầu thẻ */}
                <div className="px-5 py-3.5 border-b border-stone-100 bg-stone-50/60 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-sm font-extrabold text-amber-800">
                      {order.orderCode || `#${order.id}`}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${typeMeta.badgeClass}`}
                    >
                      {typeMeta.label}
                      {order.tableNumber ? ` • ${order.tableNumber}` : ''}
                    </span>

                    <span className="text-xs text-stone-500">{formatDateTime(order.createdAt)}</span>

                    {order.customerAccountId && (
                      <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                        <UserCheck className="w-3.5 h-3.5 text-stone-400" />
                        <span>KH #{order.customerAccountId}</span>
                      </span>
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${statusMeta.badgeClass}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusMeta.label}</span>
                  </span>
                </div>

                {/* Danh sách món */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 flex items-center justify-between gap-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                          <Coffee className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-stone-800 truncate">
                            {item.productName}{' '}
                            <span className="text-amber-800 font-extrabold">x{item.quantity}</span>
                          </p>
                          {item.selectedOptions && (
                            <p className="text-xs text-stone-500 truncate">
                              Ghi chú: {item.selectedOptions}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className="font-semibold text-stone-700 shrink-0">
                        {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Thanh tác vụ & thanh toán */}
                <div className="px-5 py-4 border-t border-stone-100 bg-stone-50/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {isVnpay ? (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {isPaid ? 'Đã thanh toán VNPay' : 'Chờ khách thanh toán VNPay'}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-stone-100 text-stone-700 border border-stone-200'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>{isPaid ? 'Đã thu tiền mặt' : 'Chưa thu tiền (COD / Tại quầy)'}</span>
                      </span>
                    )}

                    {order.appliedVoucherCode && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-semibold">
                        <Ticket className="w-3 h-3" />
                        <span>{order.appliedVoucherCode}</span>
                      </span>
                    )}

                    <span className="text-sm font-extrabold text-amber-800 ml-1">
                      Tổng: {formatPrice(order.finalAmount ?? order.subtotal)}
                    </span>
                  </div>

                  {/* Các nút thao tác nghiệp vụ */}
                  <div className="flex flex-wrap items-center gap-2">
                    {canCollectCash && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleConfirmCashPayment(order)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Xác nhận thu tiền</span>
                      </button>
                    )}

                    {nextStep && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAdvanceStatus(order, nextStep.nextStatus)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-colors cursor-pointer ${nextStep.btnClass}`}
                      >
                        <span>{isBusy ? 'Đang cập nhật...' : nextStep.label}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAdvanceStatus(order, 'CANCELLED')}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Hủy đơn
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Chi tiết</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast thông báo nổi cố định góc dưới phải (không làm giật/nhảy thanh cuộn) */}
      {feedback.message && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-2xl border shadow-lg text-sm flex items-center gap-2.5 transition-all ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="font-medium leading-snug">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback({ type: '', message: '' })}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal chi tiết đơn hàng */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">
                  Chi tiết đơn {selectedOrder.orderCode || `#${selectedOrder.id}`}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Tạo lúc {formatDateTime(selectedOrder.createdAt)} •{' '}
                  {ORDER_TYPE_META[selectedOrder.orderType]?.label || selectedOrder.orderType}
                  {selectedOrder.tableNumber ? ` (${selectedOrder.tableNumber})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div className="space-y-2.5">
                {(selectedOrder.orderItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-stone-800">
                        {item.productName} <span className="text-stone-500">x{item.quantity}</span>
                      </p>
                      {item.selectedOptions && (
                        <p className="text-xs text-stone-500 mt-0.5">{item.selectedOptions}</p>
                      )}
                    </div>
                    <span className="font-semibold text-stone-800 shrink-0">
                      {formatPrice(item.subtotal ?? Number(item.unitPrice) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Tạm tính</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.discountAmount) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá ({selectedOrder.appliedVoucherCode})</span>
                    <span>- {formatPrice(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-stone-100 flex justify-between font-bold text-base">
                  <span className="text-stone-800">Tổng thanh toán</span>
                  <span className="text-amber-800">
                    {formatPrice(selectedOrder.finalAmount ?? selectedOrder.subtotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffOrdersPage;