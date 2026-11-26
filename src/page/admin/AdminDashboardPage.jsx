import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  ShoppingBag,
  Coffee,
  Users,
  UserCog,
  RefreshCw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Award,
  BarChart3,
  FileSpreadsheet,
  ArrowUpRight,
  Eye,
  Clock,
  Wallet,
  Store,
} from 'lucide-react';
import orderService from '../../service/orderService';
import accountService from '../../service/accountService';
import userService from '../../service/userService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const DATE_PRESETS = [
  { key: 'TODAY', label: 'Hôm nay' },
  { key: '7DAYS', label: '7 ngày qua' },
  { key: 'MONTH', label: 'Tháng này' },
  { key: 'ALL', label: 'Toàn thời gian' },
  { key: 'CUSTOM', label: 'Tùy chọn ngày' },
];

const ORDER_STATUS_META = {
  COMPLETED: {
    label: 'Hoàn thành',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barClass: 'bg-emerald-500',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    barClass: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    barClass: 'bg-sky-500',
  },
  PREPARING: {
    label: 'Đang pha chế',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    barClass: 'bg-indigo-500',
  },
  DELIVERING: {
    label: 'Đang giao',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    barClass: 'bg-purple-500',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    barClass: 'bg-rose-500',
  },
};

const ORDER_TYPE_LABEL = {
  DINE_IN: 'Tại bàn',
  TAKEAWAY: 'Mang đi',
  DELIVERY: 'Giao hàng',
};

