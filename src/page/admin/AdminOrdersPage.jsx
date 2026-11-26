import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Calendar,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileSpreadsheet,
  ShieldAlert,
  UserCog,
  UtensilsCrossed,
  CreditCard,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Ban,
} from 'lucide-react';
import orderService from '../../service/orderService';
import paymentService from '../../service/paymentService';
import accountService from '../../service/accountService';
import userService from '../../service/userService';

const ORDER_STATUS_META = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  PREPARING: {
    label: 'Đang pha chế',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  DELIVERING: {
    label: 'Đang giao',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

const ORDER_TYPE_LABEL = {
  DINE_IN: 'Tại bàn',
  TAKEAWAY: 'Mang đi',
  DELIVERY: 'Giao hàng',
};

const STATUS_FLOW_OPTIONS = [
  { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PREPARING', label: 'Đang pha chế' },
  { value: 'DELIVERING', label: 'Đang giao' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

const PAGE_SIZE = 12;

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

const toInputDateString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isPaymentSuccessful = (payment) => {
  const st = (payment?.status || '').toUpperCase();
  return st === 'SUCCESS' || st === 'PAID' || st === 'COMPLETED';
};

const AdminOrdersPage = () => {
  // Dữ liệu từ API
  const [orders, setOrders] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);

  // Bộ lọc tìm kiếm & phân trang client-side mượt mà trên tập dữ liệu toàn quán
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Trạng thái tải, xuất Excel & thông báo
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Modal chi tiết & điều chỉnh trạng thái đơn hàng
  const [detailModal, setDetailModal] = useState({
    open: false,
    order: null,
    payments: [],
    loading: false,
  });
  const [nextStatus, setNextStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast({ type: '', message: '' });
    }, 3600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Tải danh sách đơn hàng toàn quán + tài khoản nhân sự/khách hàng
  const fetchOrdersData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [ordersRes, accountsRes, usersRes] = await Promise.all([
          orderService.getAllOrders({
            page: 0,
            size: 1000,
            sortBy: 'createdAt',
            sortDir: 'desc',
          }),
          accountService.getAllAccounts().catch(() => ({ result: [] })),
          userService.getAllUsers().catch(() => ({ result: [] })),
        ]);

        const rawResult = ordersRes?.result;
        const parsedOrders = Array.isArray(rawResult?.content)
          ? rawResult.content
          : Array.isArray(rawResult)
            ? rawResult
            : [];

        setOrders(parsedOrders);
        setAccounts(Array.isArray(accountsRes?.result) ? accountsRes.result : []);
        setUsers(Array.isArray(usersRes?.result) ? usersRes.result : []);
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
    fetchOrdersData({ isInitial: true });
  }, [fetchOrdersData]);

  // Ánh xạ tra cứu nhân viên & khách hàng
  const accountLookup = useMemo(() => {
    const profileByAccId = {};
    users.forEach((u) => {
      if (u.accountId != null) {
        profileByAccId[Number(u.accountId)] = u;
      }
    });

    const byId = {};
    const byEmail = {};
    accounts.forEach((acc) => {
      const enriched = {
        ...acc,
        profile: profileByAccId[Number(acc.id)] || null,
      };
      byId[Number(acc.id)] = enriched;
      if (acc.email) {
        byEmail[acc.email.trim().toLowerCase()] = enriched;
      }
    });

    return { byId, byEmail };
  }, [accounts, users]);

  const resolveStaffName = useCallback(
    (ord) => {
      const rawStaffId =
        ord.staffAccountId ??
        ord.staffId ??
        ord.processedByAccountId ??
        ord.createdByAccountId ??
        ord.staff?.id ??
        ord.staff?.accountId;
      const rawStaffEmail = (
        ord.staffEmail ??
        ord.createdBy ??
        ord.staff?.email ??
        ''
      )
        .trim()
        .toLowerCase();

      if (rawStaffId != null && accountLookup.byId[Number(rawStaffId)]) {
        const acc = accountLookup.byId[Number(rawStaffId)];
        return acc.profile?.fullName || acc.email;
      }
      if (rawStaffEmail && accountLookup.byEmail[rawStaffEmail]) {
        const acc = accountLookup.byEmail[rawStaffEmail];
        return acc.profile?.fullName || acc.email;
      }
      if (rawStaffEmail) return rawStaffEmail;
      if (rawStaffId != null) return `Staff #${rawStaffId}`;
      return 'Khách tự đặt';
    },
    [accountLookup]
  );

  const resolveCustomerName = useCallback(
    (ord) => {
      if (ord.customerName) return ord.customerName;
      const custId = ord.customerAccountId ?? ord.customerId;
      if (custId != null && accountLookup.byId[Number(custId)]) {
        const acc = accountLookup.byId[Number(custId)];
        return acc.profile?.fullName || acc.email;
      }
      return 'Khách vãng lai';
    },
    [accountLookup]
  );

  // Lọc danh sách đơn hàng theo các tiêu chí
  const filteredOrders = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const startMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const endMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;

    return orders.filter((ord) => {
      const st = (ord.status || 'PENDING').toUpperCase();
      const type = (ord.orderType || 'DINE_IN').toUpperCase();

      if (statusFilter !== 'ALL' && st !== statusFilter) return false;
      if (typeFilter !== 'ALL' && type !== typeFilter) return false;

      if (startMs || endMs) {
        if (!ord.createdAt) return false;
        const createdMs = new Date(ord.createdAt).getTime();
        if (isNaN(createdMs)) return false;
        if (startMs && createdMs < startMs) return false;
        if (endMs && createdMs > endMs) return false;
      }

      if (q) {
        const staffName = resolveStaffName(ord).toLowerCase();
        const customerName = resolveCustomerName(ord).toLowerCase();
        const itemsText = Array.isArray(ord.orderItems)
          ? ord.orderItems.map((it) => it.productName || '').join(' ').toLowerCase()
          : '';

        const match =
          (ord.orderCode || '').toLowerCase().includes(q) ||
          String(ord.id).includes(q) ||
          (ord.tableNumber || '').toLowerCase().includes(q) ||
          staffName.includes(q) ||
          customerName.includes(q) ||
          itemsText.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [
    orders,
    statusFilter,
    typeFilter,
    fromDate,
    toDate,
    keyword,
    resolveStaffName,
    resolveCustomerName,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, fromDate, toDate, keyword]);

  // Tổng hợp KPI trên tập đơn đã lọc
  const filteredSummary = useMemo(() => {
    let completedCount = 0;
    let processingCount = 0;
    let cancelledCount = 0;
    let completedRevenue = 0;

    filteredOrders.forEach((o) => {
      const st = (o.status || '').toUpperCase();
      if (st === 'COMPLETED') {
        completedCount += 1;
        completedRevenue += Number(o.finalAmount ?? o.subtotal ?? 0);
      } else if (st === 'CANCELLED') {
        cancelledCount += 1;
      } else {
        processingCount += 1;
      }
    });

    return {
      total: filteredOrders.length,
      completedCount,
      processingCount,
      cancelledCount,
      completedRevenue,
    };
  }, [filteredOrders]);

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredOrders, currentPage]);

  // Mở modal xem chi tiết & đối soát giao dịch của 1 đơn hàng
  const handleOpenOrderDetail = async (ord) => {
    const currentStatus = (ord.status || 'PENDING').toUpperCase();
    setNextStatus(currentStatus);
    setCancelReason(ord.cancelReason || '');
    setDetailModal({
      open: true,
      order: ord,
      payments: [],
      loading: true,
    });

    try {
      const [detailRes, payRes] = await Promise.all([
        orderService.getOrderById(ord.id).catch(() => null),
        paymentService.getPaymentsByOrderId(ord.id).catch(() => null),
      ]);

      const fullOrder = detailRes?.result || ord;
      const payList = Array.isArray(payRes?.result) ? payRes.result : [];

      setDetailModal({
        open: true,
        order: fullOrder,
        payments: payList,
        loading: false,
      });
    } catch {
      setDetailModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Admin cập nhật trạng thái đơn hàng (hỗ trợ cả updateOrderStatus hoặc updateOrder tùy service)
  const handleAdminUpdateOrderStatus = async () => {
    const targetOrder = detailModal.order;
    if (!targetOrder || !nextStatus) return;

    if (nextStatus === 'CANCELLED' && !cancelReason.trim()) {
      showToast('error', 'Vui lòng nhập lý do hủy đơn hàng để lưu vết đối soát.');
      return;
    }

    setUpdatingStatus(true);
    try {
      if (
        nextStatus === 'CANCELLED' &&
        typeof orderService.cancelOrder === 'function'
      ) {
        await orderService.cancelOrder(targetOrder.id, cancelReason.trim());
      } else if (typeof orderService.updateOrderStatus === 'function') {
        await orderService.updateOrderStatus(targetOrder.id, nextStatus, {
          cancelReason: nextStatus === 'CANCELLED' ? cancelReason.trim() : undefined,
        });
      } else if (typeof orderService.updateOrder === 'function') {
        await orderService.updateOrder(targetOrder.id, {
          status: nextStatus,
          cancelReason: nextStatus === 'CANCELLED' ? cancelReason.trim() : undefined,
        });
      }

      await fetchOrdersData({ isInitial: false });
      setDetailModal((prev) => ({
        ...prev,
        order: prev.order
          ? {
              ...prev.order,
              status: nextStatus,
              cancelReason: nextStatus === 'CANCELLED' ? cancelReason.trim() : prev.order.cancelReason,
            }
          : null,
      }));
      showToast(
        'success',
        `Đã cập nhật đơn ${targetOrder.orderCode || `#${targetOrder.id}`} sang trạng thái "${
          ORDER_STATUS_META[nextStatus]?.label || nextStatus
        }".`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái đơn hàng.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Xuất sổ đơn hàng toàn quán ra Excel (.xls UTF-8)
  const handleExportOrdersExcel = () => {
    if (filteredOrders.length === 0) {
      showToast('error', 'Không có đơn hàng nào trong danh sách lọc để xuất Excel.');
      return;
    }

    setExporting(true);
    try {
      const exportedAt = formatDateTime(new Date().toISOString());
      const rowsHtml = filteredOrders
        .map((ord, idx) => {
          const stKey = (ord.status || 'PENDING').toUpperCase();
          const stLabel = ORDER_STATUS_META[stKey]?.label || stKey;
          const typeKey = (ord.orderType || 'DINE_IN').toUpperCase();
          const channelLabel = ord.tableNumber
            ? `Tại bàn (${ord.tableNumber})`
            : ORDER_TYPE_LABEL[typeKey] || typeKey;

          const items = Array.isArray(ord.orderItems) ? ord.orderItems : [];
          const itemsSummary =
            items.length > 0
              ? items.map((it) => `${it.productName} (x${it.quantity})`).join('; ')
              : '—';

          const subtotal = Number(ord.subtotal ?? ord.finalAmount ?? 0);
          const discount = Number(ord.discountAmount ?? 0);
          const finalAmount = Number(ord.finalAmount ?? subtotal);

          return `
            <tr>
              <td style="text-align:center;">${idx + 1}</td>
              <td>${escapeHtml(ord.orderCode || `#${ord.id}`)}</td>
              <td>${escapeHtml(formatDateTime(ord.createdAt))}</td>
              <td>${escapeHtml(resolveStaffName(ord))}</td>
              <td>${escapeHtml(resolveCustomerName(ord))}</td>
              <td>${escapeHtml(channelLabel)}</td>
              <td>${escapeHtml(itemsSummary)}</td>
              <td style="text-align:right;">${subtotal}</td>
              <td style="text-align:right;">${discount}</td>
              <td style="text-align:right;font-weight:bold;">${finalAmount}</td>
              <td>${escapeHtml(stLabel)}</td>
            </tr>
          `;
        })
        .join('');

      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8" />
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; color: #1c1917; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
            th, td { border: 1px solid #d6d3d1; padding: 6px 10px; vertical-align: middle; }
            th { background-color: #78350f; color: #ffffff; font-weight: bold; text-align: left; }
            .title { font-size: 16px; font-weight: bold; color: #78350f; border: none; padding: 4px 0; }
            .meta { border: none; padding: 2px 0; color: #44403c; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="11" class="title">DANH SÁCH ĐƠN HÀNG TOÀN CỬA HÀNG - CF SHOP (ADMIN)</td></tr>
            <tr><td colspan="11" class="meta"><strong>Thời điểm xuất:</strong> ${escapeHtml(
              exportedAt
            )} &nbsp;|&nbsp; <strong>Tổng đơn xuất:</strong> ${
        filteredOrders.length
      } &nbsp;|&nbsp; <strong>Doanh thu đơn hoàn thành:</strong> ${
        filteredSummary.completedRevenue
      } VNĐ</td></tr>
          </table>
          <table>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Mã đơn</th>
              <th>Thời gian tạo</th>
              <th>Nhân viên phụ trách</th>
              <th>Khách hàng</th>
              <th>Hình thức / Bàn</th>
              <th>Chi tiết món</th>
              <th style="text-align:right;">Tạm tính (VNĐ)</th>
              <th style="text-align:right;">Giảm giá (VNĐ)</th>
              <th style="text-align:right;">Thực thu (VNĐ)</th>
              <th>Trạng thái</th>
            </tr>
            ${rowsHtml}
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF', htmlContent], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DanhSachDonHang_CFShop_${toInputDateString(new Date())}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        'success',
        `Đã xuất file Excel danh sách đơn hàng (${filteredOrders.length} đơn).`
      );
    } catch {
      showToast('error', 'Không thể xuất file Excel, vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Admin */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-7 shadow-sm">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Quản trị viên • Giám sát & Đối soát đơn hàng toàn quán</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Quản lý Đơn hàng Toàn hệ thống
            </h1>
            <p className="text-sm text-stone-300 max-w-2xl">
              Theo dõi toàn bộ đơn tại bàn, mang đi và giao hàng; kiểm tra nhân viên phụ
              trách, đối soát thanh toán và xử lý trạng thái đơn hàng.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            <button
              type="button"
              disabled={initialLoading || exporting || filteredOrders.length === 0}
              onClick={handleExportOrdersExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-400 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchOrdersData({ isInitial: false })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Thẻ tóm tắt nhanh theo bộ lọc */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Tổng đơn (bộ lọc)
          </span>
          <p className="text-2xl font-extrabold text-stone-800 mt-1">
            {filteredSummary.total}{' '}
            <span className="text-xs font-semibold text-stone-400">
              ({filteredSummary.processingCount} đang mở)
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Đơn hoàn thành
          </span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">
            {filteredSummary.completedCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Đơn đã hủy
          </span>
          <p className="text-2xl font-extrabold text-rose-600 mt-1">
            {filteredSummary.cancelledCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
            Doanh thu hoàn thành
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-800 mt-1">
            {formatPrice(filteredSummary.completedRevenue)}
          </p>
        </div>
      </div>

      {/* Thanh bộ lọc tìm kiếm */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-stone-500 mb-1">
              Tìm kiếm đơn hàng
            </label>
            <div className="relative">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Mã đơn, số bàn, tên nhân viên, khách hàng, món..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-stone-500 mb-1">
              Hình thức
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
            >
              <option value="ALL">Tất cả kênh</option>
              <option value="DINE_IN">Tại bàn</option>
              <option value="TAKEAWAY">Mang đi</option>
              <option value="DELIVERY">Giao hàng</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-stone-500 mb-1">Từ ngày</label>
            <div className="relative">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-stone-500 mb-1">Đến ngày</label>
            <div className="relative">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="md:col-span-1">
            {(keyword || fromDate || toDate || typeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setFromDate('');
                  setToDate('');
                  setTypeFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="w-full py-2 px-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* Lọc nhanh theo trạng thái đơn */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-1.5">
          {[
            { key: 'ALL', label: `Tất cả (${orders.length})` },
            { key: 'PENDING', label: 'Chờ xác nhận' },
            { key: 'CONFIRMED', label: 'Đã xác nhận' },
            { key: 'PREPARING', label: 'Đang pha chế' },
            { key: 'DELIVERING', label: 'Đang giao' },
            { key: 'COMPLETED', label: 'Hoàn thành' },
            { key: 'CANCELLED', label: 'Đã hủy' },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStatusFilter(st.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === st.key
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bảng danh sách đơn hàng */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        {initialLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-base font-bold text-stone-800">Không tìm thấy đơn hàng nào</p>
            <p className="text-sm text-stone-500">
              Thử thay đổi bộ lọc trạng thái, khoảng ngày hoặc từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-5">Mã đơn</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Nhân viên phụ trách</th>
                  <th className="py-3.5 px-4">Hình thức / Bàn</th>
                  <th className="py-3.5 px-4">Món đã đặt</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thực thu</th>
                  <th className="py-3.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {paginatedOrders.map((ord) => {
                  const stKey = (ord.status || 'PENDING').toUpperCase();
                  const stMeta =
                    ORDER_STATUS_META[stKey] || ORDER_STATUS_META.PENDING;
                  const typeKey = (ord.orderType || 'DINE_IN').toUpperCase();
                  const items = Array.isArray(ord.orderItems) ? ord.orderItems : [];

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => handleOpenOrderDetail(ord)}
                      className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono font-extrabold text-amber-800 text-xs">
                        {ord.orderCode || `#${ord.id}`}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600 whitespace-nowrap">
                        {formatDateTime(ord.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-stone-700">
                          <UserCog className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {resolveStaffName(ord)}
                          </span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-stone-700 whitespace-nowrap">
                        {ord.tableNumber
                          ? `Tại bàn (${ord.tableNumber})`
                          : ORDER_TYPE_LABEL[typeKey] || typeKey}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600 max-w-[220px] truncate">
                        {items.length > 0
                          ? items
                              .map((it) => `${it.productName} (x${it.quantity})`)
                              .join(', ')
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stMeta.badgeClass}`}
                        >
                          {stMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-stone-800 text-xs sm:text-sm whitespace-nowrap">
                        {formatPrice(ord.finalAmount ?? ord.subtotal)}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOrderDetail(ord);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:border-amber-400 hover:bg-amber-50/50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Thanh phân trang */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Trang <strong>{currentPage}</strong> / {totalPages} • Tổng{' '}
              <strong>{filteredOrders.length}</strong> đơn hàng
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Chi tiết đơn hàng & Điều chỉnh trạng thái quản trị */}
      {detailModal.open && detailModal.order && (
        <div
          onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">
                  Chi tiết đơn hàng{' '}
                  <span className="font-mono text-amber-800">
                    {detailModal.order.orderCode || `#${detailModal.order.id}`}
                  </span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tạo lúc: {formatDateTime(detailModal.order.createdAt)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              {/* Thông tin tổng hợp */}
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-stone-500">Nhân viên phụ trách:</span>
                  <p className="font-bold text-stone-800 mt-0.5">
                    {resolveStaffName(detailModal.order)}
                  </p>
                </div>

                <div>
                  <span className="text-stone-500">Khách hàng:</span>
                  <p className="font-bold text-stone-800 mt-0.5">
                    {resolveCustomerName(detailModal.order)}
                  </p>
                </div>

                <div>
                  <span className="text-stone-500">Hình thức phục vụ:</span>
                  <p className="font-bold text-stone-800 mt-0.5 flex items-center gap-1">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      {detailModal.order.tableNumber
                        ? `Tại bàn (${detailModal.order.tableNumber})`
                        : ORDER_TYPE_LABEL[
                            (detailModal.order.orderType || 'DINE_IN').toUpperCase()
                          ] || detailModal.order.orderType}
                    </span>
                  </p>
                </div>

                <div>
                  <span className="text-stone-500">Giao dịch thanh toán:</span>
                  {detailModal.loading ? (
                    <p className="text-stone-400 mt-0.5">Đang kiểm tra...</p>
                  ) : detailModal.payments.length === 0 ? (
                    <p className="font-semibold text-stone-600 mt-0.5">Chưa có bản ghi</p>
                  ) : (
                    detailModal.payments.map((pay, idx) => (
                      <p
                        key={pay.id || idx}
                        className={`font-bold mt-0.5 flex items-center gap-1 ${
                          isPaymentSuccessful(pay) ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {pay.paymentGateway === 'VNPAY' ? (
                          <CreditCard className="w-3.5 h-3.5" />
                        ) : (
                          <Banknote className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {pay.paymentGateway || 'CASH'} ({pay.status})
                        </span>
                      </p>
                    ))
                  )}
                </div>

                {detailModal.order.note && (
                  <div className="sm:col-span-2 pt-1 border-t border-stone-200/70">
                    <span className="text-stone-500">Ghi chú đơn:</span>
                    <p className="font-medium text-stone-700 mt-0.5">
                      {detailModal.order.note}
                    </p>
                  </div>
                )}

                {detailModal.order.cancelReason && (
                  <div className="sm:col-span-2 pt-1 border-t border-rose-200 text-rose-700 flex items-start gap-1.5">
                    <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>Lý do hủy:</strong> {detailModal.order.cancelReason}
                    </span>
                  </div>
                )}
              </div>

              {/* Danh sách món */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Danh sách món trong đơn
                </p>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                  {(Array.isArray(detailModal.order.orderItems)
                    ? detailModal.order.orderItems
                    : []
                  ).map((it, i) => (
                    <div
                      key={it.id || i}
                      className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-stone-800">
                          {it.productName}{' '}
                          <span className="text-amber-800">x{it.quantity}</span>
                        </p>
                        {it.selectedOptions && (
                          <p className="text-stone-400 mt-0.5">{it.selectedOptions}</p>
                        )}
                      </div>
                      <span className="font-semibold text-stone-800">
                        {formatPrice(
                          it.subtotal ?? Number(it.unitPrice || 0) * Number(it.quantity || 1)
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tổng kết tiền */}
              <div className="pt-2 border-t border-stone-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-stone-500">
                  <span>Tạm tính:</span>
                  <span>
                    {formatPrice(detailModal.order.subtotal ?? detailModal.order.finalAmount)}
                  </span>
                </div>
                {Number(detailModal.order.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      Giảm giá{' '}
                      {detailModal.order.appliedVoucherCode
                        ? `(${detailModal.order.appliedVoucherCode})`
                        : ''}
                      :
                    </span>
                    <span>-{formatPrice(detailModal.order.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-stone-900 pt-1">
                  <span>Tổng thực thu:</span>
                  <span className="text-amber-800">
                    {formatPrice(detailModal.order.finalAmount ?? detailModal.order.subtotal)}
                  </span>
                </div>
              </div>

              {/* Khu vực Admin điều chỉnh trạng thái đơn hàng */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2.5 text-xs">
                <p className="font-bold uppercase tracking-wider text-amber-900">
                  Điều chỉnh trạng thái đơn hàng (Quản trị viên)
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    {STATUS_FLOW_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={
                      updatingStatus ||
                      nextStatus === (detailModal.order.status || '').toUpperCase()
                    }
                    onClick={handleAdminUpdateOrderStatus}
                    className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white font-bold cursor-pointer transition-colors"
                  >
                    {updatingStatus ? 'Đang lưu...' : 'Cập nhật trạng thái'}
                  </button>
                </div>

                {nextStatus === 'CANCELLED' && (
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy đơn hàng (bắt buộc)..."
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                )}
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo nổi */}
      {toast.message && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-sm px-4 py-3 rounded-2xl border shadow-lg text-sm flex items-center gap-2.5 ${
            toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span className="font-medium leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast({ type: '', message: '' })}
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;