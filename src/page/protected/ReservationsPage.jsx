import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Users,
  Clock,
  MapPin,
  Coffee,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Sparkles,
  Check,
  RefreshCw,
  Search,
  UtensilsCrossed,
  Wrench,
  X,
  RotateCcw,
} from 'lucide-react';
import areaService from '../../service/areaService';
import tableService from '../../service/tableService';
import reservationService from '../../service/reservationService';
import orderService from '../../service/orderService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const CART_STORAGE_KEY = 'cf_menu_selection';

const TABLE_STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Còn trống',
    shortLabel: 'Trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Sparkles,
    selectable: true,
  },
  OCCUPIED: {
    label: 'Đang có khách',
    shortLabel: 'Có khách',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: UtensilsCrossed,
    selectable: false,
  },
  RESERVED: {
    label: 'Đã đặt trước',
    shortLabel: 'Đã đặt',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    icon: CalendarCheck,
    selectable: false,
  },
  MAINTENANCE: {
    label: 'Tạm ngưng',
    shortLabel: 'Tạm ngưng',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
    icon: Wrench,
    selectable: false,
  },
};

const RESERVATION_STATUS_CONFIG = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  COMPLETED: {
    label: 'Đã nhận bàn',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
  },
};

const GUEST_PRESETS = [2, 4, 6, 8];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const toDateTimeLocalString = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const getDefaultDateTimeLocal = () => {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  target.setMinutes(Math.ceil(target.getMinutes() / 15) * 15, 0, 0);
  return toDateTimeLocalString(target);
};

