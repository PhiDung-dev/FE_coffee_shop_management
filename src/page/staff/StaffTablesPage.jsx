import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  RefreshCw,
  ShoppingBag,
  CalendarCheck,
  X,
  CheckCircle2,
  AlertCircle,
  UtensilsCrossed,
  MapPin,
  Search,
  Sparkles,
  Wrench,
  Clock,
  ExternalLink,
  Check,
  UserCheck,
  Ban,
  LayoutGrid,
} from 'lucide-react';
import areaService from '../../service/areaService';
import tableService from '../../service/tableService';
import orderService from '../../service/orderService';
import reservationService from '../../service/reservationService';

const STATUS_META = {
  AVAILABLE: {
    label: 'Bàn trống',
    shortLabel: 'Trống',
    cardClass: 'border-emerald-200/90 bg-white hover:border-emerald-400 hover:-translate-y-0.5',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
    icon: Sparkles,
  },
  OCCUPIED: {
    label: 'Đang phục vụ',
    shortLabel: 'Có khách',
    cardClass: 'border-amber-300/90 bg-amber-50/35 hover:border-amber-500 hover:-translate-y-0.5',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    icon: UtensilsCrossed,
  },
  RESERVED: {
    label: 'Đã đặt trước',
    shortLabel: 'Đặt trước',
    cardClass: 'border-sky-200/90 bg-sky-50/30 hover:border-sky-400 hover:-translate-y-0.5',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
    icon: CalendarCheck,
  },
  MAINTENANCE: {
    label: 'Tạm ngưng / Bảo trì',
    shortLabel: 'Bảo trì',
    cardClass: 'border-stone-200 bg-stone-100/75 opacity-85 hover:border-stone-400',
    badgeClass: 'bg-stone-200 text-stone-700 border-stone-300',
    dotClass: 'bg-stone-400',
    icon: Wrench,
  },
};

const ORDER_STATUS_LABEL = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang pha chế',
  DELIVERING: 'Đang giao',
};

const RESERVATION_STATUS_META = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
  },
};

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
  });
};

