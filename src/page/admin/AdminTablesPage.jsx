import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Users,
  MapPin,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  X,
  LayoutGrid,
  List,
  Sparkles,
  UtensilsCrossed,
  Wrench,
  Check,
  UserCheck,
  Ban,
  Clock,
  Layers,
} from 'lucide-react';
import areaService from '../../service/areaService';
import tableService from '../../service/tableService';
import reservationService from '../../service/reservationService';

const TABLE_STATUS_META = {
  AVAILABLE: {
    label: 'Bàn trống',
    shortLabel: 'Trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cardClass: 'border-emerald-200/90 bg-white',
    icon: Sparkles,
  },
  OCCUPIED: {
    label: 'Đang phục vụ',
    shortLabel: 'Có khách',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    cardClass: 'border-orange-200/90 bg-orange-50/25',
    icon: UtensilsCrossed,
  },
  RESERVED: {
    label: 'Đã đặt trước',
    shortLabel: 'Đặt trước',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    cardClass: 'border-sky-200/90 bg-sky-50/25',
    icon: CalendarCheck,
  },
  MAINTENANCE: {
    label: 'Tạm ngưng / Bảo trì',
    shortLabel: 'Bảo trì',
    badgeClass: 'bg-stone-200 text-stone-700 border-stone-300',
    cardClass: 'border-stone-200 bg-stone-100/70 opacity-85',
    icon: Wrench,
  },
};

