import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutGrid,
  List,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Users,
  MapPin,
  Clock,
  Wrench,
  CalendarCheck,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import tableService from '../../service/tableService';
import areaService from '../../service/areaService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const TABLE_STATUS_META = {
  AVAILABLE: {
    label: 'Bàn trống',
    shortLabel: 'Trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardAccent: 'border-emerald-200/90 hover:border-emerald-400',
    dotClass: 'bg-emerald-500',
    icon: Sparkles,
  },
  OCCUPIED: {
    label: 'Đang có khách',
    shortLabel: 'Có khách',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    cardAccent: 'border-amber-300/90 bg-amber-50/25 hover:border-amber-500',
    dotClass: 'bg-amber-500',
    icon: UtensilsCrossed,
  },
  RESERVED: {
    label: 'Đã đặt trước',
    shortLabel: 'Đặt trước',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    cardAccent: 'border-sky-200/90 bg-sky-50/20 hover:border-sky-400',
    dotClass: 'bg-sky-500',
    icon: CalendarCheck,
  },
  MAINTENANCE: {
    label: 'Tạm ngưng / Bảo trì',
    shortLabel: 'Tạm ngưng',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-300',
    cardAccent: 'border-stone-200 bg-stone-50/70 opacity-80',
    dotClass: 'bg-stone-400',
    icon: Wrench,
  },
};

const STATUS_OPTIONS = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];
const CAPACITY_PRESETS = [2, 4, 6, 8];

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

const getStatusMeta = (status) => {
  const key = (status || 'AVAILABLE').toUpperCase();
  return (
    TABLE_STATUS_META[key] || {
      label: status || 'Không xác định',
      shortLabel: status || 'Khác',
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
      cardAccent: 'border-stone-200',
      dotClass: 'bg-stone-400',
      icon: LayoutGrid,
    }
  );
};

const INITIAL_TABLE_FORM = {
  tableNumber: '',
  capacity: '4',
  status: 'AVAILABLE',
  areaId: '',
};