const StaffTablesPage = () => {
  const navigate = useNavigate();

  // Dữ liệu từ API
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);

  // Bộ lọc
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [keyword, setKeyword] = useState('');

  // Trạng thái tải & thông báo
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Modal chi tiết bàn
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingResvId, setUpdatingResvId] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast({ type: '', message: '' });
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Tải đồng thời Khu vực + Bàn + Lịch đặt bàn
  const fetchBoardData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [areaRes, tableRes, resvRes] = await Promise.all([
          areaService.getAllAreasList().catch(() => ({ result: [] })),
          tableService.getAllTables(),
          reservationService.getAllReservations().catch(() => ({ result: [] })),
        ]);

        setAreas(Array.isArray(areaRes?.result) ? areaRes.result : []);
        setTables(Array.isArray(tableRes?.result) ? tableRes.result : []);
        setReservations(Array.isArray(resvRes?.result) ? resvRes.result : []);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải dữ liệu sơ đồ bàn.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchBoardData({ isInitial: true });
  }, [fetchBoardData]);

  const areaNameById = useMemo(() => {
    const map = {};
    areas.forEach((a) => {
      map[Number(a.id)] = a.name;
    });
    return map;
  }, [areas]);

  // Gom các lịch đặt đang hiệu lực (PENDING / CONFIRMED) theo từng tableId, sắp xếp gần nhất trước
  const activeReservationsByTableId = useMemo(() => {
    const map = {};
    const activeList = reservations
      .filter((r) => {
        const st = (r.status || '').toUpperCase();
        return st === 'PENDING' || st === 'CONFIRMED';
      })
      .sort((a, b) => new Date(a.reservationTime || 0) - new Date(b.reservationTime || 0));

    activeList.forEach((r) => {
      if (Array.isArray(r.tables)) {
        r.tables.forEach((rt) => {
          const tId = Number(rt.id);
          if (!map[tId]) map[tId] = [];
          map[tId].push(r);
        });
      }
    });

    return map;
  }, [reservations]);

  const countsByStatus = useMemo(() => {
    const counts = {
      ALL: tables.length,
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      MAINTENANCE: 0,
    };
    tables.forEach((t) => {
      const key = (t.status || 'AVAILABLE').toUpperCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [tables]);

  const tableCountByArea = useMemo(() => {
    const counts = {};
    tables.forEach((t) => {
      const key = t.areaId != null ? String(t.areaId) : 'UNASSIGNED';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tables]);

  const filteredTables = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return [...tables]
      .sort((a, b) =>
        String(a.tableNumber || '').localeCompare(String(b.tableNumber || ''), 'vi', {
          numeric: true,
        })
      )
      .filter((t) => {
        const matchArea =
          selectedAreaId === 'ALL' || Number(t.areaId) === Number(selectedAreaId);
        const matchStatus =
          statusFilter === 'ALL' || (t.status || 'AVAILABLE').toUpperCase() === statusFilter;
        const areaLabel = t.areaName || areaNameById[Number(t.areaId)] || '';
        const matchKeyword =
          !q ||
          (t.tableNumber || '').toLowerCase().includes(q) ||
          areaLabel.toLowerCase().includes(q);

        return matchArea && matchStatus && matchKeyword;
      });
  }, [tables, selectedAreaId, statusFilter, keyword, areaNameById]);

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

  const handleOpenTableDetail = async (table) => {
    setSelectedTable(table);
    setLoadingOrders(true);
    setTableOrders([]);

    try {
      const [ordersRes, resvRes] = await Promise.all([
        orderService.getAllOrders({
          tableId: table.id,
          page: 0,
          size: 10,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
        reservationService.getAllReservations().catch(() => null),
      ]);

      const rawOrders = ordersRes?.result;
      const orders = Array.isArray(rawOrders?.content)
        ? rawOrders.content
        : Array.isArray(rawOrders)
          ? rawOrders
          : [];
      const activeOrders = orders.filter(
        (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
      );
      setTableOrders(activeOrders);

      if (Array.isArray(resvRes?.result)) {
        setReservations(resvRes.result);
      }
    } catch {
      showToast('error', 'Không thể tải danh sách đơn hàng tại bàn này.');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Đổi trạng thái bàn thủ công (PATCH /api/tables/{id}/status)
  const handleChangeTableStatus = async (newStatus) => {
    if (!selectedTable) return;
    const currentStatus = (selectedTable.status || 'AVAILABLE').toUpperCase();
    if (currentStatus === newStatus) return;

    setUpdatingStatus(true);
    try {
      const res = await tableService.updateTableStatus(selectedTable.id, newStatus);
      const updated = res?.result || {
        ...selectedTable,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showToast(
        'success',
        `Bàn ${selectedTable.tableNumber} → ${STATUS_META[newStatus]?.label || newStatus}`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái bàn.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Xử lý nhanh lịch đặt bàn ngay trong modal (PATCH /api/reservations/{id}/status)
  const handleReservationAction = async (reservation, nextResvStatus, nextTableStatus = null) => {
    setUpdatingResvId(reservation.id);
    try {
      const res = await reservationService.updateReservationStatus(
        reservation.id,
        nextResvStatus
      );
      const updatedResv = res?.result || {
        ...reservation,
        status: nextResvStatus,
        updatedAt: new Date().toISOString(),
      };

      setReservations((prev) =>
        prev.map((item) => (item.id === reservation.id ? updatedResv : item))
      );

      // Đồng bộ trạng thái bàn tương ứng nếu cần
      if (nextTableStatus && selectedTable) {
        const currentTableSt = (selectedTable.status || 'AVAILABLE').toUpperCase();
        if (currentTableSt !== nextTableStatus) {
          const tableRes = await tableService.updateTableStatus(
            selectedTable.id,
            nextTableStatus
          );
          const updatedTable = tableRes?.result || {
            ...selectedTable,
            status: nextTableStatus,
          };
          setSelectedTable(updatedTable);
          setTables((prev) =>
            prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
          );
        }
      }

      const actionMessages = {
        CONFIRMED: `Đã xác nhận lịch đặt #${reservation.id}.`,
        COMPLETED: `Khách đã nhận bàn ${selectedTable?.tableNumber || ''}.`,
        CANCELLED: `Đã hủy lịch đặt #${reservation.id}.`,
      };
      showToast('success', actionMessages[nextResvStatus] || 'Đã cập nhật lịch đặt bàn.');
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái lịch đặt bàn.');
    } finally {
      setUpdatingResvId(null);
    }
  };

  const renderTableCard = (table) => {
    const statusKey = (table.status || 'AVAILABLE').toUpperCase();
    const meta = STATUS_META[statusKey] || STATUS_META.AVAILABLE;
    const StatusIcon = meta.icon;
    const areaLabel =
      table.areaName || areaNameById[Number(table.areaId)] || 'Khu vực chung';

    const upcomingResvs = activeReservationsByTableId[Number(table.id)] || [];
    const nearestResv = upcomingResvs[0];

    return (
      <div
        key={table.id}
        onClick={() => handleOpenTableDetail(table)}
        className={`p-4 rounded-2xl border transition-all shadow-2xs hover:shadow-sm cursor-pointer flex flex-col justify-between min-h-[156px] ${meta.cardClass}`}
      >
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
              <h3 className="text-lg font-extrabold text-stone-800">{table.tableNumber}</h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border shrink-0 ${meta.badgeClass}`}
            >
              <StatusIcon className="w-3 h-3" />
              <span>{meta.shortLabel}</span>
            </span>
          </div>

          <p className="text-xs text-stone-500 flex items-center gap-1 truncate pl-4">
            <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">{areaLabel}</span>
          </p>

          {/* Cảnh báo nếu bàn có lịch đặt trước */}
          {nearestResv && (
            <div className="mt-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/80 text-[11px] text-sky-900 flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 font-semibold truncate">
                <CalendarCheck className="w-3 h-3 text-sky-600 shrink-0" />
                <span className="truncate">{formatDateTime(nearestResv.reservationTime)}</span>
              </span>
              {upcomingResvs.length > 1 && (
                <span className="font-bold text-sky-700 shrink-0">
                  +{upcomingResvs.length - 1}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 mt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-stone-600">
            <Users className="w-3.5 h-3.5 text-amber-700" />
            <span>{table.capacity} chỗ</span>
          </span>

          <span className="font-semibold text-amber-800">Thao tác →</span>
        </div>
      </div>
    );
  };

  const selectedTableStatus = (selectedTable?.status || 'AVAILABLE').toUpperCase();
  const isSelectedTableMaintenance = selectedTableStatus === 'MAINTENANCE';
  const selectedTableReservations = selectedTable
    ? activeReservationsByTableId[Number(selectedTable.id)] || []
    : [];

  return (
    <div className="space-y-6 pb-14">
      {/* Header nổi bật đồng bộ màu sắc với các trang khác */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 shadow-md border border-stone-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/25 px-3 py-1 rounded-full">
            <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
            <span>Sơ đồ khu vực & Phục vụ tại quán</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Sơ đồ bàn & Phục vụ tại quầy
          </h1>
          <p className="text-sm text-stone-300 max-w-2xl">
            Theo dõi tình trạng bàn theo khu vực, xử lý lịch đặt trước, xem đơn đang mở và nhận
            order
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          <div className="px-4 py-2 rounded-2xl bg-stone-900/85 border border-stone-700/80 text-xs">
            <span className="text-stone-400 block">Bàn trống</span>
            <span className="text-sm font-extrabold text-emerald-300">
              {countsByStatus.AVAILABLE} / {countsByStatus.ALL} bàn
            </span>
          </div>

          <Link
            to="/staff/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-stone-700 bg-stone-900/80 hover:bg-stone-800 text-xs sm:text-sm font-semibold text-stone-100 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>Danh sách đơn</span>
          </Link>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchBoardData({ isInitial: false })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới sơ đồ</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc trạng thái, khu vực & tìm kiếm */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: `Tất cả (${countsByStatus.ALL})` },
              { key: 'AVAILABLE', label: `Bàn trống (${countsByStatus.AVAILABLE})` },
              { key: 'OCCUPIED', label: `Đang phục vụ (${countsByStatus.OCCUPIED})` },
              { key: 'RESERVED', label: `Đã đặt trước (${countsByStatus.RESERVED})` },
              { key: 'MAINTENANCE', label: `Bảo trì (${countsByStatus.MAINTENANCE})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm số bàn (VD: B01, T1)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pt-2.5 border-t border-stone-100">
          <button
            type="button"
            onClick={() => setSelectedAreaId('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
              selectedAreaId === 'ALL'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            Tất cả khu vực ({tables.length})
          </button>

          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedAreaId(String(area.id))}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                String(selectedAreaId) === String(area.id)
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              {area.name} ({tableCountByArea[String(area.id)] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Lưới thẻ bàn */}
      {initialLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-14 text-center text-sm text-stone-500">
          Không có bàn nào khớp với bộ lọc hiện tại.
        </div>
      ) : selectedAreaId === 'ALL' ? (
        <div className="space-y-6">
          {groupedByArea.map(([areaName, areaTables]) => (
            <section key={areaName} className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-700">
                  {areaName}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 text-xs font-bold">
                  {areaTables.length} bàn
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {areaTables.map((table) => renderTableCard(table))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredTables.map((table) => renderTableCard(table))}
        </div>
      )}

      {/* Modal thông tin chi tiết bàn & Thao tác nhanh */}
      {selectedTable && (
        <div
          onClick={() => setSelectedTable(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-extrabold text-stone-800">
                    Bàn {selectedTable.tableNumber}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      (STATUS_META[selectedTableStatus] || STATUS_META.AVAILABLE).badgeClass
                    }`}
                  >
                    {(STATUS_META[selectedTableStatus] || STATUS_META.AVAILABLE).label}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {selectedTable.areaName ||
                    areaNameById[Number(selectedTable.areaId)] ||
                    'Khu vực chung'}{' '}
                  - Sức chứa {selectedTable.capacity} người
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Đổi trạng thái bàn nhanh */}
              <div className="space-y-2">
                <span className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                  Cập nhật trạng thái bàn
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(STATUS_META).map(([key, meta]) => {
                    const active = selectedTableStatus === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={updatingStatus || active}
                        onClick={() => handleChangeTableStatus(key)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          active
                            ? 'bg-amber-700 text-white border-amber-700 cursor-default'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400 disabled:opacity-50'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            active ? 'bg-white' : meta.dotClass
                          }`}
                        />
                        <span>{meta.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lịch đặt trước liên quan + Nút xử lý nhanh */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Lịch đặt trước ({selectedTableReservations.length})</span>
                </h3>

                {selectedTableReservations.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                    Không có lịch đặt trước nào cho bàn này.
                  </p>
                ) : (
                  selectedTableReservations.map((r) => {
                    const rStatus = (r.status || 'PENDING').toUpperCase();
                    const rMeta =
                      RESERVATION_STATUS_META[rStatus] || RESERVATION_STATUS_META.PENDING;
                    const isBusy = updatingResvId === r.id;
                    const linkedTables = Array.isArray(r.tables) ? r.tables : [];

                    return (
                      <div
                        key={r.id}
                        className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold text-stone-800">
                            <span>{formatDateTime(r.reservationTime)}</span>
                            <span className="px-2 py-0.5 rounded bg-white border border-sky-200 text-sky-800">
                              {r.guestCount} khách
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${rMeta.badgeClass}`}
                          >
                            {rMeta.label}
                          </span>
                        </div>

                        <p className="text-stone-700">
                          Khách:{' '}
                          <strong>
                            {r.accountPhone || r.accountEmail || `Tài khoản #${r.accountId}`}
                          </strong>
                        </p>

                        {linkedTables.length > 1 && (
                          <p className="text-stone-600">
                            Đặt ghép ({linkedTables.length} bàn):{' '}
                            <strong>
                              {linkedTables.map((t) => t.tableNumber).join(', ')}
                            </strong>
                          </p>
                        )}

                        {r.note && (
                          <p className="text-stone-500 italic bg-white/80 px-2.5 py-1.5 rounded-lg border border-sky-100">
                            Ghi chú: {r.note}
                          </p>
                        )}

                        {/* Thao tác nhanh với lịch đặt */}
                        <div className="pt-1.5 flex flex-wrap items-center gap-2">
                          {rStatus === 'PENDING' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleReservationAction(
                                  r,
                                  'CONFIRMED',
                                  selectedTableStatus === 'AVAILABLE' ? 'RESERVED' : null
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Xác nhận lịch</span>
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleReservationAction(r, 'COMPLETED', 'OCCUPIED')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Khách nhận bàn</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleReservationAction(
                                r,
                                'CANCELLED',
                                selectedTableStatus === 'RESERVED' &&
                                  selectedTableReservations.length === 1
                                  ? 'AVAILABLE'
                                  : null
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Hủy lịch</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Đơn hàng đang mở tại bàn */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                    <span>Đơn hàng đang mở tại bàn ({tableOrders.length})</span>
                  </h3>
                  {tableOrders.length > 0 && (
                    <Link
                      to="/staff/orders"
                      onClick={() => setSelectedTable(null)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:underline"
                    >
                      <span>Quản lý đơn</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {loadingOrders ? (
                  <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
                ) : tableOrders.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                    Hiện chưa có đơn hàng nào đang phục vụ tại bàn này.
                  </p>
                ) : (
                  tableOrders.map((ord) => {
                    const items = Array.isArray(ord.orderItems) ? ord.orderItems : [];
                    return (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-extrabold text-amber-800">
                            {ord.orderCode || `#${ord.id}`}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                            {ORDER_STATUS_LABEL[ord.status] || ord.status}
                          </span>
                        </div>

                        {items.length > 0 && (
                          <p className="text-stone-600 line-clamp-2">
                            {items
                              .map((it) => `${it.productName} (x${it.quantity})`)
                              .join(', ')}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-stone-200/70 text-stone-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDateTime(ord.createdAt)}</span>
                          </span>
                          <strong className="text-stone-900 text-sm">
                            {formatPrice(ord.finalAmount ?? ord.subtotal)}
                          </strong>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-5 border-t border-stone-200 bg-stone-50 space-y-2">
              {isSelectedTableMaintenance && (
                <p className="text-xs text-stone-500 text-center">
                  Bàn đang tạm ngưng phục vụ. Vui lòng chuyển sang <strong>Bàn trống</strong> để
                  nhận order.
                </p>
              )}

              <button
                type="button"
                disabled={isSelectedTableMaintenance}
                onClick={() => {
                  const id = selectedTable.id;
                  setSelectedTable(null);
                  navigate(`/staff/pos?tableId=${id}`);
                }}
                className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>
                  {tableOrders.length > 0
                    ? 'Gọi thêm món / Thanh toán tại bàn'
                    : 'Order trực tiếp tại bàn'}
                </span>
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

export default StaffTablesPage;