const formatDateTimeDisplay = (isoStr) => {
  if (!isoStr) return '—';
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return isoStr;
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

const ReservationsPage = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const claims = useMemo(() => (token ? parseJwt(token) : null), [token]);
  const accountId = useMemo(() => {
    const rawId =
      claims?.accountId ?? claims?.id ?? claims?.userId ?? user?.accountId ?? user?.id;
    return rawId != null && !isNaN(Number(rawId)) ? Number(rawId) : null;
  }, [claims, user]);

  // Tab chính: 'BOOK' | 'HISTORY'
  const [activeTab, setActiveTab] = useState(() =>
    location.state?.tab === 'HISTORY' && accountId ? 'HISTORY' : 'BOOK'
  );

  // Dữ liệu khu vực & sơ đồ bàn
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [tableStatusFilter, setTableStatusFilter] = useState('ALL');
  const [tableKeyword, setTableKeyword] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Lịch sử đặt bàn của khách hàng
  const [myReservations, setMyReservations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resvStatusFilter, setResvStatusFilter] = useState('ALL');
  const [cancellingId, setCancellingId] = useState(null);

  // Form đặt bàn
  const [selectedTableIds, setSelectedTableIds] = useState(() => {
    const incoming = location.state?.preselectedTableIds;
    return Array.isArray(incoming) ? incoming.map(Number) : [];
  });
  const [guestCount, setGuestCount] = useState(2);
  const [reservationTime, setReservationTime] = useState(getDefaultDateTimeLocal);
  const [note, setNote] = useState('');

  // Món đặt trước từ MenuPage (tùy chọn)
  const [preselectedItems, setPreselectedItems] = useState(() => {
    const fromState = location.state?.preselectedItems;
    if (Array.isArray(fromState) && fromState.length > 0) return fromState;
    return loadStoredCart();
  });
  const [includePreorder, setIncludePreorder] = useState(
    () =>
      Array.isArray(location.state?.preselectedItems) &&
      location.state.preselectedItems.length > 0
  );

  // Trạng thái thao tác & thông báo
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
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

  const fetchTablesAndAreas = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [areaRes, tableRes] = await Promise.all([
          areaService.getAllAreasList().catch(() => ({ result: [] })),
          tableService.getAllTables(),
        ]);

        const fetchedAreas = Array.isArray(areaRes?.result) ? areaRes.result : [];
        const fetchedTables = Array.isArray(tableRes?.result) ? tableRes.result : [];

        setAreas(fetchedAreas);
        setTables(fetchedTables);

        // Loại bỏ khỏi danh sách đang chọn nếu bàn đó không còn trống
        const availableSet = new Set(
          fetchedTables
            .filter((t) => (t.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE')
            .map((t) => Number(t.id))
        );
        setSelectedTableIds((prev) => prev.filter((id) => availableSet.has(Number(id))));
      } catch (err) {
        setError(err?.message || 'Không thể tải danh sách khu vực và bàn.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const fetchMyReservations = useCallback(async () => {
    if (!accountId) {
      setMyReservations([]);
      return;
    }

    setLoadingHistory(true);
    try {
      const res = await reservationService.getReservationsByAccount(accountId);
      const list = Array.isArray(res?.result) ? res.result : [];
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.reservationTime || b.createdAt || 0) -
          new Date(a.reservationTime || a.createdAt || 0)
      );
      setMyReservations(sorted);
    } catch (err) {
      showToast('error', err?.message || 'Không thể tải lịch đặt bàn của bạn.');
    } finally {
      setLoadingHistory(false);
    }
  }, [accountId, showToast]);

  useEffect(() => {
    fetchTablesAndAreas({ isInitial: true });
  }, [fetchTablesAndAreas]);

  useEffect(() => {
    if (accountId) {
      fetchMyReservations();
    }
  }, [accountId, fetchMyReservations]);

  const areaNameById = useMemo(() => {
    const map = {};
    areas.forEach((a) => {
      map[Number(a.id)] = a.name;
    });
    return map;
  }, [areas]);

  const tableCountsByStatus = useMemo(() => {
    const counts = {
      ALL: tables.length,
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
    };
    tables.forEach((t) => {
      const key = (t.status || 'AVAILABLE').toUpperCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [tables]);

  const availableCountByArea = useMemo(() => {
    const counts = {};
    tables.forEach((t) => {
      if ((t.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE') {
        const key = t.areaId != null ? String(t.areaId) : 'UNASSIGNED';
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [tables]);

  const filteredTables = useMemo(() => {
    const q = tableKeyword.trim().toLowerCase();
    return [...tables]
      .sort((a, b) =>
        String(a.tableNumber || '').localeCompare(String(b.tableNumber || ''), 'vi', {
          numeric: true,
        })
      )
      .filter((t) => {
        const st = (t.status || 'AVAILABLE').toUpperCase();
        const matchArea =
          selectedAreaId === 'ALL' || Number(t.areaId) === Number(selectedAreaId);
        const matchStatus = tableStatusFilter === 'ALL' || st === tableStatusFilter;
        const areaLabel = t.areaName || areaNameById[Number(t.areaId)] || '';
        const matchKeyword =
          !q ||
          (t.tableNumber || '').toLowerCase().includes(q) ||
          areaLabel.toLowerCase().includes(q) ||
          `${t.capacity} cho`.includes(q) ||
          `${t.capacity} ghe`.includes(q);

        return matchArea && matchStatus && matchKeyword;
      });
  }, [tables, selectedAreaId, tableStatusFilter, tableKeyword, areaNameById]);

  const groupedByArea = useMemo(() => {
    const groups = new Map();
    filteredTables.forEach((t) => {
      const areaLabel =
        t.areaName || areaNameById[Number(t.areaId)] || 'Khu vực chung';
      if (!groups.has(areaLabel)) {
        groups.set(areaLabel, []);
      }
      groups.get(areaLabel).push(t);
    });
    return Array.from(groups.entries());
  }, [filteredTables, areaNameById]);

  const selectedTables = useMemo(
    () => tables.filter((t) => selectedTableIds.includes(Number(t.id))),
    [tables, selectedTableIds]
  );

  const totalSelectedCapacity = useMemo(
    () => selectedTables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0),
    [selectedTables]
  );

  const preorderSubtotal = useMemo(
    () =>
      preselectedItems.reduce(
        (sum, item) => sum + (Number(item.basePrice) || 0) * Number(item.quantity || 1),
        0
      ),
    [preselectedItems]
  );

  const activeHistoryCount = useMemo(
    () =>
      myReservations.filter((r) => {
        const st = (r.status || '').toUpperCase();
        return st === 'PENDING' || st === 'CONFIRMED';
      }).length,
    [myReservations]
  );

  const filteredMyReservations = useMemo(() => {
    if (resvStatusFilter === 'ALL') return myReservations;
    return myReservations.filter(
      (r) => (r.status || 'PENDING').toUpperCase() === resvStatusFilter
    );
  }, [myReservations, resvStatusFilter]);

  const hasActiveTableFilters = Boolean(
    tableKeyword.trim() || tableStatusFilter !== 'ALL' || selectedAreaId !== 'ALL'
  );

  const handleResetTableFilters = () => {
    setTableKeyword('');
    setTableStatusFilter('ALL');
    setSelectedAreaId('ALL');
  };

  const toggleSelectTable = (table) => {
    const statusKey = (table.status || 'AVAILABLE').toUpperCase();
    const config = TABLE_STATUS_CONFIG[statusKey] || TABLE_STATUS_CONFIG.AVAILABLE;
    if (!config.selectable) {
      showToast('error', `Bàn ${table.tableNumber} hiện không trống, vui lòng chọn bàn khác.`);
      return;
    }

    const idNum = Number(table.id);
    setSelectedTableIds((prev) =>
      prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
    );
    if (error) setError('');
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessInfo(null);

    if (!token || !accountId) {
      showToast('error', 'Vui lòng đăng nhập tài khoản khách hàng để hoàn tất đặt bàn.');
      navigate('/login');
      return;
    }

    if (selectedTableIds.length === 0) {
      setError('Vui lòng chọn ít nhất 1 bàn trống trên sơ đồ.');
      return;
    }

    if (!reservationTime) {
      setError('Vui lòng chọn ngày và giờ đến quán.');
      return;
    }

    const chosenDate = new Date(reservationTime);
    if (isNaN(chosenDate.getTime()) || chosenDate <= new Date()) {
      setError('Thời gian đặt bàn phải nằm trong tương lai.');
      return;
    }

    if (Number(guestCount) < 1) {
      setError('Số lượng khách phải từ 1 người trở lên.');
      return;
    }

    setSubmitting(true);

    try {
      const formattedDateTime =
        reservationTime.length === 16 ? `${reservationTime}:00` : reservationTime;

      const tableLabels = selectedTables.map((t) => t.tableNumber).join(', ');
      const preorderNote =
        includePreorder && preselectedItems.length > 0
          ? `[Có đặt trước ${preselectedItems.reduce((s, i) => s + i.quantity, 0)} món]`
          : '';
      const combinedNote = [note.trim(), preorderNote].filter(Boolean).join(' ');

      // 1. Tạo lịch đặt bàn (POST /api/reservations)
      const reservationPayload = {
        accountId: Number(accountId),
        guestCount: Number(guestCount),
        reservationTime: formattedDateTime,
        note: combinedNote || null,
        status: 'PENDING',
        tableIds: selectedTableIds,
      };

      const res = await reservationService.createReservation(reservationPayload);
      const createdReservation = res?.result;

      // 2. Nếu khách chọn kèm món đặt trước -> tạo đơn DINE_IN gắn vào bàn đầu tiên
      let createdPreorder = null;
      if (includePreorder && preselectedItems.length > 0) {
        const orderPayload = {
          orderType: 'DINE_IN',
          status: 'PENDING',
          tableId: Number(selectedTableIds[0]),
          customerAccountId: Number(accountId),
          items: preselectedItems.map((item) => ({
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            selectedOptions: item.note?.trim() || null,
          })),
        };

        const orderRes = await orderService.createOrder(orderPayload).catch(() => null);
        createdPreorder = orderRes?.result || null;

        if (createdPreorder) {
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
          } catch {
            // Bỏ qua lỗi storage
          }
          setPreselectedItems([]);
          setIncludePreorder(false);
        }
      }

      setSuccessInfo({
        reservation: createdReservation,
        tableLabels,
        preorder: createdPreorder,
      });
      setSelectedTableIds([]);
      setNote('');
      showToast('success', 'Gửi yêu cầu đặt bàn thành công!');

      await Promise.all([fetchTablesAndAreas({ isInitial: false }), fetchMyReservations()]);
    } catch (err) {
      setError(err?.message || 'Đặt bàn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    if (!window.confirm(`Bạn chắc chắn muốn hủy lịch đặt bàn #${reservationId}?`)) {
      return;
    }

    setCancellingId(reservationId);
    try {
      await reservationService.updateReservationStatus(reservationId, 'CANCELLED');
      showToast('success', `Đã hủy lịch đặt bàn #${reservationId}.`);
      await Promise.all([fetchMyReservations(), fetchTablesAndAreas({ isInitial: false })]);
    } catch (err) {
      showToast('error', err?.message || 'Không thể hủy lịch đặt bàn.');
    } finally {
      setCancellingId(null);
    }
  };

  const renderTableCard = (table) => {
    const statusKey = (table.status || 'AVAILABLE').toUpperCase();
    const statusCfg = TABLE_STATUS_CONFIG[statusKey] || TABLE_STATUS_CONFIG.AVAILABLE;
    const StatusIcon = statusCfg.icon;
    const areaLabel =
      table.areaName || areaNameById[Number(table.areaId)] || 'Khu vực chung';
    const isSelected = selectedTableIds.includes(Number(table.id));

    return (
      <button
        key={table.id}
        type="button"
        disabled={!statusCfg.selectable}
        onClick={() => toggleSelectTable(table)}
        className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[124px] ${
          isSelected
            ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/30 cursor-pointer'
            : statusCfg.selectable
              ? 'border-emerald-200/90 bg-white hover:border-amber-400 hover:shadow-2xs cursor-pointer'
              : 'border-stone-200 bg-stone-50/80 opacity-65 cursor-not-allowed'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-extrabold text-stone-800 truncate">
              {table.tableNumber}
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5 truncate">{areaLabel}</p>
          </div>

          {isSelected ? (
            <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusCfg.badgeClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{statusCfg.shortLabel}</span>
            </span>
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-stone-600">
            <Users className="w-3.5 h-3.5 text-amber-700" />
            <span>{table.capacity} chỗ</span>
          </span>

          {isSelected ? (
            <span className="font-bold text-amber-800">Đang chọn</span>
          ) : statusCfg.selectable ? (
            <span className="font-semibold text-emerald-700">Chọn bàn +</span>
          ) : (
            <span className="text-stone-400">{statusCfg.label}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-14">
      {/* Đầu trang & Chuyển tab */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full mb-2">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Đặt bàn trực tuyến</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
            Sơ đồ chỗ ngồi & Đặt bàn trước
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Chọn không gian yêu thích, kiểm tra bàn trống theo thời gian thực và đặt trước đồ uống
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <div className="inline-flex p-1 rounded-xl bg-stone-100 border border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab('BOOK')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'BOOK'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Đặt bàn mới
            </button>

            <button
              type="button"
              onClick={() => {
                if (!token || !accountId) {
                  showToast('error', 'Vui lòng đăng nhập để xem lịch đặt bàn của bạn.');
                  navigate('/login');
                  return;
                }
                setActiveTab('HISTORY');
                fetchMyReservations();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <span>Lịch của tôi</span>
              {accountId && (
                <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900">
                  {activeHistoryCount > 0 ? activeHistoryCount : myReservations.length}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            disabled={refreshing || loadingHistory}
            onClick={() =>
              activeTab === 'BOOK'
                ? fetchTablesAndAreas({ isInitial: false })
                : fetchMyReservations()
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing || loadingHistory ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successInfo && activeTab === 'BOOK' && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Gửi yêu cầu đặt bàn thành công!</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className="text-xs font-semibold underline text-emerald-800 hover:text-emerald-950 cursor-pointer shrink-0"
            >
              Xem lịch sử đặt bàn →
            </button>
          </div>
          <p className="text-sm text-emerald-800">
            Bàn đã chọn: <strong>{successInfo.tableLabels}</strong> • Thời gian:{' '}
            <strong>{formatDateTimeDisplay(successInfo.reservation?.reservationTime)}</strong> •{' '}
            <strong>{successInfo.reservation?.guestCount} khách</strong>.
            {successInfo.preorder && (
              <>
                {' '}
                Đã tạo kèm đơn đặt món trước mã{' '}
                <strong className="font-mono">{successInfo.preorder.orderCode}</strong>.
              </>
            )}
          </p>
        </div>
      )}

      {activeTab === 'BOOK' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cột trái (7 phần): Sơ đồ chọn bàn theo khu vực */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-800" />
                <h2 className="text-base font-bold text-stone-800">1. Chọn bàn trên sơ đồ</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Còn trống ({tableCountsByStatus.AVAILABLE})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  Đang chọn ({selectedTableIds.length})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                  Không khả dụng
                </span>
              </div>
            </div>

            {/* Lọc trạng thái & tìm kiếm bàn */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: `Tất cả (${tableCountsByStatus.ALL})` },
                  { key: 'AVAILABLE', label: `Còn trống (${tableCountsByStatus.AVAILABLE})` },
                  { key: 'OCCUPIED', label: `Có khách (${tableCountsByStatus.OCCUPIED})` },
                  { key: 'RESERVED', label: `Đã đặt (${tableCountsByStatus.RESERVED})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTableStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      tableStatusFilter === tab.key
                        ? 'bg-stone-800 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-52">
                <input
                  type="text"
                  value={tableKeyword}
                  onChange={(e) => setTableKeyword(e.target.value)}
                  placeholder="Tìm số bàn, số chỗ..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Lọc theo khu vực */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedAreaId('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedAreaId === 'ALL'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                Tất cả khu vực ({tableCountsByStatus.AVAILABLE} trống)
              </button>

              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(String(area.id))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    String(selectedAreaId) === String(area.id)
                      ? 'bg-amber-700 text-white'
                      : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {area.name} ({availableCountByArea[String(area.id)] || 0} trống)
                </button>
              ))}
            </div>

            {/* Lưới bàn */}
            {initialLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[...Array(6)].map((_, idx) => (
                  <div
                    key={idx}
                    className="h-28 rounded-2xl bg-stone-100 border border-stone-200 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="py-12 text-center space-y-2.5">
                <p className="text-sm text-stone-500">
                  Không tìm thấy bàn nào phù hợp với bộ lọc hiện tại.
                </p>
                {hasActiveTableFilters && (
                  <button
                    type="button"
                    onClick={handleResetTableFilters}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Đặt lại bộ lọc</span>
                  </button>
                )}
              </div>
            ) : selectedAreaId === 'ALL' ? (
              <div className="space-y-5 pt-1">
                {groupedByArea.map(([areaName, areaTables]) => (
                  <section key={areaName} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-stone-600">
                        {areaName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-bold">
                        {areaTables.length} bàn
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {areaTables.map((table) => renderTableCard(table))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                {filteredTables.map((table) => renderTableCard(table))}
              </div>
            )}
          </div>

          {/* Cột phải (5 phần): Thông tin thời gian, số khách & xác nhận */}
          <form
            onSubmit={handleCreateReservation}
            className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-4 lg:sticky lg:top-20"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <Clock className="w-5 h-5 text-amber-800" />
              <h2 className="text-base font-bold text-stone-800">2. Thông tin lịch hẹn</h2>
            </div>

            {/* Tóm tắt bàn đang chọn */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">
                  Bàn đã chọn ({selectedTables.length}):
                </span>
                <span className="font-semibold text-stone-700">
                  Tổng sức chứa: {totalSelectedCapacity} chỗ
                </span>
              </div>

              {selectedTables.length === 0 ? (
                <p className="text-xs font-medium text-amber-800">
                  Chưa chọn bàn nào (bấm vào bàn trống bên trái để chọn)
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {selectedTables.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold"
                    >
                      <span>
                        {t.tableNumber} ({t.capacity} chỗ)
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSelectTable(t)}
                        title="Bỏ chọn bàn này"
                        className="text-amber-800 hover:text-amber-950 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="reservationTime"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Thời gian đến <span className="text-red-500">*</span>
                </label>
                <input
                  id="reservationTime"
                  type="datetime-local"
                  min={toDateTimeLocalString(new Date())}
                  value={reservationTime}
                  onChange={(e) => setReservationTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="guestCount"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Số lượng khách <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="guestCount"
                    type="number"
                    min={1}
                    max={50}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                  <Users className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {GUEST_PRESETS.map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setGuestCount(num)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                        Number(guestCount) === num
                          ? 'bg-amber-700 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {num} người
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedTables.length > 0 && Number(guestCount) > totalSelectedCapacity && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Số khách ({guestCount}) đang lớn hơn sức chứa bàn đã chọn ({totalSelectedCapacity}{' '}
                chỗ). Bạn có thể chọn thêm 1 bàn ghép cạnh nhau.
              </p>
            )}

            <div>
              <label htmlFor="note" className="block text-sm font-medium text-stone-700 mb-1">
                Ghi chú cho quán (tùy chọn)
              </label>
              <div className="relative">
                <input
                  id="note"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Cần ổ cắm điện, bàn gần cửa sổ..."
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                />
                <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Khối đặt món trước nếu khách đã chọn món ở MenuPage */}
            {preselectedItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePreorder}
                    onChange={(e) => setIncludePreorder(e.target.checked)}
                    className="mt-0.5 rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-amber-950 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        Đặt trước {preselectedItems.reduce((s, i) => s + i.quantity, 0)} món từ
                        khay chọn ({formatPrice(preorderSubtotal)})
                      </span>
                    </p>
                    <p className="text-amber-900/80 mt-0.5">
                      Quán sẽ chuẩn bị sẵn đồ uống đúng giờ bạn đến.
                    </p>
                  </div>
                </label>

                {includePreorder && (
                  <div className="pl-6 space-y-1 text-xs text-stone-700 border-t border-amber-200/70 pt-2">
                    {preselectedItems.map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {item.quantity}x {item.name}
                          {item.note ? ` (${item.note})` : ''}
                        </span>
                        <span className="font-semibold shrink-0">
                          {formatPrice(item.basePrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>
                {submitting
                  ? 'Đang gửi yêu cầu...'
                  : token && accountId
                    ? 'Xác nhận đặt bàn'
                    : 'Đăng nhập để đặt bàn'}
              </span>
            </button>
          </form>
        </div>
      ) : (
        /* Tab 2: Lịch đặt bàn của tôi (4 trạng thái: PENDING, CONFIRMED, COMPLETED, CANCELLED) */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: `Tất cả (${myReservations.length})` },
              {
                key: 'PENDING',
                label: `Chờ xác nhận (${
                  myReservations.filter((r) => r.status === 'PENDING').length
                })`,
              },
              {
                key: 'CONFIRMED',
                label: `Đã xác nhận (${
                  myReservations.filter((r) => r.status === 'CONFIRMED').length
                })`,
              },
              {
                key: 'COMPLETED',
                label: `Đã nhận bàn (${
                  myReservations.filter((r) => r.status === 'COMPLETED').length
                })`,
              },
              {
                key: 'CANCELLED',
                label: `Đã hủy (${
                  myReservations.filter((r) => r.status === 'CANCELLED').length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setResvStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  resvStatusFilter === tab.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-28 bg-white rounded-2xl border border-stone-200 animate-pulse"
                />
              ))}
            </div>
          ) : filteredMyReservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center space-y-3">
              <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-800">
                Chưa có lịch đặt bàn nào phù hợp
              </h3>
              <p className="text-sm text-stone-500">
                Chọn bàn trống và đặt trước chỗ ngồi yêu thích ngay hôm nay.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('BOOK')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Đặt bàn ngay
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMyReservations.map((resv) => {
                const statusKey = (resv.status || 'PENDING').toUpperCase();
                const cfg =
                  RESERVATION_STATUS_CONFIG[statusKey] || RESERVATION_STATUS_CONFIG.PENDING;
                const canCancel = statusKey === 'PENDING' || statusKey === 'CONFIRMED';

                return (
                  <div
                    key={resv.id}
                    className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-xs font-mono text-stone-400">
                            Lịch hẹn #{resv.id}
                          </span>
                          <h3 className="text-base font-bold text-stone-800 mt-0.5">
                            {formatDateTimeDisplay(resv.reservationTime)}
                          </h3>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Users className="w-4 h-4 text-amber-700" />
                          <span>{resv.guestCount} khách</span>
                        </span>

                        {Array.isArray(resv.tables) && resv.tables.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {resv.tables.map((t) => (
                              <span
                                key={t.id}
                                className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-900 font-semibold"
                              >
                                Bàn {t.tableNumber} ({t.areaName || 'Chung'})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {resv.note && (
                        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                          Ghi chú: {resv.note}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
                      <span>Tạo lúc: {formatDateTimeDisplay(resv.createdAt)}</span>

                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingId === resv.id}
                          onClick={() => handleCancelReservation(resv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>
                            {cancellingId === resv.id ? 'Đang hủy...' : 'Hủy lịch đặt bàn'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

export default ReservationsPage;