import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  Users,
  MapPin,
  Phone,
  Mail,
  Check,
  XCircle,
  UtensilsCrossed,
  RefreshCw,
  Search,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import reservationService from '../../service/reservationService';
import tableService from '../../service/tableService';

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'COMPLETED', label: 'Đã nhận bàn' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_META = {
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

const StaffReservationsPage = () => {
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reservationService.getAllReservations();
      const list = Array.isArray(res?.result) ? res.result : [];
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.reservationTime || b.createdAt) - new Date(a.reservationTime || a.createdAt)
      );
      setReservations(sorted);
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách đặt bàn.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: reservations.length,
      PENDING: 0,
      CONFIRMED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    reservations.forEach((r) => {
      const key = (r.status || 'PENDING').toUpperCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      const matchStatus =
        statusFilter === 'ALL' || (r.status || 'PENDING').toUpperCase() === statusFilter;
      const q = keyword.trim().toLowerCase();
      const matchKey =
        !q ||
        String(r.id).includes(q) ||
        (r.accountPhone || '').toLowerCase().includes(q) ||
        (r.accountEmail || '').toLowerCase().includes(q) ||
        (Array.isArray(r.tables) &&
          r.tables.some((t) => (t.tableNumber || '').toLowerCase().includes(q)));
      return matchStatus && matchKey;
    });
  }, [reservations, statusFilter, keyword]);

  const handleConfirm = async (resv) => {
    setProcessingId(resv.id);
    try {
      await reservationService.updateReservationStatus(resv.id, 'CONFIRMED');
      if (Array.isArray(resv.tables)) {
        await Promise.all(
          resv.tables.map((t) => tableService.updateTableStatus(t.id, 'RESERVED').catch(() => null))
        );
      }
      await fetchReservations();
    } catch (err) {
      setError(err?.message || 'Không thể xác nhận lịch đặt bàn.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckInAndOrder = async (resv) => {
    setProcessingId(resv.id);
    try {
      await reservationService.updateReservationStatus(resv.id, 'COMPLETED');
      if (Array.isArray(resv.tables) && resv.tables.length > 0) {
        await Promise.all(
          resv.tables.map((t) => tableService.updateTableStatus(t.id, 'OCCUPIED').catch(() => null))
        );
        navigate(`/staff/pos?tableId=${resv.tables[0].id}`);
        return;
      }
      await fetchReservations();
    } catch (err) {
      setError(err?.message || 'Không thể check-in bàn.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (resv) => {
    setProcessingId(resv.id);
    try {
      await reservationService.updateReservationStatus(resv.id, 'CANCELLED');
      if (Array.isArray(resv.tables)) {
        await Promise.all(
          resv.tables.map((t) =>
            tableService.updateTableStatus(t.id, 'AVAILABLE').catch(() => null)
          )
        );
      }
      await fetchReservations();
    } catch (err) {
      setError(err?.message || 'Không thể hủy lịch đặt bàn.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header nổi bật đồng bộ màu sắc với các trang khác */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 shadow-md border border-stone-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/25 px-3 py-1 rounded-full">
            <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
            <span>Điều phối đặt bàn & Tiếp đón khách</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản lý lịch đặt bàn
          </h1>
          <p className="text-sm text-stone-300 max-w-2xl">
            Xác nhận giữ chỗ, hủy lịch hoặc check-in khách vào bàn để order trực tiếp
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 self-start lg:self-center">
          <div className="px-4 py-2 rounded-2xl bg-stone-900/85 border border-stone-700/80 text-xs">
            <span className="text-stone-400 block">Chờ xác nhận</span>
            <span className="text-sm font-extrabold text-amber-300">
              {statusCounts.PENDING} / {statusCounts.ALL} lịch
            </span>
          </div>

          <button
            type="button"
            onClick={fetchReservations}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bộ lọc */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? 'bg-amber-700 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] ${
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

        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm SĐT, email, số bàn..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Danh sách đặt bàn */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-14 text-center text-sm text-stone-500">
          Không tìm thấy lịch đặt bàn nào phù hợp.
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredReservations.map((resv) => {
            const statusKey = (resv.status || 'PENDING').toUpperCase();
            const statusMeta = STATUS_META[statusKey] || STATUS_META.PENDING;
            const isBusy = processingId === resv.id;

            return (
              <div
                key={resv.id}
                className="bg-white rounded-2xl border border-stone-200 hover:border-amber-300 transition-colors p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-stone-400">#{resv.id}</span>
                    <span className="text-base font-extrabold text-stone-800 inline-flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4 text-amber-700" />
                      <span>{formatDateTime(resv.reservationTime)}</span>
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-stone-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-amber-700" />
                      <span>{resv.guestCount} khách</span>
                    </span>

                    <span className="inline-flex items-center gap-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {Array.isArray(resv.tables) && resv.tables.length > 0
                          ? resv.tables.map((t) => t.tableNumber).join(', ')
                          : 'Chưa gắn bàn'}
                      </span>
                    </span>

                    {resv.accountPhone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-stone-400" />
                        <span>{resv.accountPhone}</span>
                      </span>
                    )}

                    {resv.accountEmail && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        <span>{resv.accountEmail}</span>
                      </span>
                    )}
                  </div>

                  {resv.note && (
                    <p className="text-xs text-stone-600 bg-stone-50 border border-stone-200/70 rounded-xl px-3 py-1.5 inline-block">
                      Ghi chú: {resv.note}
                    </p>
                  )}
                </div>

                {/* Hành động */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {statusKey === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleConfirm(resv)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Xác nhận giữ bàn</span>
                    </button>
                  )}

                  {(statusKey === 'PENDING' || statusKey === 'CONFIRMED') && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleCheckInAndOrder(resv)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>Nhận bàn & Order</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleCancel(resv)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Hủy</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffReservationsPage;