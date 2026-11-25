import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  RefreshCw,
  ShoppingBag,
  CalendarCheck,
  X,
  Coffee,
  CheckCircle2,
  AlertCircle,
  UtensilsCrossed,
} from 'lucide-react';
import areaService from '../../service/areaService';
import tableService from '../../service/tableService';
import orderService from '../../service/orderService';
import reservationService from '../../service/reservationService';

const STATUS_META = {
  AVAILABLE: {
    label: 'Bàn trống',
    cardClass: 'border-emerald-200 bg-white hover:border-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  OCCUPIED: {
    label: 'Đang phục vụ',
    cardClass: 'border-red-200 bg-red-50/30 hover:border-red-400',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
  RESERVED: {
    label: 'Đã đặt trước',
    cardClass: 'border-amber-200 bg-amber-50/30 hover:border-amber-400',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    cardClass: 'border-stone-200 bg-stone-100/70 hover:border-stone-400',
    badgeClass: 'bg-stone-200 text-stone-700 border-stone-300',
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

  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal chi tiết bàn
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableOrders, setTableOrders] = useState([]);
  const [tableReservations, setTableReservations] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchBoardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [areaRes, tableRes] = await Promise.all([
        areaService.getAllAreasList(),
        tableService.getAllTables(),
      ]);
      setAreas(Array.isArray(areaRes?.result) ? areaRes.result : []);
      setTables(Array.isArray(tableRes?.result) ? tableRes.result : []);
    } catch (err) {
      setError(err?.message || 'Không thể tải danh sách bàn.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  const countsByStatus = useMemo(() => {
    const counts = { ALL: tables.length, AVAILABLE: 0, OCCUPIED: 0, RESERVED: 0, MAINTENANCE: 0 };
    tables.forEach((t) => {
      const key = (t.status || 'AVAILABLE').toUpperCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [tables]);

  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchArea =
        selectedAreaId === 'ALL' || Number(t.areaId) === Number(selectedAreaId);
      const matchStatus =
        statusFilter === 'ALL' || (t.status || 'AVAILABLE').toUpperCase() === statusFilter;
      return matchArea && matchStatus;
    });
  }, [tables, selectedAreaId, statusFilter]);

  const handleOpenTableDetail = async (table) => {
    setSelectedTable(table);
    setLoadingDetail(true);
    setTableOrders([]);
    setTableReservations([]);

    try {
      const [ordersRes, resvRes] = await Promise.all([
        orderService.getAllOrders({
          tableId: table.id,
          page: 0,
          size: 10,
          sortBy: 'createdAt',
          sortDir: 'desc',
        }),
        reservationService.getAllReservations(),
      ]);

      const orders = Array.isArray(ordersRes?.result?.content) ? ordersRes.result.content : [];
      const activeOrders = orders.filter(
        (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
      );
      setTableOrders(activeOrders);

      const allResv = Array.isArray(resvRes?.result) ? resvRes.result : [];
      const matchedResv = allResv.filter(
        (r) =>
          (r.status === 'PENDING' || r.status === 'CONFIRMED') &&
          Array.isArray(r.tables) &&
          r.tables.some((rt) => Number(rt.id) === Number(table.id))
      );
      setTableReservations(matchedResv);
    } catch (err) {
      console.error('Lỗi tải thông tin bàn:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleChangeTableStatus = async (newStatus) => {
    if (!selectedTable) return;
    setUpdatingStatus(true);
    try {
      const res = await tableService.updateTableStatus(selectedTable.id, newStatus);
      const updated = res?.result || { ...selectedTable, status: newStatus };
      setSelectedTable(updated);
      setTables((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err?.message || 'Không thể cập nhật trạng thái bàn.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800">Sơ đồ & Trạng thái bàn</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Theo dõi tình trạng bàn theo khu vực, xem đơn đang mở và nhận order trực tiếp
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBoardData}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 transition-colors self-start sm:self-center cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới sơ đồ</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bộ lọc trạng thái & khu vực */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
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

        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={() => setSelectedAreaId('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
              selectedAreaId === 'ALL'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            Mọi khu vực
          </button>

          {areas.map((area) => (
            <button
              key={area.id}
              type="button"
              onClick={() => setSelectedAreaId(area.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                Number(selectedAreaId) === Number(area.id)
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              {area.name}
            </button>
          ))}
        </div>
      </div>

      {/* Lưới thẻ bàn */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-white border border-stone-200 animate-pulse" />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-14 text-center text-sm text-stone-500">
          Không có bàn nào khớp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {filteredTables.map((table) => {
            const statusKey = (table.status || 'AVAILABLE').toUpperCase();
            const meta = STATUS_META[statusKey] || STATUS_META.AVAILABLE;

            return (
              <div
                key={table.id}
                onClick={() => handleOpenTableDetail(table)}
                className={`p-4 rounded-2xl border transition-all shadow-2xs cursor-pointer flex flex-col justify-between min-h-[144px] ${meta.cardClass}`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-extrabold text-stone-800">{table.tableNumber}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">{table.areaName || 'Khu vực chung'}</p>
                </div>

                <div className="pt-3 border-t border-stone-200/60 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-stone-600">
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    <span>{table.capacity} chỗ</span>
                  </span>

                  <span className="font-semibold text-amber-800">Chi tiết →</span>
                </div>
              </div>
            );
          })}
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
                <h2 className="text-lg font-extrabold text-stone-800">
                  Thông tin {selectedTable.tableNumber}
                </h2>
                <p className="text-xs text-stone-500">
                  {selectedTable.areaName || 'Khu vực chung'} • Sức chứa {selectedTable.capacity}{' '}
                  người
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
                    const active = (selectedTable.status || 'AVAILABLE').toUpperCase() === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={updatingStatus || active}
                        onClick={() => handleChangeTableStatus(key)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-700 text-white border-amber-700'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Đơn hàng đang mở tại bàn */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-700" />
                  <span>Đơn hàng đang mở tại bàn ({tableOrders.length})</span>
                </h3>

                {loadingDetail ? (
                  <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
                ) : tableOrders.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                    Hiện chưa có đơn hàng nào đang phục vụ tại bàn này.
                  </p>
                ) : (
                  tableOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-800">{ord.orderCode}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                          {ord.status}
                        </span>
                      </div>
                      <p className="text-stone-600">
                        {Array.isArray(ord.orderItems) ? ord.orderItems.length : 0} món • Tổng:{' '}
                        <strong className="text-stone-800">{formatPrice(ord.finalAmount)}</strong>
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Lịch đặt bàn sắp tới */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span>Lịch đặt trước liên quan ({tableReservations.length})</span>
                </h3>

                {loadingDetail ? (
                  <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
                ) : tableReservations.length === 0 ? (
                  <p className="text-xs text-stone-400 bg-stone-50 border border-stone-200/80 rounded-xl p-3">
                    Không có lịch đặt trước nào cho bàn này.
                  </p>
                ) : (
                  tableReservations.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-stone-800">
                        <span>{formatDateTime(r.reservationTime)}</span>
                        <span>{r.guestCount} khách</span>
                      </div>
                      <p className="text-stone-600">
                        Khách: {r.accountPhone || r.accountEmail || `#${r.accountId}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-5 border-t border-stone-200 bg-stone-50 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const id = selectedTable.id;
                  setSelectedTable(null);
                  navigate(`/staff/pos?tableId=${id}`);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>
                  {tableOrders.length > 0 ? 'Gọi thêm món / Thanh toán' : 'Order trực tiếp tại bàn'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffTablesPage;