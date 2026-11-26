import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  LayoutGrid,
  Clock,
} from 'lucide-react';
import areaService from '../../service/areaService';

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

const QUICK_AREA_SUGGESTIONS = [
  'Tầng 1 - Trong nhà',
  'Tầng 2 - Phòng lạnh',
  'Sân vườn ngoài trời',
  'Ban công',
  'Khu vực quầy Bar',
];

const AdminAreasPage = () => {
  // Dữ liệu danh sách phân trang
  const [areas, setAreas] = useState([]);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // Tìm kiếm & sắp xếp server-side
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Trạng thái UI
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Modal Thêm / Chỉnh sửa khu vực
  const [modalState, setModalState] = useState({
    open: false,
    editingArea: null,
    name: '',
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

  // Debounce từ khóa tìm kiếm 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  const fetchAreas = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const params = {
          page,
          size,
          sortBy,
          sortDir,
        };
        if (keyword) params.keyword = keyword;

        const res = await areaService.getAllAreas(params);
        const pageData = res?.result;

        if (Array.isArray(pageData?.content)) {
          setAreas(pageData.content);
          setTotalPages(Math.max(1, pageData.totalPages || 1));
          setTotalElements(pageData.totalElements ?? pageData.content.length);
        } else if (Array.isArray(pageData)) {
          setAreas(pageData);
          setTotalPages(1);
          setTotalElements(pageData.length);
        } else {
          setAreas([]);
        }
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách khu vực.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [page, size, sortBy, sortDir, keyword, showToast]
  );

  useEffect(() => {
    fetchAreas({ isInitial: true });
  }, [fetchAreas]);

  const handleOpenCreate = () => {
    setModalState({
      open: true,
      editingArea: null,
      name: '',
      saving: false,
    });
  };

  const handleOpenEdit = (area) => {
    setModalState({
      open: true,
      editingArea: area,
      name: area.name || '',
      saving: false,
    });
  };

  const handleSaveArea = async (e) => {
    e.preventDefault();
    const trimmedName = modalState.name.trim();

    if (!trimmedName) {
      showToast('error', 'Vui lòng nhập tên khu vực.');
      return;
    }

    setModalState((prev) => ({ ...prev, saving: true }));
    try {
      if (modalState.editingArea) {
        const res = await areaService.updateArea(modalState.editingArea.id, {
          name: trimmedName,
        });
        const updated = res?.result || {
          ...modalState.editingArea,
          name: trimmedName,
          updatedAt: new Date().toISOString(),
        };
        setAreas((prev) =>
          prev.map((item) => (item.id === modalState.editingArea.id ? updated : item))
        );
        showToast('success', `Đã cập nhật khu vực "${trimmedName}".`);
      } else {
        await areaService.createArea({ name: trimmedName });
        showToast('success', `Đã thêm khu vực "${trimmedName}".`);
        await fetchAreas({ isInitial: false });
      }

      setModalState({
        open: false,
        editingArea: null,
        name: '',
        saving: false,
      });
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin khu vực.');
      setModalState((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteArea = async (area) => {
    if (
      !window.confirm(
        `Xác nhận xóa khu vực "${area.name}"? Lưu ý: không thể xóa nếu khu vực vẫn còn bàn trực thuộc.`
      )
    ) {
      return;
    }

    setDeletingId(area.id);
    try {
      await areaService.deleteArea(area.id);
      setAreas((prev) => prev.filter((item) => item.id !== area.id));
      setTotalElements((prev) => Math.max(0, prev - 1));
      showToast('success', `Đã xóa khu vực "${area.name}".`);
    } catch (err) {
      showToast(
        'error',
        err?.message || 'Không thể xóa khu vực này (vui lòng chuyển hoặc xóa các bàn trong khu vực trước).'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSortChange = (value) => {
    const [field, dir] = value.split(':');
    setSortBy(field);
    setSortDir(dir);
    setPage(0);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800">
            Quản lý Khu vực & Không gian quán
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Phân chia các tầng, phòng lạnh, sân vườn để tổ chức sơ đồ bàn phục vụ tại chỗ
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/tables"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700"
          >
            <LayoutGrid className="w-4 h-4 text-amber-700" />
            <span>Quản lý bàn</span>
          </Link>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchAreas({ isInitial: false })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm khu vực</span>
          </button>
        </div>
      </div>

      {/* Thanh tìm kiếm & sắp xếp */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Tìm theo tên khu vực (VD: Tầng 1, Sân vườn)..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="relative w-full sm:w-52">
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <option value="name:asc">Tên khu vực A → Z</option>
              <option value="name:desc">Tên khu vực Z → A</option>
              <option value="createdAt:desc">Mới tạo nhất</option>
              <option value="createdAt:asc">Tạo cũ nhất</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <span className="text-xs text-stone-500 shrink-0">
          Tổng cộng: <strong className="text-stone-800">{totalElements}</strong> khu vực
        </span>
      </div>

      {/* Bảng danh sách khu vực */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {initialLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : areas.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <MapPin className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-base font-bold text-stone-800">Chưa có khu vực nào phù hợp</p>
            <p className="text-sm text-stone-500">
              Bấm &ldquo;Thêm khu vực&rdquo; để khởi tạo các không gian phục vụ của quán.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-stone-500">
                  <th className="py-3.5 px-4 w-24">Mã KV</th>
                  <th className="py-3.5 px-4">Tên khu vực</th>
                  <th className="py-3.5 px-4">Ngày tạo</th>
                  <th className="py-3.5 px-4">Cập nhật lần cuối</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {areas.map((area) => {
                  const isDeleting = deletingId === area.id;

                  return (
                    <tr key={area.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-bold text-stone-500">
                        #{area.id}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-800 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-stone-800">{area.name}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDateTime(area.createdAt)}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-500">
                        {formatDateTime(area.updatedAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(area)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteArea(area)}
                            title="Xóa khu vực"
                            className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
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
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Trang <strong>{page + 1}</strong> / {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-stone-300 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm / Chỉnh sửa khu vực */}
      {modalState.open && (
        <div
          onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="text-base font-extrabold text-stone-800">
                  {modalState.editingArea
                    ? `Cập nhật khu vực: ${modalState.editingArea.name}`
                    : 'Thêm khu vực mới'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArea} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Tên khu vực <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalState.name}
                  onChange={(e) =>
                    setModalState((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="VD: Tầng 1 - Trong nhà, Sân vườn..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {/* Gợi ý nhanh tên khu vực khi thêm mới */}
              {!modalState.editingArea && (
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Gợi ý nhanh
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_AREA_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() =>
                          setModalState((prev) => ({ ...prev, name: suggestion }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-amber-50 hover:text-amber-900 border border-stone-200 text-xs font-medium text-stone-700 transition-colors cursor-pointer"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                  {modalState.saving ? 'Đang lưu...' : 'Lưu khu vực'}
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

export default AdminAreasPage;