const PAYMENT_METHOD_LABEL = {
  CASH: 'Tiền mặt',
  VNPAY: 'VNPay QR',
  MOMO: 'Ví MoMo',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ ngân hàng',
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
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}tỷ`;
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

const getInitials = (name, email) => {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
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
  if (presetKey === 'MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end };
  }
  // ALL
  return { start: null, end: null };
};

const AdminDashboardPage = () => {
  const { user, token } = useAuth();
  const claims = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const adminEmail = useMemo(
    () => (claims?.email ?? claims?.sub ?? user?.email ?? 'Admin').trim(),
    [claims, user]
  );

  // Dữ liệu tổng hợp toàn cửa hàng
  const [allOrders, setAllOrders] = useState([]);
  const [allAccounts, setAllAccounts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Bộ lọc thời gian
  const [datePreset, setDatePreset] = useState('TODAY');
  const [customFrom, setCustomFrom] = useState(() => toInputDateString(new Date()));
  const [customTo, setCustomTo] = useState(() => toInputDateString(new Date()));

  // Modal xem nhanh chi tiết đơn hàng
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Trạng thái tải, xuất Excel & thông báo
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

  // Tải đồng thời toàn bộ Orders, Accounts, Users
  const fetchStoreDashboardData = useCallback(
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

        const rawOrderResult = ordersRes?.result;
        const parsedOrders = Array.isArray(rawOrderResult?.content)
          ? rawOrderResult.content
          : Array.isArray(rawOrderResult)
            ? rawOrderResult
            : [];

        setAllOrders(parsedOrders);
        setAllAccounts(Array.isArray(accountsRes?.result) ? accountsRes.result : []);
        setAllUsers(Array.isArray(usersRes?.result) ? usersRes.result : []);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải dữ liệu tổng hợp toàn cửa hàng.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchStoreDashboardData({ isInitial: true });
  }, [fetchStoreDashboardData]);

  // Ánh xạ Account + User profile để tra cứu nhanh nhân viên & khách hàng
  const accountLookup = useMemo(() => {
    const profileByAccId = {};
    allUsers.forEach((u) => {
      if (u.accountId != null) {
        profileByAccId[Number(u.accountId)] = u;
      }
    });

    const byId = {};
    const byEmail = {};
    allAccounts.forEach((acc) => {
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
  }, [allAccounts, allUsers]);

  // Khoảng thời gian đang chọn
  const activeRange = useMemo(() => {
    if (datePreset === 'ALL') {
      return { start: null, end: null };
    }
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

  // Lọc toàn bộ đơn hàng cửa hàng theo khoảng thời gian
  const ordersInPeriod = useMemo(() => {
    if (!activeRange.start || !activeRange.end) {
      return allOrders;
    }
    const startMs = activeRange.start.getTime();
    const endMs = activeRange.end.getTime();

    return allOrders.filter((ord) => {
      if (!ord.createdAt) return false;
      const t = new Date(ord.createdAt).getTime();
      if (isNaN(t)) return false;
      return t >= startMs && t <= endMs;
    });
  }, [allOrders, activeRange]);

  // Tổng hợp KPI toàn cửa hàng
  const storeKpi = useMemo(() => {
    const completed = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'COMPLETED'
    );
    const cancelled = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'CANCELLED'
    );
    const activeProcessing = ordersInPeriod.filter((o) => {
      const st = (o.status || '').toUpperCase();
      return st !== 'COMPLETED' && st !== 'CANCELLED';
    });

    const grossSubtotal = completed.reduce(
      (sum, o) => sum + Number(o.subtotal ?? o.finalAmount ?? 0),
      0
    );
    const totalDiscount = completed.reduce(
      (sum, o) => sum + Number(o.discountAmount ?? 0),
      0
    );
    const netRevenue = completed.reduce(
      (sum, o) => sum + Number(o.finalAmount ?? o.subtotal ?? 0),
      0
    );

    const avgOrderValue = completed.length > 0 ? netRevenue / completed.length : 0;

    const totalItemsSold = completed.reduce((sum, o) => {
      const items = Array.isArray(o.orderItems) ? o.orderItems : [];
      return sum + items.reduce((s, it) => s + Number(it.quantity || 0), 0);
    }, 0);

    const completionRate =
      ordersInPeriod.length > 0
        ? Math.round((completed.length / ordersInPeriod.length) * 100)
        : 0;

    // Thống kê tài khoản toàn hệ thống
    const staffAccounts = allAccounts.filter(
      (a) => (a.roleName || '').toUpperCase() !== 'CUSTOMER'
    );
    const activeStaffCount = staffAccounts.filter(
      (a) => (a.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
    ).length;

    const customerAccounts = allAccounts.filter(
      (a) => (a.roleName || '').toUpperCase() === 'CUSTOMER'
    );

    const newCustomersInPeriod =
      activeRange.start && activeRange.end
        ? customerAccounts.filter((c) => {
            if (!c.createdAt) return false;
            const t = new Date(c.createdAt).getTime();
            return (
              !isNaN(t) &&
              t >= activeRange.start.getTime() &&
              t <= activeRange.end.getTime()
            );
          }).length
        : customerAccounts.length;

    return {
      totalOrders: ordersInPeriod.length,
      completedCount: completed.length,
      activeProcessingCount: activeProcessing.length,
      cancelledCount: cancelled.length,
      grossSubtotal,
      totalDiscount,
      netRevenue,
      avgOrderValue,
      totalItemsSold,
      completionRate,
      totalStaff: staffAccounts.length,
      activeStaffCount,
      totalCustomers: customerAccounts.length,
      newCustomersInPeriod,
    };
  }, [ordersInPeriod, allAccounts, activeRange]);

  // Biểu đồ doanh thu toàn quán (theo giờ nếu Hôm nay, theo ngày nếu nhiều ngày)
  const revenueChartSeries = useMemo(() => {
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

    // Xác định khoảng ngày hiển thị biểu đồ (tối đa 30 ngày gần nhất)
    let startDay;
    let endDay;

    if (activeRange.start && activeRange.end) {
      startDay = new Date(
        activeRange.start.getFullYear(),
        activeRange.start.getMonth(),
        activeRange.start.getDate()
      );
      endDay = new Date(
        activeRange.end.getFullYear(),
        activeRange.end.getMonth(),
        activeRange.end.getDate()
      );
    } else {
      const now = new Date();
      endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    }

    const diffDays = Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      startDay = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 29);
    }

    const buckets = [];
    const cursor = new Date(startDay);
    while (cursor <= endDay) {
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
    const maxVal = Math.max(...revenueChartSeries.map((b) => b.revenue), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [revenueChartSeries]);

  // Cơ cấu hình thức phục vụ & phương thức thanh toán toàn quán
  const storeOperationsBreakdown = useMemo(() => {
    const completed = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'COMPLETED'
    );

    const channels = {
      DINE_IN: { key: 'DINE_IN', label: 'Tại bàn', count: 0, revenue: 0 },
      TAKEAWAY: { key: 'TAKEAWAY', label: 'Mang đi', count: 0, revenue: 0 },
      DELIVERY: { key: 'DELIVERY', label: 'Giao hàng', count: 0, revenue: 0 },
    };

    const paymentMap = new Map();

    completed.forEach((o) => {
      const rev = Number(o.finalAmount ?? o.subtotal ?? 0);
      const type = (o.orderType || 'DINE_IN').toUpperCase();
      if (channels[type]) {
        channels[type].count += 1;
        channels[type].revenue += rev;
      } else {
        channels.DINE_IN.count += 1;
        channels.DINE_IN.revenue += rev;
      }

      const rawPay = (o.paymentMethod || 'CASH').toUpperCase();
      const payLabel = PAYMENT_METHOD_LABEL[rawPay] || rawPay;
      const curPay = paymentMap.get(payLabel) || { label: payLabel, count: 0, revenue: 0 };
      curPay.count += 1;
      curPay.revenue += rev;
      paymentMap.set(payLabel, curPay);
    });

    const totalCompleted = completed.length || 1;
    const channelList = Object.values(channels).map((c) => ({
      ...c,
      percent: completed.length > 0 ? Math.round((c.count / totalCompleted) * 100) : 0,
    }));

    const paymentList = Array.from(paymentMap.values()).sort(
      (a, b) => b.revenue - a.revenue
    );

    return { channelList, paymentList };
  }, [ordersInPeriod]);

  // Bảng xếp hạng hiệu suất từng nhân viên (Toàn cửa hàng)
  const staffPerformanceList = useMemo(() => {
    const completed = ordersInPeriod.filter(
      (o) => (o.status || '').toUpperCase() === 'COMPLETED'
    );
    const totalStoreRev = storeKpi.netRevenue || 1;
    const perfMap = new Map();

    completed.forEach((ord) => {
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

      let accInfo = null;
      if (rawStaffId != null && accountLookup.byId[Number(rawStaffId)]) {
        accInfo = accountLookup.byId[Number(rawStaffId)];
      } else if (rawStaffEmail && accountLookup.byEmail[rawStaffEmail]) {
        accInfo = accountLookup.byEmail[rawStaffEmail];
      }

      const groupKey = accInfo
        ? `ACC_${accInfo.id}`
        : rawStaffId != null
          ? `ID_${rawStaffId}`
          : rawStaffEmail
            ? `EMAIL_${rawStaffEmail}`
            : 'SELF_SERVICE';

      const existing = perfMap.get(groupKey) || {
        key: groupKey,
        name:
          accInfo?.profile?.fullName ||
          (accInfo?.email ? accInfo.email.split('@')[0] : null) ||
          (rawStaffEmail ? rawStaffEmail.split('@')[0] : null) ||
          (rawStaffId != null ? `Nhân viên #${rawStaffId}` : 'Khách tự đặt / Hệ thống'),
        email: accInfo?.email || rawStaffEmail || 'Đơn online / QR tại bàn',
        avatarUrl: accInfo?.profile?.avatarUrl || null,
        roleName: accInfo?.roleName || (groupKey === 'SELF_SERVICE' ? 'ONLINE' : 'STAFF'),
        orderCount: 0,
        itemsSold: 0,
        revenue: 0,
      };

      const items = Array.isArray(ord.orderItems) ? ord.orderItems : [];
      const qty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);

      existing.orderCount += 1;
      existing.itemsSold += qty;
      existing.revenue += Number(ord.finalAmount ?? ord.subtotal ?? 0);
      perfMap.set(groupKey, existing);
    });

    return Array.from(perfMap.values())
      .map((item) => ({
        ...item,
        sharePercent:
          storeKpi.netRevenue > 0
            ? Math.round((item.revenue / totalStoreRev) * 100)
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.orderCount - a.orderCount);
  }, [ordersInPeriod, accountLookup, storeKpi.netRevenue]);

  // Top 5 sản phẩm bán chạy toàn cửa hàng
  const topStoreProducts = useMemo(() => {
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

  // 10 đơn hàng mới nhất toàn quán trong kỳ
  const recentStoreOrders = useMemo(() => {
    return [...ordersInPeriod]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10);
  }, [ordersInPeriod]);

  // Tra cứu tên nhân viên xử lý của 1 đơn hàng
  const resolveOrderStaffName = useCallback(
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

  // Xuất file Excel tổng hợp toàn cửa hàng (.xls UTF-8)
  const handleExportStoreExcel = () => {
    if (ordersInPeriod.length === 0) {
      showToast('error', 'Không có dữ liệu đơn hàng trong kỳ để xuất báo cáo Excel.');
      return;
    }

    setExporting(true);
    try {
      const periodText =
        activeRange.start && activeRange.end
          ? `${formatShortDate(activeRange.start)} - ${formatShortDate(activeRange.end)}`
          : 'Toàn thời gian';
      const exportedAt = formatDateTime(new Date().toISOString());

      const staffRows =
        staffPerformanceList.length > 0
          ? staffPerformanceList
              .map(
                (st, idx) => `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td>${escapeHtml(st.name)}</td>
                  <td>${escapeHtml(st.email)}</td>
                  <td style="text-align:right;">${st.orderCount}</td>
                  <td style="text-align:right;">${st.itemsSold}</td>
                  <td style="text-align:right;font-weight:bold;">${st.revenue}</td>
                  <td style="text-align:right;">${st.sharePercent}%</td>
                </tr>`
              )
              .join('')
          : `<tr><td colspan="7" style="text-align:center;">Chưa có dữ liệu nhân viên</td></tr>`;

      const topProductRows =
        topStoreProducts.length > 0
          ? topStoreProducts
              .map(
                (p, idx) => `
                <tr>
                  <td style="text-align:center;">${idx + 1}</td>
                  <td>${escapeHtml(p.name)}</td>
                  <td style="text-align:right;">${p.quantity}</td>
                  <td style="text-align:right;">${Number(p.revenue || 0)}</td>
                </tr>`
              )
              .join('')
          : `<tr><td colspan="4" style="text-align:center;">Chưa có dữ liệu sản phẩm</td></tr>`;

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
              <td>${escapeHtml(resolveOrderStaffName(ord))}</td>
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
            <tr><td colspan="10" class="title">BÁO CÁO TỔNG HỢP KINH DOANH TOÀN CỬA HÀNG - CF SHOP</td></tr>
            <tr><td colspan="10" class="meta"><strong>Người xuất báo cáo:</strong> ${escapeHtml(
              adminEmail
            )} &nbsp;|&nbsp; <strong>Kỳ báo cáo:</strong> ${escapeHtml(
              periodText
            )} &nbsp;|&nbsp; <strong>Thời điểm xuất:</strong> ${escapeHtml(exportedAt)}</td></tr>
          </table>

          <table>
            <tr><th colspan="4" class="section-title">I. TỔNG HỢP CHỈ SỐ TOÀN CỬA HÀNG</th></tr>
            <tr>
              <th>Chỉ tiêu</th>
              <th>Giá trị</th>
              <th>Chỉ tiêu</th>
              <th>Giá trị</th>
            </tr>
            <tr>
              <td>Tổng đơn hàng phát sinh</td>
              <td style="text-align:right;font-weight:bold;">${storeKpi.totalOrders}</td>
              <td>Tổng tạm tính (đơn hoàn thành)</td>
              <td style="text-align:right;">${storeKpi.grossSubtotal}</td>
            </tr>
            <tr>
              <td>Đơn hoàn thành / Tỷ lệ hoàn tất</td>
              <td style="text-align:right;font-weight:bold;">${storeKpi.completedCount} (${
        storeKpi.completionRate
      }%)</td>
              <td>Tổng giảm giá / khuyến mãi</td>
              <td style="text-align:right;">${storeKpi.totalDiscount}</td>
            </tr>
            <tr>
              <td>Tổng sản lượng ly / món bán ra</td>
              <td style="text-align:right;font-weight:bold;">${storeKpi.totalItemsSold}</td>
              <td>Doanh thu thực thu toàn quán</td>
              <td style="text-align:right;font-weight:bold;color:#047857;">${
                storeKpi.netRevenue
              }</td>
            </tr>
            <tr>
              <td>Khách hàng mới / Tổng khách hệ thống</td>
              <td style="text-align:right;">+${storeKpi.newCustomersInPeriod} / ${
        storeKpi.totalCustomers
      }</td>
              <td>Giá trị trung bình / đơn</td>
              <td style="text-align:right;">${Math.round(storeKpi.avgOrderValue)}</td>
            </tr>
          </table>

          <table>
            <tr><th colspan="7" class="section-title">II. HIỆU SUẤT DOANH THU THEO TỪNG NHÂN VIÊN</th></tr>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Nhân viên / Nguồn đơn</th>
              <th>Email</th>
              <th style="text-align:right;">Số đơn hoàn thành</th>
              <th style="text-align:right;">Số ly / món</th>
              <th style="text-align:right;">Doanh thu (VNĐ)</th>
              <th style="text-align:right;">Tỷ trọng</th>
            </tr>
            ${staffRows}
          </table>

          <table>
            <tr><th colspan="4" class="section-title">III. TOP SẢN PHẨM BÁN CHẠY TOÀN CỬA HÀNG</th></tr>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Tên món</th>
              <th style="text-align:right;">Số lượng bán</th>
              <th style="text-align:right;">Doanh thu (VNĐ)</th>
            </tr>
            ${topProductRows}
          </table>

          <table>
            <tr><th colspan="10" class="section-title">IV. CHI TIẾT ĐƠN HÀNG TOÀN QUÁN (${
              ordersInPeriod.length
            } ĐƠN)</th></tr>
            <tr>
              <th style="width:45px;text-align:center;">STT</th>
              <th>Mã đơn</th>
              <th>Thời gian</th>
              <th>Nhân viên phụ trách</th>
              <th>Hình thức / Bàn</th>
              <th>Chi tiết món</th>
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
      const fileTag =
        activeRange.start && activeRange.end
          ? `${toInputDateString(activeRange.start)}_${toInputDateString(activeRange.end)}`
          : 'ToanThoiGian';

      link.href = url;
      link.download = `BaoCaoToanCuaHang_CFShop_${fileTag}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(
        'success',
        `Đã xuất file Excel báo cáo toàn cửa hàng (${ordersInPeriod.length} đơn).`
      );
    } catch {
      showToast('error', 'Không thể xuất file Excel, vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Banner Header Tổng quan Quản trị */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-7 shadow-sm">
        <div className="absolute -right-12 -top-12 w-60 h-60 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 w-44 h-44 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 text-xs font-semibold">
              <Store className="w-3.5 h-3.5" />
              <span>Admin Dashboard • Toàn quyền tổng hợp dữ liệu cửa hàng</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
              <LayoutDashboard className="w-7 h-7 text-amber-400 shrink-0" />
              <span>Tổng quan Kinh doanh Toàn quán</span>
            </h1>
            <p className="text-sm text-stone-300 max-w-2xl">
              Theo dõi doanh thu hợp nhất, hiệu suất từng nhân viên, cơ cấu kênh phục vụ
              và sản phẩm chủ lực của toàn bộ hệ thống CF Shop.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              disabled={initialLoading || exporting || ordersInPeriod.length === 0}
              onClick={handleExportStoreExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-stone-700 disabled:text-stone-400 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{exporting ? 'Đang xuất...' : 'Xuất Excel toàn quán'}</span>
            </button>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchStoreDashboardData({ isInitial: false })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới dữ liệu</span>
            </button>
          </div>
        </div>

        {/* Thanh chọn khoảng thời gian */}
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

      {/* 4 Thẻ KPI Toàn Cửa Hàng */}
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
          {/* KPI 1: Doanh thu thực thu toàn quán */}
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
                {formatPrice(storeKpi.netRevenue)}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                TB/đơn:{' '}
                <strong className="text-stone-700">
                  {formatPrice(storeKpi.avgOrderValue)}
                </strong>
                {storeKpi.totalDiscount > 0 && (
                  <span> • Giảm: {formatCompactPrice(storeKpi.totalDiscount)}</span>
                )}
              </p>
            </div>
          </div>

          {/* KPI 2: Tổng đơn hàng toàn quán */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Đơn hàng toàn quán
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-stone-800">
                {storeKpi.completedCount}{' '}
                <span className="text-sm font-semibold text-stone-400">
                  / {storeKpi.totalOrders} đơn
                </span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Hoàn tất: <strong className="text-amber-800">{storeKpi.completionRate}%</strong>
                {' • '}
                Đang mở: <strong className="text-sky-700">{storeKpi.activeProcessingCount}</strong>
              </p>
            </div>
          </div>

          {/* KPI 3: Tổng sản lượng món đã bán */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Sản lượng tiêu thụ
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Coffee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-stone-800">
                {storeKpi.totalItemsSold}{' '}
                <span className="text-sm font-semibold text-stone-500">ly / món</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Đơn hủy toàn quán:{' '}
                <strong className="text-rose-600">{storeKpi.cancelledCount} đơn</strong>
              </p>
            </div>
          </div>

          {/* KPI 4: Tài khoản khách hàng & Nhân sự */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Khách hàng & Nhân sự
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-extrabold text-stone-800">
                {storeKpi.totalCustomers}{' '}
                <span className="text-sm font-semibold text-stone-500">khách hàng</span>
              </p>
              <p className="text-xs text-stone-500 mt-1">
                {datePreset !== 'ALL' && (
                  <>
                    Mới kỳ này:{' '}
                    <strong className="text-emerald-700">
                      +{storeKpi.newCustomersInPeriod}
                    </strong>
                    {' • '}
                  </>
                )}
                Nhân sự mở:{' '}
                <strong className="text-stone-700">
                  {storeKpi.activeStaffCount}/{storeKpi.totalStaff}
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hàng 2: Biểu đồ doanh thu toàn quán (7 cột) + Cơ cấu kênh & thanh toán (5 cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Biểu đồ doanh thu */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-700" />
              <span>
                {datePreset === 'TODAY'
                  ? 'Biểu đồ doanh thu toàn quán theo khung giờ hôm nay'
                  : 'Biểu đồ doanh thu toàn quán theo ngày'}
              </span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Tổng hợp thực thu từ toàn bộ nhân viên và đơn trực tuyến đã hoàn thành
            </p>
          </div>

          {storeKpi.completedCount === 0 ? (
            <div className="py-16 text-center text-xs text-stone-400 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200">
              Chưa có đơn hàng hoàn thành nào trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div className="pt-4">
              <div className="h-56 flex items-end gap-2 sm:gap-2.5 px-1 border-b border-stone-200 pb-2 overflow-x-auto">
                {revenueChartSeries.map((bar) => {
                  const heightPercent =
                    bar.revenue > 0
                      ? Math.max(8, Math.round((bar.revenue / maxChartRevenue) * 100))
                      : 2;
                  return (
                    <div
                      key={bar.key}
                      className="flex-1 min-w-[32px] h-full flex flex-col items-center justify-end group relative"
                    >
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-11 z-10 px-2.5 py-1 rounded-lg bg-stone-900 text-white text-[11px] whitespace-nowrap shadow-md">
                        <strong>{formatPrice(bar.revenue)}</strong> ({bar.orderCount} đơn)
                      </div>

                      <span className="text-[10px] font-semibold text-stone-500 mb-1">
                        {bar.revenue > 0 ? formatCompactPrice(bar.revenue) : ''}
                      </span>

                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[36px] rounded-t-xl transition-all duration-300 ${
                          bar.revenue > 0
                            ? 'bg-gradient-to-t from-amber-800 to-amber-500 group-hover:from-amber-900 group-hover:to-amber-600'
                            : 'bg-stone-100'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 px-1 pt-2 overflow-x-auto">
                {revenueChartSeries.map((bar) => (
                  <div
                    key={bar.key}
                    className="flex-1 min-w-[32px] text-center text-[11px] font-medium text-stone-500 truncate"
                  >
                    {bar.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cơ cấu kênh phục vụ & Phương thức thanh toán */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs flex flex-col justify-between space-y-5">
          {/* Kênh phục vụ */}
          <div className="space-y-3">
            <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-700" />
              <span>Cơ cấu kênh phục vụ</span>
            </h2>

            <div className="space-y-2.5">
              {storeOperationsBreakdown.channelList.map((ch) => (
                <div
                  key={ch.key}
                  className="p-3 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">
                      {ch.label} ({ch.count} đơn)
                    </span>
                    <span className="font-extrabold text-amber-800">
                      {formatPrice(ch.revenue)} ({ch.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-stone-200/80 overflow-hidden">
                    <div
                      style={{ width: `${ch.percent}%` }}
                      className={`h-full rounded-full ${
                        ch.key === 'DINE_IN'
                          ? 'bg-amber-700'
                          : ch.key === 'TAKEAWAY'
                            ? 'bg-sky-600'
                            : 'bg-emerald-600'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phương thức thanh toán */}
          <div className="pt-4 border-t border-stone-100 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Doanh thu theo phương thức thanh toán</span>
            </h3>

            {storeOperationsBreakdown.paymentList.length === 0 ? (
              <p className="text-xs text-stone-400">Chưa có giao dịch hoàn tất.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {storeOperationsBreakdown.paymentList.map((pm) => (
                  <div
                    key={pm.label}
                    className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-stone-50"
                  >
                    <span className="font-semibold text-stone-700">
                      {pm.label} <span className="text-stone-400">({pm.count} đơn)</span>
                    </span>
                    <span className="font-extrabold text-stone-900">
                      {formatPrice(pm.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hàng 3: Hiệu suất từng nhân viên toàn quán (7 cột) + Top 5 món bán chạy toàn quán (5 cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hiệu suất nhân viên */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
                <UserCog className="w-4 h-4 text-amber-700" />
                <span>Hiệu suất doanh thu theo nhân viên</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Tổng hợp số đơn hoàn thành và doanh thu đóng góp của từng nhân sự
              </p>
            </div>

            <Link
              to="/admin/accounts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline shrink-0"
            >
              <span>Quản lý nhân sự</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {staffPerformanceList.length === 0 ? (
            <div className="py-14 text-center text-xs text-stone-400 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200">
              Chưa có dữ liệu đơn hoàn thành của nhân viên trong kỳ này.
            </div>
          ) : (
            <div className="space-y-3">
              {staffPerformanceList.map((st, idx) => (
                <div
                  key={st.key}
                  className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/70 space-y-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center shrink-0 ${
                          idx === 0
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {idx + 1}
                      </span>

                      {st.avatarUrl ? (
                        <img
                          src={st.avatarUrl}
                          alt={st.name}
                          className="w-9 h-9 rounded-full object-cover border border-stone-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(st.name, st.email)}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-stone-800 truncate">
                          {st.name}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {st.orderCount} đơn • {st.itemsSold} ly/món
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs sm:text-sm font-extrabold text-emerald-700">
                        {formatPrice(st.revenue)}
                      </p>
                      <p className="text-[11px] font-semibold text-stone-500">
                        {st.sharePercent}% doanh thu quán
                      </p>
                    </div>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-stone-200/80 overflow-hidden">
                    <div
                      style={{ width: `${Math.max(4, st.sharePercent)}%` }}
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 sản phẩm bán chạy toàn quán */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-700" />
                <span>Top 5 món bán chạy toàn quán</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Xếp hạng theo tổng sản lượng tiêu thụ toàn cửa hàng
              </p>
            </div>

            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline shrink-0"
            >
              <span>Thực đơn</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {topStoreProducts.length === 0 ? (
            <div className="py-14 text-center text-xs text-stone-400 bg-stone-50/70 rounded-2xl border border-dashed border-stone-200">
              Chưa có dữ liệu món bán ra trong kỳ.
            </div>
          ) : (
            <div className="space-y-3">
              {topStoreProducts.map((prod, idx) => {
                const maxQty = topStoreProducts[0]?.quantity || 1;
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

      {/* Hàng 4: Bảng 10 đơn hàng mới nhất toàn cửa hàng */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-stone-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Đơn hàng mới nhất toàn cửa hàng</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Hiển thị 10 giao dịch gần nhất trên toàn hệ thống trong kỳ đang chọn
            </p>
          </div>

          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-colors self-start sm:self-center"
          >
            <span>Xem tất cả đơn hàng ({ordersInPeriod.length})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentStoreOrders.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-500">
            Chưa có đơn hàng nào trong khoảng thời gian đã chọn.
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
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thực thu</th>
                  <th className="py-3.5 px-5 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recentStoreOrders.map((ord) => {
                  const stKey = (ord.status || 'PENDING').toUpperCase();
                  const stMeta =
                    ORDER_STATUS_META[stKey] || ORDER_STATUS_META.PENDING;
                  const typeKey = (ord.orderType || 'DINE_IN').toUpperCase();

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className="hover:bg-amber-50/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono font-extrabold text-amber-800 text-xs">
                        {ord.orderCode || `#${ord.id}`}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        {formatDateTime(ord.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {resolveOrderStaffName(ord)}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        {ord.tableNumber
                          ? `Tại bàn (${ord.tableNumber})`
                          : ORDER_TYPE_LABEL[typeKey] || typeKey}
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
                            setSelectedOrder(ord);
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
      </div>

      {/* Modal Xem chi tiết đơn hàng */}
      {selectedOrder && (
        <div
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-stone-800">
                  Chi tiết đơn {selectedOrder.orderCode || `#${selectedOrder.id}`}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  {formatDateTime(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Nhân viên phụ trách:</span>
                  <strong className="text-stone-800">
                    {resolveOrderStaffName(selectedOrder)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Hình thức:</span>
                  <strong className="text-stone-800">
                    {selectedOrder.tableNumber
                      ? `Tại bàn (${selectedOrder.tableNumber})`
                      : ORDER_TYPE_LABEL[
                          (selectedOrder.orderType || 'DINE_IN').toUpperCase()
                        ] || selectedOrder.orderType}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Trạng thái:</span>
                  <strong className="text-stone-800">
                    {ORDER_STATUS_META[
                      (selectedOrder.status || 'PENDING').toUpperCase()
                    ]?.label || selectedOrder.status}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold uppercase tracking-wider text-stone-500">
                  Danh sách món
                </p>
                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
                  {(Array.isArray(selectedOrder.orderItems)
                    ? selectedOrder.orderItems
                    : []
                  ).map((it, i) => (
                    <div
                      key={it.id || i}
                      className="p-3 bg-white flex items-center justify-between gap-2"
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

              <div className="pt-3 border-t border-stone-200 space-y-1.5">
                <div className="flex justify-between text-stone-500">
                  <span>Tạm tính:</span>
                  <span>
                    {formatPrice(selectedOrder.subtotal ?? selectedOrder.finalAmount)}
                  </span>
                </div>
                {Number(selectedOrder.discountAmount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Giảm giá:</span>
                    <span>-{formatPrice(selectedOrder.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-stone-900 pt-1">
                  <span>Thực thu:</span>
                  <span>
                    {formatPrice(selectedOrder.finalAmount ?? selectedOrder.subtotal)}
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

export default AdminDashboardPage;