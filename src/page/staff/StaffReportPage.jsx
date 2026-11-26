import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Coffee,
  Clock,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Search,
  Award,
  UtensilsCrossed,
  ArrowUpRight,
  FileSpreadsheet,
  Eye,
} from 'lucide-react';
import orderService from '../../service/orderService';
import userService from '../../service/userService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const DATE_PRESETS = [
  { key: 'TODAY', label: 'Hôm nay' },
  { key: '7DAYS', label: '7 ngày qua' },
  { key: 'MONTH', label: 'Tháng này' },
  { key: 'CUSTOM', label: 'Tùy chọn ngày' },
];

const ORDER_STATUS_META = {
  COMPLETED: {
    label: 'Hoàn thành',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
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

const SHIFT_SLOTS = [
  { key: '06-09', label: '06h - 09h', startHour: 6, endHour: 9 },
  { key: '09-12', label: '09h - 12h', startHour: 9, endHour: 12 },
  { key: '12-15', label: '12h - 15h', startHour: 12, endHour: 15 },
  { key: '15-18', label: '15h - 18h', startHour: 15, endHour: 18 },
  { key: '18-23', label: '18h - 23h', startHour: 18, endHour: 24 },
];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const formatCompactPrice = (price) => {
  const num = Number(price || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}tr`;
  if (num >= 1_000) return `${Math.round(num / 1_000)}k`;
  return `${num}đ`;
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

const formatShortDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN', {
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

const getPresetRange = (presetKey) => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (presetKey === 'TODAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { start, end };
  }
  if (presetKey === '7DAYS') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { start, end };
};

const StaffReportsPage = () => {
  const { user, token } = useAuth();
  const claims = useMemo(() => (token ? parseJwt(token) : null), [token]);

  // Định danh nhân viên đang đăng nhập
  const currentStaffId = useMemo(() => {
    const rawId =
      claims?.accountId ?? claims?.id ?? claims?.userId ?? user?.accountId ?? user?.id;
    return rawId != null && !isNaN(Number(rawId)) ? Number(rawId) : null;
  }, [claims, user]);

  const currentStaffEmail = useMemo(() => {
    return (claims?.email ?? claims?.sub ?? user?.email ?? '').trim().toLowerCase();
  }, [claims, user]);

  // Hồ sơ nhân viên
  const [staffProfile, setStaffProfile] = useState(null);

  // Dữ liệu đơn hàng của CHÍNH NHÂN VIÊN NÀY
  const [myAllOrders, setMyAllOrders] = useState([]);

  // Bộ lọc thời gian
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customFrom, setCustomFrom] = useState(() => toInputDateString(new Date()));
  const [customTo, setCustomTo] = useState(() => toInputDateString(new Date()));

  // Bộ lọc bảng nhật ký đơn cá nhân
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [orderTypeFilter, setOrderTypeFilter] = useState('ALL');
  const [orderKeyword, setOrderKeyword] = useState('');

  // Modal xem nhanh chi tiết 1 đơn hàng cá nhân
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

  // Trạng thái tải, xuất file & thông báo
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

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

  // Kiểm tra đơn hàng thuộc về chính nhân viên đang đăng nhập
  const isOrderOwnedByCurrentStaff = useCallback(
    (order) => {
      if (!order) return false;

      const orderStaffId =
        order.staffAccountId ??
        order.staffId ??
        order.processedByAccountId ??
        order.createdByAccountId ??
        order.staff?.id ??
        order.staff?.accountId;

      if (currentStaffId != null && orderStaffId != null) {
        return Number(orderStaffId) === currentStaffId;
      }

      const orderStaffEmail = (
        order.staffEmail ??
        order.createdBy ??
        order.staff?.email ??
        ''
      )
        .trim()
        .toLowerCase();

      if (currentStaffEmail && orderStaffEmail) {
        return orderStaffEmail === currentStaffEmail;
      }

      return false;
    },
    [currentStaffId, currentStaffEmail]
  );

  // Tải thông tin cá nhân & chỉ giữ lại đơn hàng của chính mình
  const fetchPersonalReportData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (currentStaffId == null && !currentStaffEmail) {
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [ordersRes, usersRes] = await Promise.all([
          orderService.getAllOrders({
            staffAccountId: currentStaffId ?? undefined,
            page: 0,
            size: 500,
            sortBy: 'createdAt',
            sortDir: 'desc',
          }),
          userService.getAllUsers().catch(() => ({ result: [] })),
        ]);

        if (currentStaffId != null && Array.isArray(usersRes?.result)) {
          const foundProfile = usersRes.result.find(
            (u) => Number(u.accountId) === currentStaffId
          );
          if (foundProfile) setStaffProfile(foundProfile);
        }

        const rawResult = ordersRes?.result;
        const rawList = Array.isArray(rawResult?.content)
          ? rawResult.content
          : Array.isArray(rawResult)
            ? rawResult
            : [];

        const strictlyPersonalOrders = rawList.filter(isOrderOwnedByCurrentStaff);
        setMyAllOrders(strictlyPersonalOrders);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải dữ liệu thống kê cá nhân.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [currentStaffId, currentStaffEmail, isOrderOwnedByCurrentStaff, showToast]
  );

  useEffect(() => {
    fetchPersonalReportData({ isInitial: true });
  }, [fetchPersonalReportData]);

  // Khoảng thời gian đang chọn
  const activeRange = useMemo(() => {
    if (datePreset !== 'CUSTOM') {
      return getPresetRange(datePreset);
    }
    const start = customFrom
      ? new Date(`${customFrom}T00:00:00`)
      : getPresetRange('TODAY').start;
    const end = customTo
      ? new Date(`${customTo}T23:59:59.999`)
      : getPresetRange('TODAY').end;
    return { start, end };
  }, [datePreset, customFrom, customTo]);

  // Lọc đơn hàng của cá nhân theo khoảng thời gian
  const ordersInPeriod = useMemo(() => {
    const startMs = activeRange.start.getTime();
    const endMs = activeRange.end.getTime();

    return myAllOrders.filter((ord) => {
      if (!ord.createdAt) return false;
      const t = new Date(ord.createdAt).getTime();
      if (isNaN(t)) return false;
      return t >= startMs && t <= endMs;
    });
  }, [myAllOrders, activeRange]);

  // Tổng hợp KPI cá nhân
  const personalKpi = useMemo(() => {
    const completedOrders = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'COMPLETED'
    );
    const cancelledOrders = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'CANCELLED'
    );
    const inProgressOrders = ordersInPeriod.filter((o) => {
      const st = (o.status || '').toUpperCase();
      return st !== 'COMPLETED' && st !== 'CANCELLED';
    });

    const completedSubtotal = completedOrders.reduce(
      (sum, o) => sum + Number(o.subtotal ?? o.finalAmount ?? 0),
      0
    );
    const completedDiscount = completedOrders.reduce(
      (sum, o) => sum + Number(o.discountAmount ?? 0),
      0
    );
    const completedRevenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.finalAmount ?? o.subtotal ?? 0),
      0
    );

    const avgOrderValue =
      completedOrders.length > 0 ? completedRevenue / completedOrders.length : 0;

    const totalItemsSold = completedOrders.reduce((sum, o) => {
      const items = Array.isArray(o.orderItems) ? o.orderItems : [];
      return sum + items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    }, 0);

    const completionRate =
      ordersInPeriod.length > 0
        ? Math.round((completedOrders.length / ordersInPeriod.length) * 100)
        : 0;

    return {
      totalCount: ordersInPeriod.length,
      completedCount: completedOrders.length,
      inProgressCount: inProgressOrders.length,
      cancelledCount: cancelledOrders.length,
      completedSubtotal,
      completedDiscount,
      completedRevenue,
      avgOrderValue,
      totalItemsSold,
      completionRate,
    };
  }, [ordersInPeriod]);

  // Dữ liệu biểu đồ cột cá nhân
  const chartSeries = useMemo(() => {
    const completed = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'COMPLETED'
    );

    if (datePreset === 'TODAY') {
      return SHIFT_SLOTS.map((slot) => {
        const matched = completed.filter((o) => {
          const h = new Date(o.createdAt).getHours();
          return h >= slot.startHour && h < slot.endHour;
        });
        const revenue = matched.reduce(
          (sum, o) => sum + Number(o.finalAmount ?? o.subtotal ?? 0),
          0
        );
        return {
          key: slot.key,
          label: slot.label,
          revenue,
          orderCount: matched.length,
        };
      });
    }

    const buckets = [];
    const cursor = new Date(
      activeRange.start.getFullYear(),
      activeRange.start.getMonth(),
      activeRange.start.getDate()
    );
    const endDay = new Date(
      activeRange.end.getFullYear(),
      activeRange.end.getMonth(),
      activeRange.end.getDate()
    );

    while (cursor <= endDay && buckets.length < 31) {
      const dayKey = toInputDateString(cursor);
      const label = `${String(cursor.getDate()).padStart(2, '0')}/${String(
        cursor.getMonth() + 1
      ).padStart(2, '0')}`;
      buckets.push({
        key: dayKey,
        label,
        revenue: 0,
        orderCount: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    const bucketMap = new Map(buckets.map((b) => [b.key, b]));
    completed.forEach((o) => {
      const d = new Date(o.createdAt);
      const k = toInputDateString(d);
      const target = bucketMap.get(k);
      if (target) {
        target.revenue += Number(o.finalAmount ?? o.subtotal ?? 0);
        target.orderCount += 1;
      }
    });

    return buckets;
  }, [ordersInPeriod, datePreset, activeRange]);

  const maxChartRevenue = useMemo(() => {
    const maxVal = Math.max(...chartSeries.map((b) => b.revenue), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [chartSeries]);

  // Top 5 món cá nhân bán chạy nhất trong kỳ
  const myTopProducts = useMemo(() => {
    const productMap = new Map();
    ordersInPeriod
      .filter((o) => (o.status || '').toUpperCase() === 'COMPLETED')
      .forEach((o) => {
        const items = Array.isArray(o.orderItems) ? o.orderItems : [];
        items.forEach((it) => {
          const name = it.productName || `Món #${it.productId}`;
          const qty = Number(it.quantity || 0);
          const amount = Number(it.subtotal ?? Number(it.unitPrice || 0) * qty);
          const current = productMap.get(name) || { name, quantity: 0, revenue: 0 };
          current.quantity += qty;
          current.revenue += amount;
          productMap.set(name, current);
        });
      });

    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);
  }, [ordersInPeriod]);

  // Phân bổ kênh phục vụ cá nhân
  const channelBreakdown = useMemo(() => {
    let dineInCount = 0;
    let dineInRevenue = 0;
    let takeawayCount = 0;
    let takeawayRevenue = 0;

    ordersInPeriod
      .filter((o) => (o.status || '').toUpperCase() === 'COMPLETED')
      .forEach((o) => {
        const rev = Number(o.finalAmount ?? o.subtotal ?? 0);
        const type = (o.orderType || 'DINE_IN').toUpperCase();
        if (type === 'DINE_IN') {
          dineInCount += 1;
          dineInRevenue += rev;
        } else {
          takeawayCount += 1;
          takeawayRevenue += rev;
        }
      });

    const total = dineInCount + takeawayCount;
    const dineInPct = total > 0 ? Math.round((dineInCount / total) * 100) : 0;
    const takeawayPct = total > 0 ? 100 - dineInPct : 0;

    return {
      dineInCount,
      dineInRevenue,
      dineInPct,
      takeawayCount,
      takeawayRevenue,
      takeawayPct,
    };
  }, [ordersInPeriod]);

  // Lọc danh sách nhật ký đơn hàng cá nhân
  const filteredPersonalOrders = useMemo(() => {
    const q = orderKeyword.trim().toLowerCase();
    return ordersInPeriod.filter((ord) => {
      const st = (ord.status || 'PENDING').toUpperCase();
      const type = (ord.orderType || 'DINE_IN').toUpperCase();

      const matchStatus = orderStatusFilter === 'ALL' || st === orderStatusFilter;
      const matchType = orderTypeFilter === 'ALL' || type === orderTypeFilter;
      const matchKeyword =
        !q ||
        (ord.orderCode || '').toLowerCase().includes(q) ||
        String(ord.id).includes(q) ||
        (ord.tableNumber || '').toLowerCase().includes(q);

      return matchStatus && matchType && matchKeyword;
    });
  }, [ordersInPeriod, orderStatusFilter, orderTypeFilter, orderKeyword]);

  const staffDisplayName =
    staffProfile?.fullName ||
    user?.fullName ||
    currentStaffEmail ||
    (currentStaffId ? `Nhân viên #${currentStaffId}` : 'Nhân viên');

  // Xuất file Excel (.xls chuẩn UTF-8 mở trực tiếp trên Excel, đầy đủ 3 bảng báo cáo cá nhân)
  const handleExportExcel = () => {
    if (ordersInPeriod.length === 0) {
      showToast('error', 'Không có dữ liệu đơn hàng của bạn trong kỳ để xuất Excel.');
      return;
    }

    setExporting(true);
    try {
      const periodText = `${formatShortDate(activeRange.start)} - ${formatShortDate(
        activeRange.end
      )}`;
      const exportedAt = formatDateTime(new Date().toISOString());

      const topProductRows =
        myTopProducts.length > 0
          ? myTopProducts
              .map(
                (p, index) => `
                <tr>
                  <td style="text-align:center;">${index + 1}</td>
                  <td>${escapeHtml(p.name)}</td>
                  <td style="text-align:right;">${p.quantity}</td>
                  <td style="text-align:right;">${Number(p.revenue || 0)}</td>
                </tr>`
              )
              .join('')
          : `<tr><td colspan="4" style="text-align:center;">Chưa có dữ liệu món bán ra</td></tr>`;

      const orderRows = ordersInPeriod
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
              <td>${escapeHtml(channelLabel)}</td>
              <td>${escapeHtml(itemsSummary)}</td>
              <td style="text-align:right;">${subtotal}</td>
              <td style="text-align:right;">${discount}</td>
              <td style="text-align:right;font-weight:bold;">${finalAmount}</td>
              <td>${escapeHtml(stLabel)}</td>
            </tr>`;
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
            table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
            th, td { border: 1px solid #d6d3d1; padding: 6px 10px; vertical-align: middle; }
            th { background-color: #78350f; color: #ffffff; font-weight: bold; text-align: left; }
            .title { font-size: 16px; font-weight: bold; color: #78350f; border: none; padding: 4px 0; }
            .meta { border: none; padding: 2px 0; color: #44403c; }
            .section-title { font-size: 13px; font-weight: bold; background-color: #fef3c7; color: #78350f; }
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="9" class="title">BÁO CÁO THỐNG KÊ HIỆU SUẤT CÁ NHÂN - CF SHOP</td></tr>
            <tr><td colspan="9" class="meta"><strong>Nhân viên phụ trách:</strong> ${escapeHtml(
              staffDisplayName
            )} (${escapeHtml(currentStaffEmail || `ID #${currentStaffId}`)})</td></tr>
            <tr><td colspan="9" class="meta"><strong>Kỳ báo cáo:</strong> ${escapeHtml(
              periodText
            )} &nbsp;|&nbsp; <strong>Thời điểm xuất:</strong> ${escapeHtml(exportedAt)}</td></tr>
          </table>

          <table>
            <tr><th colspan="4" class="section-title">I. TỔNG HỢP CHỈ SỐ CÁ NHÂN</th></tr>
            <tr>
              <th>Chỉ tiêu</th>
              <th>Giá trị</th>
              <th>Chỉ tiêu</th>
              <th>Giá trị</th>
            </tr>
            <tr>
              <td>Tổng đơn hàng phụ trách</td>
              <td style="text-align:right;font-weight:bold;">${personalKpi.totalCount}</td>
              <td>Tổng tạm tính (đơn hoàn thành)</td>
              <td style="text-align:right;">${personalKpi.completedSubtotal}</td>
            </tr>
            <tr>
              <td>Đơn hoàn thành</td>
              <td style="text-align:right;font-weight:bold;">${personalKpi.completedCount}</td>
              <td>Tổng giảm giá đã áp dụng</td>
              <td style="text-align:right;">${personalKpi.completedDiscount}</td>
            </tr>
            <tr>
              <td>Đơn đang xử lý / Đã hủy</td>
              <td style="text-align:right;">${personalKpi.inProgressCount} mở / ${
        personalKpi.cancelledCount
      } hủy</td>
              <td>Doanh thu thực thu của tôi</td>
              <td style="text-align:right;font-weight:bold;color:#047857;">${
                personalKpi.completedRevenue
              }</td>
            </tr>
            <tr>
              <td>Tổng số ly / món đã phục vụ</td>
              <td style="text-align:right;font-weight:bold;">${personalKpi.totalItemsSold}</td>
              <td>Giá trị trung bình / đơn</td>
              <td style="text-align:right;">${Math.round(personalKpi.avgOrderValue)}</td>
            </tr>
          </table>

          <table>
            <tr><th colspan="4" class="section-title">II. TOP MÓN BÁN CHẠY CỦA CÁ NHÂN</th></tr>
            <tr>
              <th style="width:50px;text-align:center;">STT</th>
              <th>Tên món</th>
              <th style="text-align:right;">Số lượng bán</th>
              <th style="text-align:right;">Doanh thu (VNĐ)</th>
            </tr>
            ${topProductRows}
          </table>

          <table>
            <tr><th colspan="9" class="section-title">III. CHI TIẾT NHẬT KÝ ĐƠN HÀNG CỦA TÔI (${
              ordersInPeriod.length
            } ĐƠN)</th></tr>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Mã đơn</th>
              <th>Thời gian tạo</th>
              <th>Hình thức / Bàn</th>
              <th>Danh sách món</th>
              <th style="text-align:right;">Tạm tính (VNĐ)</th>
              <th style="text-align:right;">Giảm giá (VNĐ)</th>
              <th style="text-align:right;">Thực thu (VNĐ)</th>
              <th>Trạng thái</th>
            </tr>
            ${orderRows}
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF', htmlContent], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = staffDisplayName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      const fileDateTag = `${toInputDateString(activeRange.start)}_${toInputDateString(
        activeRange.end
      )}`;
      link.href = url;
      link.download = `BaoCaoCaNhan_${safeName || 'Staff'}_${fileDateTag}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('success', `Đã xuất file Excel báo cáo cá nhân (${ordersInPeriod.length} đơn).`);
    } catch {
      showToast('error', 'Không thể xuất file Excel, vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Header & Phạm vi thống kê cá nhân */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white p-6 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Báo cáo cá nhân • Dữ liệu riêng của {staffDisplayName}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Thống kê Hiệu suất & Chốt ca Cá nhân
            </h1>
            <p className="text-sm text-stone-300 max-w-2xl">
              Tổng hợp doanh thu, sản lượng món và nhật ký đơn hàng do chính bạn phụ trách.
              Số liệu toàn cửa hàng chỉ hiển thị ở tài khoản Quản trị viên.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              disabled={initialLoading || exporting || ordersInPeriod.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-400 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>

            <Link
              to="/staff/tables"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4 text-amber-300" />
              <span>Sơ đồ bàn</span>
            </Link>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchPersonalReportData({ isInitial: false })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Bộ chọn khoảng thời gian */}
        <div className="relative mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setDatePreset(preset.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === preset.key
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'bg-white/10 text-stone-200 hover:bg-white/15'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {datePreset === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-stone-300">Từ:</span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-stone-300">Đến:</span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4 Thẻ KPI cá nhân */}
      {initialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Doanh thu thực thu cá nhân */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Doanh thu thực thu
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-emerald-700">
                {formatPrice(personalKpi.completedRevenue)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                TB/đơn:{' '}
                <strong className="text-stone-700">
                  {formatPrice(personalKpi.avgOrderValue)}
                </strong>
                {personalKpi.completedDiscount > 0 && (
                  <span> • Giảm: {formatCompactPrice(personalKpi.completedDiscount)}</span>
                )}
              </p>
            </div>
          </div>

          {/* KPI 2: Số đơn cá nhân hoàn thành */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Đơn hoàn thành của tôi
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-stone-800">
                {personalKpi.completedCount}{' '}
                <span className="text-sm font-semibold text-stone-400">
                  / {personalKpi.totalCount} đơn
                </span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Tỷ lệ hoàn tất:{' '}
                <strong className="text-amber-800">{personalKpi.completionRate}%</strong>
              </p>
            </div>
          </div>

          {/* KPI 3: Số ly / món đã phục vụ */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Sản lượng đã phục vụ
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-stone-800">
                {personalKpi.totalItemsSold}{' '}
                <span className="text-sm font-semibold text-stone-500">ly / món</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Tính trên các đơn hoàn thành của bạn
              </p>
            </div>
          </div>

          {/* KPI 4: Đơn đang xử lý / Đã hủy */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Đơn mở & Đơn hủy
              </span>
              <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-amber-800">
                {personalKpi.inProgressCount}{' '}
                <span className="text-sm font-semibold text-stone-500">đang xử lý</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Đơn hủy của tôi:{' '}
                <strong className="text-rose-600">{personalKpi.cancelledCount} đơn</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Khu vực Biểu đồ doanh thu cá nhân + Top món cá nhân */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 phần): Biểu đồ cột doanh thu cá nhân */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-700" />
              <span>
                {datePreset === 'TODAY'
                  ? 'Doanh thu cá nhân theo khung giờ hôm nay'
                  : 'Biểu đồ doanh thu cá nhân theo ngày'}
              </span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Chỉ tính các đơn hàng hoàn tất do chính bạn thực hiện
            </p>
          </div>

          {personalKpi.completedCount === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200">
              Bạn chưa có đơn hàng hoàn thành nào trong khoảng thời gian này.
            </div>
          ) : (
            <div className="pt-4">
              <div className="h-56 flex items-end gap-2 sm:gap-3 px-1 border-b border-stone-200 pb-2 overflow-x-auto">
                {chartSeries.map((bar) => {
                  const heightPercent =
                    bar.revenue > 0
                      ? Math.max(8, Math.round((bar.revenue / maxChartRevenue) * 100))
                      : 2;
                  return (
                    <div
                      key={bar.key}
                      className="flex-1 min-w-[36px] h-full flex flex-col items-center justify-end group relative"
                    >
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-11 z-10 px-2.5 py-1 rounded-lg bg-stone-900 text-white text-[11px] whitespace-nowrap shadow-md">
                        <strong>{formatPrice(bar.revenue)}</strong> ({bar.orderCount} đơn)
                      </div>

                      <span className="text-[10px] font-semibold text-stone-500 mb-1">
                        {bar.revenue > 0 ? formatCompactPrice(bar.revenue) : ''}
                      </span>

                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[38px] rounded-t-xl transition-all duration-300 ${
                          bar.revenue > 0
                            ? 'bg-gradient-to-t from-amber-700 to-amber-500 group-hover:from-amber-800 group-hover:to-amber-600'
                            : 'bg-stone-100'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 px-1 pt-2 overflow-x-auto">
                {chartSeries.map((bar) => (
                  <div
                    key={bar.key}
                    className="flex-1 min-w-[36px] text-center text-[11px] font-medium text-stone-500 truncate"
                  >
                    {bar.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thanh tỷ lệ kênh phục vụ của cá nhân */}
          <div className="pt-4 border-t border-stone-100 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-stone-700">
                Phân bổ phục vụ của tôi
              </span>
              <span className="text-stone-500">
                Tại bàn: <strong>{channelBreakdown.dineInCount} đơn</strong> (
                {channelBreakdown.dineInPct}% •{' '}
                {formatCompactPrice(channelBreakdown.dineInRevenue)}) • Mang đi/Giao:{' '}
                <strong>{channelBreakdown.takeawayCount} đơn</strong> (
                {channelBreakdown.takeawayPct}% •{' '}
                {formatCompactPrice(channelBreakdown.takeawayRevenue)})
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-stone-100 overflow-hidden flex">
              <div
                style={{ width: `${channelBreakdown.dineInPct}%` }}
                className="bg-amber-700 transition-all duration-300"
              />
              <div
                style={{ width: `${channelBreakdown.takeawayPct}%` }}
                className="bg-sky-500 transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* Cột phải (5 phần): Top 5 món cá nhân bán chạy nhất */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-700" />
              <span>Top món bạn bán chạy nhất</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Xếp hạng theo số lượng ly/món trong các đơn của riêng bạn
            </p>
          </div>

          {myTopProducts.length === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200">
              Chưa có dữ liệu món bán ra trong kỳ.
            </div>
          ) : (
            <div className="space-y-3">
              {myTopProducts.map((prod, idx) => {
                const maxQty = myTopProducts[0]?.quantity || 1;
                const pct = Math.max(10, Math.round((prod.quantity / maxQty) * 100));

                return (
                  <div
                    key={prod.name}
                    className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                            idx === 0
                              ? 'bg-amber-700 text-white'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-bold text-stone-800 truncate">
                          {prod.name}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-amber-800">
                          {prod.quantity} ly
                        </span>
                        <span className="text-stone-400 mx-1">•</span>
                        <span className="font-semibold text-stone-700">
                          {formatPrice(prod.revenue)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-stone-200/80 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full rounded-full bg-amber-600"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bảng nhật ký đơn hàng cá nhân trong kỳ */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-stone-800">
                Nhật ký đơn hàng của tôi ({filteredPersonalOrders.length})
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Danh sách chi tiết các đơn hàng do tài khoản của bạn khởi tạo hoặc xử lý
              </p>
            </div>

            <button
              type="button"
              disabled={initialLoading || exporting || ordersInPeriod.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-bold transition-colors cursor-pointer self-start sm:self-center"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Xuất bảng kê Excel</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: 'Tất cả trạng thái' },
                { key: 'COMPLETED', label: 'Hoàn thành' },
                { key: 'PENDING', label: 'Chờ xác nhận' },
                { key: 'PREPARING', label: 'Đang pha chế' },
                { key: 'CANCELLED', label: 'Đã hủy' },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setOrderStatusFilter(st.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    orderStatusFilter === st.key
                      ? 'bg-stone-800 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={orderTypeFilter}
                onChange={(e) => setOrderTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600 cursor-pointer"
              >
                <option value="ALL">Tất cả hình thức</option>
                <option value="DINE_IN">Tại bàn</option>
                <option value="TAKEAWAY">Mang đi</option>
                <option value="DELIVERY">Giao hàng</option>
              </select>

              <div className="relative flex-1 sm:w-52">
                <input
                  type="text"
                  value={orderKeyword}
                  onChange={(e) => setOrderKeyword(e.target.value)}
                  placeholder="Tìm mã đơn, số bàn..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>
        </div>

        {filteredPersonalOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-500">
            Không có đơn hàng cá nhân nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-5">Mã đơn</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4">Hình thức / Bàn</th>
                  <th className="py-3.5 px-4">Chi tiết món</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thực thu</th>
                  <th className="py-3.5 px-5 text-right">Xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPersonalOrders.map((ord) => {
                  const stKey = (ord.status || 'PENDING').toUpperCase();
                  const stMeta =
                    ORDER_STATUS_META[stKey] || ORDER_STATUS_META.PENDING;
                  const typeKey = (ord.orderType || 'DINE_IN').toUpperCase();
                  const items = Array.isArray(ord.orderItems) ? ord.orderItems : [];

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrderDetail(ord)}
                      className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono font-extrabold text-amber-800 text-xs">
                        {ord.orderCode || `#${ord.id}`}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        {formatDateTime(ord.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-medium text-stone-700">
                        {ord.tableNumber
                          ? `Tại bàn (${ord.tableNumber})`
                          : ORDER_TYPE_LABEL[typeKey] || typeKey}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600 max-w-xs truncate">
                        {items.length > 0
                          ? items
                              .map((it) => `${it.productName} (x${it.quantity})`)
                              .join(', ')
                          : '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${stMeta.badgeClass}`}
                        >
                          {stMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-stone-800 text-xs sm:text-sm">
                        {formatPrice(ord.finalAmount ?? ord.subtotal)}
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderDetail(ord);
                          }}
                          className="p-1.5 rounded-lg border border-stone-200 bg-white hover:border-amber-400 text-stone-600 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <span>
            Hiển thị {filteredPersonalOrders.length} đơn hàng thuộc trách nhiệm của bạn
          </span>
          <Link
            to="/staff/orders"
            className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline"
          >
            <span>Đi tới quản lý đơn hàng</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Modal Xem chi tiết 1 đơn hàng cá nhân */}
      {selectedOrderDetail && (
        <div
          onClick={() => setSelectedOrderDetail(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-stone-800">
                  Chi tiết đơn {selectedOrderDetail.orderCode || `#${selectedOrderDetail.id}`}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {formatDateTime(selectedOrderDetail.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Hình thức:</span>
                  <strong className="text-stone-800">
                    {selectedOrderDetail.tableNumber
                      ? `Tại bàn (${selectedOrderDetail.tableNumber})`
                      : ORDER_TYPE_LABEL[
                          (selectedOrderDetail.orderType || 'DINE_IN').toUpperCase()
                        ] || selectedOrderDetail.orderType}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Trạng thái:</span>
                  <strong className="text-stone-800">
                    {ORDER_STATUS_META[
                      (selectedOrderDetail.status || 'PENDING').toUpperCase()
                    ]?.label || selectedOrderDetail.status}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold uppercase tracking-wider text-stone-500">
                  Danh sách món
                </p>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                  {(Array.isArray(selectedOrderDetail.orderItems)
                    ? selectedOrderDetail.orderItems
                    : []
                  ).map((it, i) => (
                    <div
                      key={it.id || i}
                      className="p-3 bg-white flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-stone-800">
                          {it.productName} <span className="text-amber-800">x{it.quantity}</span>
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

              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <div className="flex justify-between text-stone-500">
                  <span>Tạm tính:</span>
                  <span>
                    {formatPrice(
                      selectedOrderDetail.subtotal ?? selectedOrderDetail.finalAmount
                    )}
                  </span>
                </div>
                {Number(selectedOrderDetail.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá:</span>
                    <span>-{formatPrice(selectedOrderDetail.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-1">
                  <span>Thực thu:</span>
                  <span>
                    {formatPrice(
                      selectedOrderDetail.finalAmount ?? selectedOrderDetail.subtotal
                    )}
                  </span>
                </div>
              </div>
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

export default StaffReportsPage;