const TablesPage = () => {
  const { user, token } = useAuth();
  const claims = token ? parseJwt(token) : null;
  const rawRole = (claims?.role || user?.role || '').toUpperCase();
  const isAdmin = rawRole.includes('ADMIN');

  // Dữ liệu từ API
  const [tables, setTables] = useState([]);
  const [areas, setAreas] = useState([]);

  // Bộ lọc & chế độ hiển thị
  const [selectedAreaId, setSelectedAreaId] = useState('ALL'); // 'ALL' | string(areaId)
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE'
  const [keyword, setKeyword] = useState('');
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID' | 'LIST'

  // Trạng thái UI
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Modal Thêm / Chỉnh sửa bàn
  const [modalState, setModalState] = useState({
    open: false,
    editingTable: null,
    form: INITIAL_TABLE_FORM,
    saving: false,
  });

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

  const fetchData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [tablesRes, areasRes] = await Promise.all([
          tableService.getAllTables(),
          areaService.getAllAreasList().catch(() => ({ result: [] })),
        ]);

        const tableList = Array.isArray(tablesRes?.result) ? tablesRes.result : [];
        const areaList = Array.isArray(areasRes?.result) ? areasRes.result : [];

        setTables(tableList);
        setAreas(areaList);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách bàn.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchData({ isInitial: true });
  }, [fetchData]);

  const areaNameById = useMemo(() => {
    const map = {};
    areas.forEach((a) => {
      map[Number(a.id)] = a.name;
    });
    return map;
  }, [areas]);

  // Thống kê nhanh theo trạng thái & sức chứa
  const stats = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let maintenance = 0;
    let totalSeats = 0;

    tables.forEach((t) => {
      const st = (t.status || 'AVAILABLE').toUpperCase();
      totalSeats += Number(t.capacity || 0);
      if (st === 'AVAILABLE') available += 1;
      else if (st === 'OCCUPIED') occupied += 1;
      else if (st === 'RESERVED') reserved += 1;
      else maintenance += 1;
    });

    return {
      total: tables.length,
      available,
      occupied,
      reserved,
      maintenance,
      totalSeats,
    };
  }, [tables]);

  // Đếm số bàn trên mỗi khu vực
  const tableCountByArea = useMemo(() => {
    const counts = {};
    tables.forEach((t) => {
      const key = t.areaId != null ? String(t.areaId) : 'UNASSIGNED';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [tables]);

  // Danh sách bàn sau khi lọc & sắp xếp theo tên bàn tự nhiên
  const filteredTables = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return [...tables]
      .sort((a, b) =>
        String(a.tableNumber || '').localeCompare(String(b.tableNumber || ''), 'vi', {
          numeric: true,
        })
      )
      .filter((t) => {
        const st = (t.status || 'AVAILABLE').toUpperCase();
        const matchArea =
          selectedAreaId === 'ALL' || String(t.areaId) === String(selectedAreaId);
        const matchStatus = statusFilter === 'ALL' || st === statusFilter;
        const matchKeyword =
          !q ||
          (t.tableNumber || '').toLowerCase().includes(q) ||
          (t.areaName || areaNameById[Number(t.areaId)] || '').toLowerCase().includes(q);

        return matchArea && matchStatus && matchKeyword;
      });
  }, [tables, selectedAreaId, statusFilter, keyword, areaNameById]);

  // Gom nhóm bàn theo khu vực khi ở chế độ Grid và chọn "Tất cả khu vực"
  const groupedByArea = useMemo(() => {
    const groups = new Map();
    filteredTables.forEach((t) => {
      const areaLabel =
        t.areaName || areaNameById[Number(t.areaId)] || 'Chưa phân khu vực';
      if (!groups.has(areaLabel)) {
        groups.set(areaLabel, []);
      }
      groups.get(areaLabel).push(t);
    });
    return Array.from(groups.entries());
  }, [filteredTables, areaNameById]);

  const handleOpenCreate = () => {
    const defaultAreaId =
      selectedAreaId !== 'ALL'
        ? selectedAreaId
        : areas[0]?.id
          ? String(areas[0].id)
          : '';

    setModalState({
      open: true,
      editingTable: null,
      form: {
        ...INITIAL_TABLE_FORM,
        areaId: defaultAreaId,
      },
      saving: false,
    });
  };

  const handleOpenEdit = (table) => {
    setModalState({
      open: true,
      editingTable: table,
      form: {
        tableNumber: table.tableNumber || '',
        capacity: table.capacity ?? '4',
        status: (table.status || 'AVAILABLE').toUpperCase(),
        areaId: table.areaId != null ? String(table.areaId) : '',
      },
      saving: false,
    });
  };

  const handleSaveTable = async (e) => {
    e.preventDefault();
    const { form, editingTable } = modalState;
    const trimmedNumber = form.tableNumber.trim();

    if (!trimmedNumber) {
      showToast('error', 'Vui lòng nhập số bàn / tên bàn.');
      return;
    }
    if (!form.areaId) {
      showToast('error', 'Vui lòng chọn khu vực cho bàn.');
      return;
    }
    const cap = Number(form.capacity);
    if (isNaN(cap) || cap < 1) {
      showToast('error', 'Sức chứa phải lớn hơn hoặc bằng 1 chỗ ngồi.');
      return;
    }

    // Kiểm tra trùng tên bàn ngay trên client
    const duplicated = tables.some(
      (t) =>
        t.id !== editingTable?.id &&
        String(t.tableNumber || '').trim().toLowerCase() === trimmedNumber.toLowerCase()
    );
    if (duplicated) {
      showToast('error', `Số bàn "${trimmedNumber}" đã tồn tại trong hệ thống.`);
      return;
    }

    const payload = {
      tableNumber: trimmedNumber,
      capacity: cap,
      status: form.status || 'AVAILABLE',
      areaId: Number(form.areaId),
    };

    setModalState((prev) => ({ ...prev, saving: true }));
    try {
      if (editingTable) {
        const res = await tableService.updateTable(editingTable.id, payload);
        const updated = res?.result || {
          ...editingTable,
          ...payload,
          areaName: areaNameById[Number(payload.areaId)] || editingTable.areaName,
          updatedAt: new Date().toISOString(),
        };
        setTables((prev) => prev.map((t) => (t.id === editingTable.id ? updated : t)));
        showToast('success', `Đã cập nhật bàn "${payload.tableNumber}".`);
      } else {
        const res = await tableService.createTable(payload);
        if (res?.result) {
          setTables((prev) => [...prev, res.result]);
        } else {
          await fetchData({ isInitial: false });
        }
        showToast('success', `Đã thêm bàn "${payload.tableNumber}".`);
      }

      setModalState({
        open: false,
        editingTable: null,
        form: INITIAL_TABLE_FORM,
        saving: false,
      });
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin bàn.');
      setModalState((prev) => ({ ...prev, saving: false }));
    }
  };

  // Đổi nhanh trạng thái bàn bằng PATCH /api/tables/{id}/status
  const handleQuickStatusChange = async (table, nextStatus) => {
    const currentStatus = (table.status || 'AVAILABLE').toUpperCase();
    if (currentStatus === nextStatus) return;

    setUpdatingStatusId(table.id);
    try {
      const res = await tableService.updateTableStatus(table.id, nextStatus);
      const updated = res?.result || {
        ...table,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
      setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
      showToast(
        'success',
        `Bàn ${table.tableNumber} → ${getStatusMeta(nextStatus).label}`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái bàn.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteTable = async (table) => {
    if (!window.confirm(`Xác nhận xóa bàn "${table.tableNumber}"?`)) return;

    setDeletingId(table.id);
    try {
      await tableService.deleteTable(table.id);
      setTables((prev) => prev.filter((t) => t.id !== table.id));
      showToast('success', `Đã xóa bàn "${table.tableNumber}".`);
    } catch (err) {
      showToast(
        'error',
        err?.message || 'Không thể xóa bàn này (có thể bàn đang gắn với đơn hàng).'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const renderTableCard = (table) => {
    const stKey = (table.status || 'AVAILABLE').toUpperCase();
    const meta = getStatusMeta(stKey);
    const StatusIcon = meta.icon;
    const areaLabel =
      table.areaName || areaNameById[Number(table.areaId)] || 'Chưa phân khu vực';
    const isBusy = updatingStatusId === table.id || deletingId === table.id;

    return (
      <div
        key={table.id}
        className={`bg-white rounded-2xl border p-4 shadow-2xs transition-all flex flex-col justify-between gap-3.5 ${meta.cardAccent}`}
      >
        {/* Hàng trên: Số bàn + Badge trạng thái */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold text-stone-800">
                  {table.tableNumber}
                </span>
                <span className="font-mono text-[11px] text-stone-400">#{table.id}</span>
              </div>
              <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{areaLabel}</span>
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${meta.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5" />
              <span>{meta.shortLabel}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-stone-600 pt-1">
            <span className="inline-flex items-center gap-1 font-semibold bg-stone-100 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5 text-stone-500" />
              <span>{table.capacity} chỗ ngồi</span>
            </span>
          </div>
        </div>

        {/* Chuyển trạng thái nhanh 1 chạm */}
        <div className="pt-2.5 border-t border-stone-100 space-y-2.5">
          <div>
            <span className="block text-[11px] font-semibold text-stone-400 mb-1.5">
              Chuyển trạng thái nhanh:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_OPTIONS.map((opt) => {
                const optMeta = getStatusMeta(opt);
                const isCurrent = stKey === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={isBusy || isCurrent}
                    onClick={() => handleQuickStatusChange(table, opt)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? 'bg-stone-800 text-white cursor-default'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${optMeta.dotClass}`} />
                    <span>{optMeta.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nút Sửa / Xóa dành cho Admin */}
          {isAdmin && (
            <div className="pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleOpenEdit(table)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleDeleteTable(table)}
                title="Xóa bàn"
                className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800">
            Quản lý Bàn & Sơ đồ phục vụ
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Theo dõi tình trạng bàn trống, sắp xếp chỗ ngồi theo khu vực và cập nhật trạng thái
            phục vụ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <Link
              to="/admin/areas"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700"
            >
              <MapPin className="w-4 h-4 text-amber-700" />
              <span>Quản lý khu vực</span>
            </Link>
          )}

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchData({ isInitial: false })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm bàn mới</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Thẻ thống kê nhanh tình trạng bàn */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`bg-white rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-stone-800 ring-1 ring-stone-800'
              : 'border-stone-200 hover:border-stone-300'
          }`}
        >
          <span className="text-xs font-bold uppercase text-stone-500">Tổng số bàn</span>
          <p className="text-2xl font-extrabold text-stone-800 mt-1">{stats.total}</p>
          <p className="text-xs text-stone-500 mt-0.5">Sức chứa: {stats.totalSeats} ghế</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('AVAILABLE')}
          className={`bg-white rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === 'AVAILABLE'
              ? 'border-emerald-600 ring-1 ring-emerald-600'
              : 'border-emerald-200/80 hover:border-emerald-400'
          }`}
        >
          <span className="text-xs font-bold uppercase text-emerald-700">Bàn trống</span>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{stats.available}</p>
          <p className="text-xs text-stone-500 mt-0.5">Sẵn sàng đón khách</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('OCCUPIED')}
          className={`bg-white rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === 'OCCUPIED'
              ? 'border-amber-600 ring-1 ring-amber-600'
              : 'border-amber-200/80 hover:border-amber-400'
          }`}
        >
          <span className="text-xs font-bold uppercase text-amber-800">Đang có khách</span>
          <p className="text-2xl font-extrabold text-amber-800 mt-1">{stats.occupied}</p>
          <p className="text-xs text-stone-500 mt-0.5">Đang phục vụ tại chỗ</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('RESERVED')}
          className={`bg-white rounded-2xl border p-4 text-left shadow-2xs transition-all cursor-pointer ${
            statusFilter === 'RESERVED'
              ? 'border-sky-600 ring-1 ring-sky-600'
              : 'border-sky-200/80 hover:border-sky-400'
          }`}
        >
          <span className="text-xs font-bold uppercase text-sky-700">Đã đặt trước</span>
          <p className="text-2xl font-extrabold text-sky-700 mt-1">{stats.reserved}</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Tạm ngưng: {stats.maintenance} bàn
          </p>
        </button>
      </div>

      {/* Thanh Tabs Khu vực + Tìm kiếm + Đổi chế độ xem */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        {/* Tabs khu vực */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedAreaId('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
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
              onClick={() => setSelectedAreaId(String(area.id))}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                String(selectedAreaId) === String(area.id)
                  ? 'bg-amber-700 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {area.name} ({tableCountByArea[String(area.id)] || 0})
            </button>
          ))}
        </div>

        {/* Dòng dưới: Tìm kiếm + Lọc trạng thái + Chế độ xem */}
        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm số bàn (VD: B01, Tầng 1)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 sm:w-48"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">Bàn trống</option>
              <option value="OCCUPIED">Đang có khách</option>
              <option value="RESERVED">Đã đặt trước</option>
              <option value="MAINTENANCE">Tạm ngưng / Bảo trì</option>
            </select>
          </div>

          <div className="inline-flex rounded-xl bg-stone-100 p-1 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Sơ đồ thẻ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Bảng chi tiết</span>
            </button>
          </div>
        </div>
      </div>

      {/* Nội dung danh sách bàn */}
      {initialLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, idx) => (
            <div
              key={idx}
              className="h-48 rounded-2xl bg-white border border-stone-200 animate-pulse"
            />
          ))}
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center space-y-2">
          <LayoutGrid className="w-12 h-12 text-stone-300 mx-auto" />
          <p className="text-base font-bold text-stone-800">Không tìm thấy bàn nào phù hợp</p>
          <p className="text-sm text-stone-500">
            Thử đổi bộ lọc khu vực/trạng thái hoặc bấm &ldquo;Thêm bàn mới&rdquo;.
          </p>
        </div>
      ) : viewMode === 'GRID' ? (
        selectedAreaId === 'ALL' ? (
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {areaTables.map((table) => renderTableCard(table))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTables.map((table) => renderTableCard(table))}
          </div>
        )
      ) : (
        /* Chế độ xem Bảng chi tiết */
        <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-stone-500">
                  <th className="py-3.5 px-4">Số bàn</th>
                  <th className="py-3.5 px-4">Khu vực</th>
                  <th className="py-3.5 px-4">Sức chứa</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Ngày tạo</th>
                  <th className="py-3.5 px-4">Cập nhật</th>
                  {isAdmin && <th className="py-3.5 px-4 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTables.map((table) => {
                  const stKey = (table.status || 'AVAILABLE').toUpperCase();
                  const meta = getStatusMeta(stKey);
                  const areaLabel =
                    table.areaName ||
                    areaNameById[Number(table.areaId)] ||
                    'Chưa phân khu vực';
                  const isBusy = updatingStatusId === table.id || deletingId === table.id;

                  return (
                    <tr key={table.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-stone-800">{table.tableNumber}</span>
                        <span className="font-mono text-xs text-stone-400 ml-2">#{table.id}</span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {areaLabel}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                        {table.capacity} ghế
                      </td>

                      <td className="py-3.5 px-4">
                        <select
                          disabled={isBusy}
                          value={stKey}
                          onChange={(e) => handleQuickStatusChange(table, e.target.value)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none ${meta.badgeClass}`}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt} className="bg-white text-stone-800">
                              {getStatusMeta(opt).label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDateTime(table.createdAt)}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-500 whitespace-nowrap">
                        {formatDateTime(table.updatedAt)}
                      </td>

                      {isAdmin && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleOpenEdit(table)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDeleteTable(table)}
                              title="Xóa bàn"
                              className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Thêm / Chỉnh sửa bàn (Dành cho Admin) */}
      {modalState.open && isAdmin && (
        <div
          onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-stone-800">
                {modalState.editingTable
                  ? `Cập nhật bàn: ${modalState.editingTable.tableNumber}`
                  : 'Thêm bàn mới'}
              </h2>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Số bàn / Tên bàn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalState.form.tableNumber}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, tableNumber: e.target.value },
                    }))
                  }
                  placeholder="VD: B01, T1-02, VIP-01..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Khu vực <span className="text-red-500">*</span>
                </label>
                <select
                  value={modalState.form.areaId}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, areaId: e.target.value },
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                >
                  <option value="">-- Chọn khu vực --</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                {areas.length === 0 && (
                  <p className="text-[11px] text-amber-800 mt-1">
                    Chưa có khu vực nào. Vui lòng tạo khu vực trước ở trang Quản lý khu vực.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sức chứa (Số ghế) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={modalState.form.capacity}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        form: { ...prev.form, capacity: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {CAPACITY_PRESETS.map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() =>
                          setModalState((prev) => ({
                            ...prev,
                            form: { ...prev.form, capacity: String(num) },
                          }))
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                          Number(modalState.form.capacity) === num
                            ? 'bg-amber-700 text-white'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {num} ghế
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Trạng thái ban đầu
                  </label>
                  <select
                    value={modalState.form.status}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        form: { ...prev.form, status: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {getStatusMeta(opt).label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalState.saving}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {modalState.saving ? 'Đang lưu...' : 'Lưu thông tin bàn'}
                </button>
              </div>
            </form>
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

export default TablesPage;