const RESERVATION_STATUS_META = {
  PENDING: {
    label: 'Chờ xác nhận',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
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

const toDateTimeLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

const AdminTablesPage = () => {
  // Tab quản trị: 'TABLES' (Cấu hình bàn) | 'RESERVATIONS' (Điều phối lịch đặt bàn)
  const [activeTab, setActiveTab] = useState('TABLES');
  const [viewMode, setViewMode] = useState('TABLE'); // 'TABLE' | 'GRID'

  // Dữ liệu từ API
  const [areas, setAreas] = useState([]);
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);

  // Trạng thái tải & thông báo
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Bộ lọc Tab Bàn
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [tableStatusFilter, setTableStatusFilter] = useState('ALL');
  const [tableKeyword, setTableKeyword] = useState('');
  const [updatingTableId, setUpdatingTableId] = useState(null);

  // Bộ lọc Tab Lịch đặt bàn
  const [resvStatusFilter, setResvStatusFilter] = useState('ALL');
  const [resvKeyword, setResvKeyword] = useState('');
  const [updatingResvId, setUpdatingResvId] = useState(null);

  // Modal Thêm / Sửa Bàn
  const [tableModal, setTableModal] = useState({
    open: false,
    mode: 'CREATE', // 'CREATE' | 'EDIT'
    id: null,
    tableNumber: '',
    capacity: '4',
    areaId: '',
    status: 'AVAILABLE',
    submitting: false,
  });

  // Modal Xóa Bàn
  const [deleteTableTarget, setDeleteTableTarget] = useState(null);
  const [deletingTable, setDeletingTable] = useState(false);

  // Modal Chỉnh sửa / Xếp lại bàn cho Lịch đặt bàn (PUT /api/reservations/{id})
  const [editResvModal, setEditResvModal] = useState({
    open: false,
    reservation: null,
    guestCount: '2',
    reservationTime: '',
    status: 'PENDING',
    note: '',
    tableIds: [],
    submitting: false,
  });

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

  // Tải đồng thời Khu vực, Bàn và Lịch đặt bàn
  const fetchAllData = useCallback(
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
        showToast('error', err?.message || 'Không thể tải dữ liệu quản lý bàn.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchAllData({ isInitial: true });
  }, [fetchAllData]);

  const areaNameById = useMemo(() => {
    const map = {};
    areas.forEach((a) => {
      map[Number(a.id)] = a.name;
    });
    return map;
  }, [areas]);

  // Lịch đặt bàn đang hiệu lực (PENDING / CONFIRMED) gom theo tableId
  const activeReservationsByTableId = useMemo(() => {
    const map = {};
    reservations
      .filter((r) => {
        const st = (r.status || '').toUpperCase();
        return st === 'PENDING' || st === 'CONFIRMED';
      })
      .forEach((r) => {
        if (Array.isArray(r.tables)) {
          r.tables.forEach((t) => {
            const id = Number(t.id);
            if (!map[id]) map[id] = [];
            map[id].push(r);
          });
        }
      });
    return map;
  }, [reservations]);

  // Thống kê KPI tổng quan
  const kpiStats = useMemo(() => {
    const totalTables = tables.length;
    const totalSeats = tables.reduce((sum, t) => sum + Number(t.capacity || 0), 0);
    const availableTables = tables.filter(
      (t) => (t.status || 'AVAILABLE').toUpperCase() === 'AVAILABLE'
    ).length;
    const occupiedTables = tables.filter(
      (t) => (t.status || '').toUpperCase() === 'OCCUPIED'
    ).length;
    const pendingReservations = reservations.filter(
      (r) => (r.status || '').toUpperCase() === 'PENDING'
    ).length;

    return {
      totalTables,
      totalSeats,
      availableTables,
      occupiedTables,
      pendingReservations,
    };
  }, [tables, reservations]);

  const tableCountsByStatus = useMemo(() => {
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
          areaLabel.toLowerCase().includes(q);

        return matchArea && matchStatus && matchKeyword;
      });
  }, [tables, selectedAreaId, tableStatusFilter, tableKeyword, areaNameById]);

  const groupedTablesByArea = useMemo(() => {
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

  const filteredReservations = useMemo(() => {
    const q = resvKeyword.trim().toLowerCase();
    return [...reservations]
      .sort(
        (a, b) =>
          new Date(b.reservationTime || b.createdAt || 0) -
          new Date(a.reservationTime || a.createdAt || 0)
      )
      .filter((r) => {
        const st = (r.status || 'PENDING').toUpperCase();
        const matchStatus = resvStatusFilter === 'ALL' || st === resvStatusFilter;
        const tableNames = Array.isArray(r.tables)
          ? r.tables.map((t) => t.tableNumber).join(' ')
          : '';
        const matchKeyword =
          !q ||
          String(r.id).includes(q) ||
          (r.accountPhone || '').toLowerCase().includes(q) ||
          (r.accountEmail || '').toLowerCase().includes(q) ||
          tableNames.toLowerCase().includes(q);

        return matchStatus && matchKeyword;
      });
  }, [reservations, resvStatusFilter, resvKeyword]);

  // --- HANDLERS QUẢN LÝ BÀN (tableService) ---

  const openCreateTableModal = () => {
    setTableModal({
      open: true,
      mode: 'CREATE',
      id: null,
      tableNumber: '',
      capacity: '4',
      areaId: areas[0]?.id ? String(areas[0].id) : '',
      status: 'AVAILABLE',
      submitting: false,
    });
  };

  const openEditTableModal = (table) => {
    setTableModal({
      open: true,
      mode: 'EDIT',
      id: table.id,
      tableNumber: table.tableNumber || '',
      capacity: String(table.capacity ?? 4),
      areaId: table.areaId != null ? String(table.areaId) : '',
      status: (table.status || 'AVAILABLE').toUpperCase(),
      submitting: false,
    });
  };

  const handleSubmitTableModal = async (e) => {
    e.preventDefault();

    const trimmedNumber = tableModal.tableNumber.trim();
    if (!trimmedNumber) {
      showToast('error', 'Vui lòng nhập tên hoặc mã số bàn (VD: B01, T1-02).');
      return;
    }

    const cap = Number(tableModal.capacity);
    if (isNaN(cap) || cap < 1 || cap > 50) {
      showToast('error', 'Sức chứa phải từ 1 đến 50 chỗ ngồi.');
      return;
    }

    const isDuplicate = tables.some(
      (t) =>
        (t.tableNumber || '').trim().toLowerCase() === trimmedNumber.toLowerCase() &&
        Number(t.id) !== Number(tableModal.id)
    );
    if (isDuplicate) {
      showToast('error', `Mã bàn "${trimmedNumber}" đã tồn tại trong hệ thống.`);
      return;
    }

    const payload = {
      tableNumber: trimmedNumber,
      capacity: cap,
      status: tableModal.status,
      areaId: tableModal.areaId ? Number(tableModal.areaId) : null,
    };

    setTableModal((prev) => ({ ...prev, submitting: true }));
    try {
      if (tableModal.mode === 'CREATE') {
        const res = await tableService.createTable(payload);
        if (res?.result) {
          setTables((prev) => [...prev, res.result]);
        } else {
          await fetchAllData({ isInitial: false });
        }
        showToast('success', `Đã thêm bàn ${trimmedNumber}.`);
      } else {
        const res = await tableService.updateTable(tableModal.id, payload);
        const updated = res?.result || {
          ...tables.find((t) => t.id === tableModal.id),
          ...payload,
          areaName: payload.areaId ? areaNameById[payload.areaId] : null,
          updatedAt: new Date().toISOString(),
        };
        setTables((prev) => prev.map((t) => (t.id === tableModal.id ? updated : t)));
        showToast('success', `Đã cập nhật thông tin bàn ${trimmedNumber}.`);
      }

      setTableModal((prev) => ({ ...prev, open: false, submitting: false }));
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin bàn.');
      setTableModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleQuickTableStatusChange = async (table, newStatus) => {
    const currentStatus = (table.status || 'AVAILABLE').toUpperCase();
    if (currentStatus === newStatus) return;

    setUpdatingTableId(table.id);
    try {
      const res = await tableService.updateTableStatus(table.id, newStatus);
      const updated = res?.result || {
        ...table,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      setTables((prev) => prev.map((t) => (t.id === table.id ? updated : t)));
      showToast(
        'success',
        `Bàn ${table.tableNumber} → ${TABLE_STATUS_META[newStatus]?.label || newStatus}`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái bàn.');
    } finally {
      setUpdatingTableId(null);
    }
  };

  const handleConfirmDeleteTable = async () => {
    if (!deleteTableTarget) return;

    if ((deleteTableTarget.status || '').toUpperCase() === 'OCCUPIED') {
      showToast('error', 'Không thể xóa bàn đang có khách phục vụ.');
      setDeleteTableTarget(null);
      return;
    }

    setDeletingTable(true);
    try {
      await tableService.deleteTable(deleteTableTarget.id);
      setTables((prev) => prev.filter((t) => t.id !== deleteTableTarget.id));
      showToast('success', `Đã xóa bàn ${deleteTableTarget.tableNumber}.`);
      setDeleteTableTarget(null);
    } catch (err) {
      showToast('error', err?.message || 'Không thể xóa bàn này.');
    } finally {
      setDeletingTable(false);
    }
  };

  // --- HANDLERS ĐIỀU PHỐI LỊCH ĐẶT BÀN (reservationService) ---

  const handleReservationStatusChange = async (reservation, nextStatus) => {
    setUpdatingResvId(reservation.id);
    try {
      const res = await reservationService.updateReservationStatus(
        reservation.id,
        nextStatus
      );
      const updatedResv = res?.result || {
        ...reservation,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };

      setReservations((prev) =>
        prev.map((item) => (item.id === reservation.id ? updatedResv : item))
      );

      // Đồng bộ trạng thái các bàn gắn với lịch đặt này
      const linkedIds = Array.isArray(reservation.tables)
        ? reservation.tables.map((t) => Number(t.id))
        : [];

      if (linkedIds.length > 0) {
        let targetTableStatus = null;
        if (nextStatus === 'CONFIRMED') targetTableStatus = 'RESERVED';
        if (nextStatus === 'COMPLETED') targetTableStatus = 'OCCUPIED';
        if (nextStatus === 'CANCELLED') targetTableStatus = 'AVAILABLE';

        if (targetTableStatus) {
          await Promise.all(
            linkedIds.map((tId) => {
              const tb = tables.find((item) => Number(item.id) === tId);
              if (!tb) return Promise.resolve();
              const cur = (tb.status || 'AVAILABLE').toUpperCase();
              if (nextStatus === 'CONFIRMED' && cur !== 'AVAILABLE') return Promise.resolve();
              if (nextStatus === 'CANCELLED' && cur !== 'RESERVED') return Promise.resolve();
              return tableService.updateTableStatus(tId, targetTableStatus).catch(() => null);
            })
          );
          await fetchAllData({ isInitial: false });
        }
      }

      showToast(
        'success',
        `Lịch #${reservation.id} → ${
          RESERVATION_STATUS_META[nextStatus]?.label || nextStatus
        }`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái lịch đặt bàn.');
    } finally {
      setUpdatingResvId(null);
    }
  };

  const openEditReservationModal = (resv) => {
    setEditResvModal({
      open: true,
      reservation: resv,
      guestCount: String(resv.guestCount || 2),
      reservationTime: toDateTimeLocalInput(resv.reservationTime),
      status: (resv.status || 'PENDING').toUpperCase(),
      note: resv.note || '',
      tableIds: Array.isArray(resv.tables) ? resv.tables.map((t) => Number(t.id)) : [],
      submitting: false,
    });
  };

  const toggleEditResvTable = (tableId) => {
    const id = Number(tableId);
    setEditResvModal((prev) => ({
      ...prev,
      tableIds: prev.tableIds.includes(id)
        ? prev.tableIds.filter((item) => item !== id)
        : [...prev.tableIds, id],
    }));
  };

  const handleSubmitEditReservation = async (e) => {
    e.preventDefault();
    const resv = editResvModal.reservation;
    if (!resv) return;

    if (editResvModal.tableIds.length === 0) {
      showToast('error', 'Vui lòng chọn ít nhất 1 bàn cho lịch hẹn.');
      return;
    }

    const formattedTime =
      editResvModal.reservationTime.length === 16
        ? `${editResvModal.reservationTime}:00`
        : editResvModal.reservationTime;

    const payload = {
      accountId: resv.accountId,
      guestCount: Number(editResvModal.guestCount) || 1,
      reservationTime: formattedTime,
      note: editResvModal.note.trim() || null,
      status: editResvModal.status,
      tableIds: editResvModal.tableIds,
    };

    setEditResvModal((prev) => ({ ...prev, submitting: true }));
    try {
      await reservationService.updateReservation(resv.id, payload);
      showToast('success', `Đã cập nhật lịch đặt bàn #${resv.id}.`);
      setEditResvModal((prev) => ({ ...prev, open: false, submitting: false }));
      await fetchAllData({ isInitial: false });
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật lịch đặt bàn.');
      setEditResvModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleDeleteReservation = async (reservation) => {
    if (!window.confirm(`Xóa vĩnh viễn bản ghi lịch đặt bàn #${reservation.id}?`)) {
      return;
    }

    setUpdatingResvId(reservation.id);
    try {
      await reservationService.deleteReservation(reservation.id);
      setReservations((prev) => prev.filter((item) => item.id !== reservation.id));
      showToast('success', `Đã xóa lịch đặt bàn #${reservation.id}.`);
    } catch (err) {
      showToast('error', err?.message || 'Không thể xóa lịch đặt bàn.');
    } finally {
      setUpdatingResvId(null);
    }
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Header gradient cam ấm với bố cục nút 2 tầng cân đối */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-amber-950 to-orange-900 text-white p-6 sm:p-8 shadow-md border border-orange-500/25 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="absolute -right-10 -top-12 w-64 h-64 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-56 h-56 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-orange-500/20 border border-orange-400/35 px-3 py-1 rounded-full">
            <LayoutGrid className="w-3.5 h-3.5 text-orange-300" />
            <span>Sơ đồ bàn & Điều phối đặt chỗ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản lý Bàn & Lịch đặt chỗ
          </h1>
          <p className="text-sm text-amber-100/85">
            Thiết lập sơ đồ bàn theo khu vực, kiểm soát trạng thái phục vụ và điều phối lịch hẹn
            khách hàng
          </p>
        </div>

        {/* Cụm chuyển tab & nút thao tác sắp xếp 2 hàng gọn gàng */}
        <div className="relative z-10 flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-2xl bg-orange-950/75 p-1 border border-orange-400/30">
              <button
                type="button"
                onClick={() => setActiveTab('TABLES')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'TABLES'
                    ? 'bg-orange-500/30 text-amber-200 border border-orange-400/40'
                    : 'text-amber-100/75 hover:text-white'
                }`}
              >
                Danh sách bàn ({tables.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('RESERVATIONS')}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'RESERVATIONS'
                    ? 'bg-orange-500/30 text-amber-200 border border-orange-400/40'
                    : 'text-amber-100/75 hover:text-white'
                }`}
              >
                <span>Lịch đặt bàn</span>
                {kpiStats.pendingReservations > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[11px] font-extrabold leading-none">
                    {kpiStats.pendingReservations}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'TABLES' && (
              <button
                type="button"
                onClick={openCreateTableModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Thêm bàn mới</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-orange-950/60 border border-orange-400/20 text-xs">
              <span className="text-amber-200/75">Sức chứa:</span>
              <span className="font-extrabold text-amber-300">
                {kpiStats.totalTables} bàn • {kpiStats.totalSeats} ghế
              </span>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchAllData({ isInitial: false })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-orange-400/25 bg-orange-950/60 hover:bg-orange-900/80 text-xs font-semibold text-amber-100 transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-orange-300 ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thẻ KPI tổng quan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Tổng số bàn / Sức chứa</span>
            <Layers className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-extrabold text-stone-800 mt-2">
            {kpiStats.totalTables}{' '}
            <span className="text-sm font-semibold text-stone-500">
              bàn ({kpiStats.totalSeats} ghế)
            </span>
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Bàn đang trống</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">
            {kpiStats.availableTables}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Đang phục vụ khách</span>
            <UtensilsCrossed className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-2xl font-extrabold text-orange-800 mt-2">
            {kpiStats.occupiedTables}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500">
            <span>Lịch đặt chờ duyệt</span>
            <CalendarCheck className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold text-sky-700 mt-2">
            {kpiStats.pendingReservations}
          </p>
        </div>
      </div>

      {activeTab === 'TABLES' ? (
        <>
          {/* Thanh bộ lọc & Chuyển đổi giao diện Bảng / Lưới */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'ALL', label: `Tất cả (${tableCountsByStatus.ALL})` },
                  { key: 'AVAILABLE', label: `Bàn trống (${tableCountsByStatus.AVAILABLE})` },
                  { key: 'OCCUPIED', label: `Đang phục vụ (${tableCountsByStatus.OCCUPIED})` },
                  { key: 'RESERVED', label: `Đã đặt trước (${tableCountsByStatus.RESERVED})` },
                  {
                    key: 'MAINTENANCE',
                    label: `Bảo trì (${tableCountsByStatus.MAINTENANCE})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTableStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      tableStatusFilter === tab.key
                        ? 'bg-orange-600 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <input
                    type="text"
                    value={tableKeyword}
                    onChange={(e) => setTableKeyword(e.target.value)}
                    placeholder="Tìm số bàn, khu vực..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                <div className="inline-flex rounded-xl bg-stone-100 p-1 border border-stone-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('TABLE')}
                    title="Dạng bảng quản trị"
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'TABLE'
                        ? 'bg-white text-orange-700 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('GRID')}
                    title="Sơ đồ thẻ theo khu vực"
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewMode === 'GRID'
                        ? 'bg-white text-orange-700 shadow-2xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pt-2.5 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedAreaId('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                  selectedAreaId === 'ALL'
                    ? 'bg-stone-900 text-white'
                    : 'bg-orange-50 text-orange-900 hover:bg-orange-100'
                }`}
              >
                Tất cả khu vực ({tables.length})
              </button>

              {areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setSelectedAreaId(String(area.id))}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer ${
                    String(selectedAreaId) === String(area.id)
                      ? 'bg-stone-900 text-white'
                      : 'bg-orange-50 text-orange-900 hover:bg-orange-100'
                  }`}
                >
                  {area.name} ({tableCountByArea[String(area.id)] || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Nội dung danh sách bàn */}
          {initialLoading ? (
            <div className="h-64 rounded-2xl bg-white border border-stone-200 animate-pulse" />
          ) : filteredTables.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-14 text-center space-y-3">
              <p className="text-sm text-stone-500">
                Không có bàn nào khớp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={openCreateTableModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm bàn mới</span>
              </button>
            </div>
          ) : viewMode === 'TABLE' ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-500">
                      <th className="py-3.5 px-4">Số bàn</th>
                      <th className="py-3.5 px-4">Khu vực</th>
                      <th className="py-3.5 px-4">Sức chứa</th>
                      <th className="py-3.5 px-4">Trạng thái</th>
                      <th className="py-3.5 px-4">Lịch đặt hiệu lực</th>
                      <th className="py-3.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredTables.map((table) => {
                      const statusKey = (table.status || 'AVAILABLE').toUpperCase();
                      const meta =
                        TABLE_STATUS_META[statusKey] || TABLE_STATUS_META.AVAILABLE;
                      const areaLabel =
                        table.areaName ||
                        areaNameById[Number(table.areaId)] ||
                        'Khu vực chung';
                      const linkedResvs =
                        activeReservationsByTableId[Number(table.id)] || [];

                      return (
                        <tr
                          key={table.id}
                          className="hover:bg-orange-50/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-extrabold text-stone-800">
                            {table.tableNumber}
                          </td>

                          <td className="py-3.5 px-4 text-stone-600">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-orange-600" />
                              <span>{areaLabel}</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-stone-700 font-medium">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-stone-400" />
                              <span>{table.capacity} chỗ</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <select
                              value={statusKey}
                              disabled={updatingTableId === table.id}
                              onChange={(e) =>
                                handleQuickTableStatusChange(table, e.target.value)
                              }
                              className={`px-2.5 py-1 rounded-xl text-xs font-semibold border cursor-pointer focus:outline-none ${meta.badgeClass}`}
                            >
                              {Object.entries(TABLE_STATUS_META).map(([key, item]) => (
                                <option key={key} value={key} className="bg-white text-stone-800">
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-stone-600">
                            {linkedResvs.length === 0 ? (
                              <span className="text-stone-400">—</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-semibold">
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>{linkedResvs.length} lịch hẹn</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditTableModal(table)}
                                title="Sửa thông tin bàn"
                                className="p-2 rounded-xl border border-stone-200 hover:border-orange-400 hover:bg-orange-50 text-stone-700 transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTableTarget(table)}
                                title="Xóa bàn"
                                className="p-2 rounded-xl border border-stone-200 hover:border-red-300 hover:bg-red-50 text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Chế độ xem Lưới theo khu vực */
            <div className="space-y-6">
              {groupedTablesByArea.map(([areaName, areaTables]) => (
                <section key={areaName} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-600" />
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-stone-700">
                      {areaName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100/80 text-orange-900 text-xs font-bold">
                      {areaTables.length} bàn
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {areaTables.map((table) => {
                      const statusKey = (table.status || 'AVAILABLE').toUpperCase();
                      const meta =
                        TABLE_STATUS_META[statusKey] || TABLE_STATUS_META.AVAILABLE;
                      const StatusIcon = meta.icon;

                      return (
                        <div
                          key={table.id}
                          className={`p-4 rounded-2xl border shadow-2xs flex flex-col justify-between min-h-[152px] ${meta.cardClass}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-lg font-extrabold text-stone-800">
                                {table.tableNumber}
                              </h3>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}
                              >
                                <StatusIcon className="w-3 h-3" />
                                <span>{meta.shortLabel}</span>
                              </span>
                            </div>

                            <p className="text-xs text-stone-600 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-orange-600" />
                              <span>{table.capacity} chỗ ngồi</span>
                            </p>
                          </div>

                          <div className="pt-3 mt-3 border-t border-stone-200/70 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditTableModal(table)}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-stone-200 hover:border-orange-400 text-xs font-semibold text-stone-700 inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Sửa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTableTarget(table)}
                              className="p-1.5 rounded-lg bg-white border border-stone-200 hover:border-red-300 text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        /* TAB 2: GIÁM SÁT & ĐIỀU PHỐI LỊCH ĐẶT BÀN (ReservationController) */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'ALL', label: `Tất cả (${reservations.length})` },
                {
                  key: 'PENDING',
                  label: `Chờ xác nhận (${
                    reservations.filter((r) => r.status === 'PENDING').length
                  })`,
                },
                {
                  key: 'CONFIRMED',
                  label: `Đã xác nhận (${
                    reservations.filter((r) => r.status === 'CONFIRMED').length
                  })`,
                },
                {
                  key: 'COMPLETED',
                  label: `Đã nhận bàn (${
                    reservations.filter((r) => r.status === 'COMPLETED').length
                  })`,
                },
                {
                  key: 'CANCELLED',
                  label: `Đã hủy (${
                    reservations.filter((r) => r.status === 'CANCELLED').length
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setResvStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    resvStatusFilter === tab.key
                      ? 'bg-orange-600 text-white'
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
                value={resvKeyword}
                onChange={(e) => setResvKeyword(e.target.value)}
                placeholder="Tìm mã, SĐT, email, số bàn..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {filteredReservations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-14 text-center text-sm text-stone-500">
              Không có lịch đặt bàn nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredReservations.map((resv) => {
                const st = (resv.status || 'PENDING').toUpperCase();
                const meta =
                  RESERVATION_STATUS_META[st] || RESERVATION_STATUS_META.PENDING;
                const linkedTables = Array.isArray(resv.tables) ? resv.tables : [];
                const isBusy = updatingResvId === resv.id;

                return (
                  <div
                    key={resv.id}
                    className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-stone-400">
                            Lịch hẹn #{resv.id}
                          </span>
                          <h3 className="text-base font-extrabold text-stone-800 flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-4 h-4 text-orange-600" />
                            <span>{formatDateTime(resv.reservationTime)}</span>
                          </h3>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="text-xs text-stone-600 space-y-1">
                        <p>
                          Khách hàng:{' '}
                          <strong className="text-stone-800">
                            {resv.accountPhone ||
                              resv.accountEmail ||
                              `Tài khoản #${resv.accountId}`}
                          </strong>{' '}
                          - <strong>{resv.guestCount} khách</strong>
                        </p>

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {linkedTables.length === 0 ? (
                            <span className="text-stone-400 italic">Chưa gán bàn</span>
                          ) : (
                            linkedTables.map((tb) => (
                              <span
                                key={tb.id}
                                className="px-2.5 py-0.5 rounded-lg bg-orange-50 border border-orange-200/80 text-orange-900 font-semibold"
                              >
                                Bàn {tb.tableNumber} ({tb.areaName || 'Chung'})
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {resv.note && (
                        <p className="text-xs text-stone-500 bg-stone-50 border border-stone-200/80 rounded-xl p-2.5">
                          Ghi chú: {resv.note}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {st === 'PENDING' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleReservationStatusChange(resv, 'CONFIRMED')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Xác nhận</span>
                          </button>
                        )}

                        {(st === 'PENDING' || st === 'CONFIRMED') && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleReservationStatusChange(resv, 'COMPLETED')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Nhận bàn</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleReservationStatusChange(resv, 'CANCELLED')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold cursor-pointer disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Hủy</span>
                            </button>
                          </>
                        )}
                      </div>

                      <div className="inline-flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => openEditReservationModal(resv)}
                          title="Đổi giờ / Xếp lại bàn"
                          className="p-1.5 rounded-lg border border-stone-200 hover:border-orange-400 text-stone-700 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDeleteReservation(resv)}
                          title="Xóa bản ghi"
                          className="p-1.5 rounded-lg border border-stone-200 hover:border-red-300 text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Thêm / Sửa Bàn */}
      {tableModal.open && (
        <div
          onClick={() => setTableModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-stone-800">
                {tableModal.mode === 'CREATE' ? 'Thêm bàn mới' : 'Cập nhật thông tin bàn'}
              </h2>
              <button
                type="button"
                onClick={() => setTableModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTableModal} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tên / Mã số bàn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={tableModal.tableNumber}
                  onChange={(e) =>
                    setTableModal((prev) => ({ ...prev, tableNumber: e.target.value }))
                  }
                  placeholder="VD: B01, Tầng 2 - 05..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Sức chứa (ghế) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={tableModal.capacity}
                    onChange={(e) =>
                      setTableModal((prev) => ({ ...prev, capacity: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={tableModal.status}
                    onChange={(e) =>
                      setTableModal((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(TABLE_STATUS_META).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Khu vực bố trí
                </label>
                <select
                  value={tableModal.areaId}
                  onChange={(e) =>
                    setTableModal((prev) => ({ ...prev, areaId: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">— Khu vực chung —</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTableModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={tableModal.submitting}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {tableModal.submitting
                    ? 'Đang lưu...'
                    : tableModal.mode === 'CREATE'
                      ? 'Tạo bàn'
                      : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xác nhận Xóa Bàn */}
      {deleteTableTarget && (
        <div
          onClick={() => setDeleteTableTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4"
          >
            <h3 className="text-base font-extrabold text-stone-800">
              Xóa bàn {deleteTableTarget.tableNumber}?
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Thao tác này sẽ xóa vĩnh viễn bàn <strong>{deleteTableTarget.tableNumber}</strong>{' '}
              khỏi sơ đồ quán.
              {(activeReservationsByTableId[Number(deleteTableTarget.id)] || []).length >
                0 && (
                <span className="block mt-1.5 text-red-600 font-semibold">
                  Cảnh báo: Bàn này đang có lịch đặt trước hiệu lực!
                </span>
              )}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTableTarget(null)}
                className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={deletingTable}
                onClick={handleConfirmDeleteTable}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {deletingTable ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Điều chỉnh Lịch đặt bàn (PUT /api/reservations/{id}) */}
      {editResvModal.open && (
        <div
          onClick={() => setEditResvModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-stone-800">
                Điều chỉnh lịch đặt bàn #{editResvModal.reservation?.id}
              </h2>
              <button
                type="button"
                onClick={() => setEditResvModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitEditReservation}
              className="p-5 overflow-y-auto space-y-4 text-sm"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Thời gian đến
                  </label>
                  <input
                    type="datetime-local"
                    value={editResvModal.reservationTime}
                    onChange={(e) =>
                      setEditResvModal((prev) => ({
                        ...prev,
                        reservationTime: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Số khách
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={editResvModal.guestCount}
                    onChange={(e) =>
                      setEditResvModal((prev) => ({
                        ...prev,
                        guestCount: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={editResvModal.status}
                    onChange={(e) =>
                      setEditResvModal((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {Object.entries(RESERVATION_STATUS_META).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Xếp bàn cho khách ({editResvModal.tableIds.length} bàn đang chọn)
                </label>
                <div className="max-h-44 overflow-y-auto p-3 rounded-xl border border-stone-200 bg-stone-50/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {tables.map((t) => {
                    const checked = editResvModal.tableIds.includes(Number(t.id));
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleEditResvTable(t.id)}
                        className={`px-2.5 py-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                          checked
                            ? 'bg-orange-600 text-white border-orange-600 font-bold'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-orange-400'
                        }`}
                      >
                        <div className="truncate">{t.tableNumber}</div>
                        <div
                          className={`text-[10px] ${
                            checked ? 'text-orange-100' : 'text-stone-400'
                          }`}
                        >
                          {t.capacity} chỗ • {t.areaName || 'Chung'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={editResvModal.note}
                  onChange={(e) =>
                    setEditResvModal((prev) => ({ ...prev, note: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditResvModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editResvModal.submitting}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {editResvModal.submitting ? 'Đang lưu...' : 'Lưu điều chỉnh'}
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

export default AdminTablesPage;