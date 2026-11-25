import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarCheck,
  Users,
  Clock,
  MapPin,
  Coffee,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShoppingBag,
  FileText,
  Sparkles,
  Check,
  Trash2,
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
    label: 'Bàn trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    selectable: true,
  },
  RESERVED: {
    label: 'Đã đặt trước',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    selectable: false,
  },
  OCCUPIED: {
    label: 'Đang có khách',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    selectable: false,
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
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
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  COMPLETED: {
    label: 'Đã nhận bàn',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  CANCELLED: {
    label: 'Đã hủy',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
  },
};

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const getDefaultDateTimeLocal = () => {
  const target = new Date(Date.now() + 60 * 60 * 1000);
  target.setMinutes(Math.ceil(target.getMinutes() / 15) * 15, 0, 0);
  const local = new Date(target.getTime() - target.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  const [activeTab, setActiveTab] = useState('BOOK'); // 'BOOK' | 'HISTORY'

  // Dữ liệu khu vực & bàn
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [loadingTables, setLoadingTables] = useState(true);

  // Lịch sử đặt bàn của khách hàng
  const [myReservations, setMyReservations] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form đặt bàn
  const [selectedTableIds, setSelectedTableIds] = useState([]);
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
    () => Array.isArray(location.state?.preselectedItems) && location.state.preselectedItems.length > 0
  );

  // Trạng thái gửi form
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);

  const fetchTablesAndAreas = useCallback(async () => {
    setLoadingTables(true);
    try {
      const [areaRes, tableRes] = await Promise.all([
        areaService.getAllAreasList(),
        tableService.getAllTables(),
      ]);
      setAreas(Array.isArray(areaRes?.result) ? areaRes.result : []);
      setTables(Array.isArray(tableRes?.result) ? tableRes.result : []);
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách khu vực và bàn.');
    } finally {
      setLoadingTables(false);
    }
  }, []);

  const fetchMyReservations = useCallback(async () => {
    if (!accountId) return;
    setLoadingHistory(true);
    try {
      const res = await reservationService.getReservationsByAccount(accountId);
      const list = Array.isArray(res?.result) ? res.result : [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.reservationTime || b.createdAt) - new Date(a.reservationTime || a.createdAt)
      );
      setMyReservations(sorted);
    } catch (err) {
      console.error('Lỗi tải lịch đặt bàn:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchTablesAndAreas();
    fetchMyReservations();
  }, [fetchTablesAndAreas, fetchMyReservations]);

  const filteredTables = useMemo(() => {
    if (selectedAreaId === 'ALL') return tables;
    return tables.filter((t) => Number(t.areaId) === Number(selectedAreaId));
  }, [tables, selectedAreaId]);

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

  const toggleSelectTable = (table) => {
    const statusKey = (table.status || 'AVAILABLE').toUpperCase();
    const config = TABLE_STATUS_CONFIG[statusKey] || TABLE_STATUS_CONFIG.AVAILABLE;
    if (!config.selectable) return;

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

    if (!accountId) {
      setError('Không xác định được tài khoản. Vui lòng đăng nhập lại.');
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
    if (chosenDate <= new Date()) {
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

      await Promise.all([fetchTablesAndAreas(), fetchMyReservations()]);
    } catch (err) {
      setError(err?.message || 'Đặt bàn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    setCancellingId(reservationId);
    try {
      await reservationService.updateReservationStatus(reservationId, 'CANCELLED');
      await Promise.all([fetchMyReservations(), fetchTablesAndAreas()]);
    } catch (err) {
      setError(err?.message || 'Không thể hủy lịch đặt bàn.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Đầu trang & Chuyển tab */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full mb-2">
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Đặt bàn trực tuyến</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight">
            Giữ chỗ & Chọn vị trí yêu thích
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Chọn khu vực yên tĩnh, bàn nhóm và đặt trước đồ uống để phục vụ ngay khi bạn tới
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-stone-100 border border-stone-200 self-start sm:self-center">
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
            onClick={() => setActiveTab('HISTORY')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-white text-amber-800 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Lịch của tôi</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-900">
              {myReservations.length}
            </span>
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
          <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-2xs p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-800" />
                <h2 className="text-base font-bold text-stone-800">1. Chọn bàn trên sơ đồ</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Bàn trống
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                  Đang chọn
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                  Đã có khách / Đặt trước
                </span>
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
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Tất cả khu vực ({tables.length})
              </button>

              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(area.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                    Number(selectedAreaId) === Number(area.id)
                      ? 'bg-amber-700 text-white'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {area.name}
                </button>
              ))}
            </div>

            {/* Lưới bàn */}
            {loadingTables ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {[...Array(6)].map((_, idx) => (
                  <div
                    key={idx}
                    className="h-28 rounded-2xl bg-stone-100 border border-stone-200 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="py-12 text-center text-sm text-stone-500">
                Chưa có bàn nào trong khu vực này.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {filteredTables.map((table) => {
                  const statusKey = (table.status || 'AVAILABLE').toUpperCase();
                  const statusCfg =
                    TABLE_STATUS_CONFIG[statusKey] || TABLE_STATUS_CONFIG.AVAILABLE;
                  const isSelected = selectedTableIds.includes(Number(table.id));

                  return (
                    <button
                      key={table.id}
                      type="button"
                      disabled={!statusCfg.selectable}
                      onClick={() => toggleSelectTable(table)}
                      className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between min-h-[116px] ${
                        isSelected
                          ? 'border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/30 cursor-pointer'
                          : statusCfg.selectable
                            ? 'border-stone-200 bg-white hover:border-amber-400 hover:shadow-2xs cursor-pointer'
                            : 'border-stone-200 bg-stone-50/80 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-extrabold text-stone-800">
                            {table.tableNumber}
                          </p>
                          <p className="text-[11px] text-stone-500 mt-0.5">
                            {table.areaName || 'Khu vực chung'}
                          </p>
                        </div>

                        {isSelected ? (
                          <span className="w-6 h-6 rounded-full bg-amber-700 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.badgeClass}`}
                          >
                            {statusCfg.label}
                          </span>
                        )}
                      </div>

                      <div className="pt-3 flex items-center gap-1.5 text-xs font-medium text-stone-600">
                        <Users className="w-3.5 h-3.5 text-amber-700" />
                        <span>Sức chứa {table.capacity} chỗ</span>
                      </div>
                    </button>
                  );
                })}
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
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">Bàn đã chọn:</span>
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold"
                    >
                      {t.tableNumber} ({t.capacity} chỗ)
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
                        Đặt trước {preselectedItems.reduce((s, i) => s + i.quantity, 0)} món từ khay
                        chọn ({formatPrice(preorderSubtotal)})
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
                      <div key={item.key} className="flex items-center justify-between">
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
              <span>{submitting ? 'Đang gửi yêu cầu...' : 'Xác nhận đặt bàn'}</span>
            </button>
          </form>
        </div>
      ) : (
        /* Tab 2: Lịch đặt bàn của tôi */
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-28 bg-white rounded-2xl border border-stone-200 animate-pulse"
                />
              ))}
            </div>
          ) : myReservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center space-y-3">
              <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-800">Bạn chưa có lịch đặt bàn nào</h3>
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
              {myReservations.map((resv) => {
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

                      <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <Users className="w-4 h-4 text-amber-700" />
                          <span>{resv.guestCount} khách</span>
                        </span>

                        {Array.isArray(resv.tables) && resv.tables.length > 0 && (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <MapPin className="w-4 h-4 text-amber-700" />
                            <span>
                              Bàn: {resv.tables.map((t) => t.tableNumber).join(', ')}
                            </span>
                          </span>
                        )}
                      </div>

                      {resv.note && (
                        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                          Ghi chú: {resv.note}
                        </p>
                      )}
                    </div>

                    {canCancel && (
                      <div className="pt-3 border-t border-stone-100 flex justify-end">
                        <button
                          type="button"
                          disabled={cancellingId === resv.id}
                          onClick={() => handleCancelReservation(resv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>
                            {cancellingId === resv.id ? 'Đang hủy...' : 'Hủy lịch đặt bàn'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservationsPage;