import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Coffee,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Clock,
} from 'lucide-react';
import categoryService from '../../service/categoryService';

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

const toSlug = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const INITIAL_CATEGORY_FORM = {
  name: '',
  slug: '',
  imageUrl: '',
  sortOrder: '1',
  isActive: true,
};

const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyCategoryId, setBusyCategoryId] = useState(null);
  const [brokenImgIds, setBrokenImgIds] = useState({});
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  const [modalState, setModalState] = useState({
    open: false,
    editingCategory: null,
    form: INITIAL_CATEGORY_FORM,
    slugTouched: false,
    previewBroken: false,
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

  const fetchCategories = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const res = await categoryService.getAllCategories();
        const list = Array.isArray(res?.result) ? res.result : [];
        setCategories(list);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách danh mục.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchCategories({ isInitial: true });
  }, [fetchCategories]);

  // Sắp xếp theo sortOrder tăng dần rồi lọc theo trạng thái & từ khóa
  const filteredCategories = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return [...categories]
      .sort((a, b) => Number(a.sortOrder ?? 999) - Number(b.sortOrder ?? 999))
      .filter((cat) => {
        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' && Boolean(cat.isActive)) ||
          (statusFilter === 'INACTIVE' && !cat.isActive);

        const matchKeyword =
          !q ||
          (cat.name || '').toLowerCase().includes(q) ||
          (cat.slug || '').toLowerCase().includes(q);

        return matchStatus && matchKeyword;
      });
  }, [categories, keyword, statusFilter]);

  const nextSuggestedSortOrder = useMemo(() => {
    if (categories.length === 0) return 1;
    const maxOrder = Math.max(...categories.map((c) => Number(c.sortOrder || 0)));
    return maxOrder + 1;
  }, [categories]);

  const handleOpenCreate = () => {
    setModalState({
      open: true,
      editingCategory: null,
      form: {
        ...INITIAL_CATEGORY_FORM,
        sortOrder: String(nextSuggestedSortOrder),
      },
      slugTouched: false,
      previewBroken: false,
      saving: false,
    });
  };

  const handleOpenEdit = (category) => {
    setModalState({
      open: true,
      editingCategory: category,
      form: {
        name: category.name || '',
        slug: category.slug || '',
        imageUrl: category.imageUrl || '',
        sortOrder: category.sortOrder ?? '1',
        isActive: category.isActive ?? true,
      },
      slugTouched: true,
      previewBroken: false,
      saving: false,
    });
  };

  const handleNameChange = (value) => {
    setModalState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        name: value,
        slug: prev.slugTouched ? prev.form.slug : toSlug(value),
      },
    }));
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const { form, editingCategory } = modalState;

    if (!form.name.trim()) {
      showToast('error', 'Vui lòng nhập tên danh mục.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: (form.slug.trim() || toSlug(form.name)).toLowerCase(),
      imageUrl: form.imageUrl.trim() || null,
      isActive: Boolean(form.isActive),
      sortOrder: form.sortOrder !== '' ? Number(form.sortOrder) : 1,
    };

    setModalState((prev) => ({ ...prev, saving: true }));
    try {
      if (editingCategory) {
        const res = await categoryService.updateCategory(editingCategory.id, payload);
        const updated = res?.result || {
          ...editingCategory,
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        setCategories((prev) => prev.map((c) => (c.id === editingCategory.id ? updated : c)));
        setBrokenImgIds((prev) => ({ ...prev, [editingCategory.id]: false }));
        showToast('success', `Đã cập nhật danh mục "${payload.name}".`);
      } else {
        const res = await categoryService.createCategory(payload);
        if (res?.result) {
          setCategories((prev) => [...prev, res.result]);
        } else {
          await fetchCategories({ isInitial: false });
        }
        showToast('success', `Đã tạo danh mục "${payload.name}".`);
      }
      setModalState((prev) => ({ ...prev, open: false, saving: false }));
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu danh mục.');
      setModalState((prev) => ({ ...prev, saving: false }));
    }
  };

  // Bật / tắt hiển thị danh mục trên Menu khách hàng tại chỗ
  const handleToggleActive = async (category) => {
    const nextActive = !category.isActive;
    setBusyCategoryId(category.id);
    try {
      const res = await categoryService.updateCategory(category.id, {
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        isActive: nextActive,
        sortOrder: category.sortOrder ?? 1,
      });
      const updated = res?.result || {
        ...category,
        isActive: nextActive,
        updatedAt: new Date().toISOString(),
      };
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
      showToast(
        'success',
        `Danh mục "${category.name}" → ${nextActive ? 'Đang hiển thị' : 'Đã ẩn khỏi Menu'}`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái danh mục.');
    } finally {
      setBusyCategoryId(null);
    }
  };

  // Tăng / giảm nhanh thứ tự hiển thị (sortOrder)
  const handleStepSortOrder = async (category, delta) => {
    const currentOrder = Number(category.sortOrder ?? 1);
    const nextOrder = Math.max(1, currentOrder + delta);
    if (nextOrder === currentOrder) return;

    setBusyCategoryId(category.id);
    try {
      const res = await categoryService.updateCategory(category.id, {
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        isActive: category.isActive,
        sortOrder: nextOrder,
      });
      const updated = res?.result || {
        ...category,
        sortOrder: nextOrder,
        updatedAt: new Date().toISOString(),
      };
      setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật thứ tự hiển thị.');
    } finally {
      setBusyCategoryId(null);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (
      !window.confirm(
        `Xác nhận xóa danh mục "${category.name}"? Lưu ý: không thể xóa nếu danh mục đang có sản phẩm.`
      )
    ) {
      return;
    }

    setBusyCategoryId(category.id);
    try {
      await categoryService.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      showToast('success', `Đã xóa danh mục "${category.name}".`);
    } catch (err) {
      showToast(
        'error',
        err?.message ||
          'Không thể xóa danh mục này (vui lòng chuyển hoặc xóa các món thuộc danh mục trước).'
      );
    } finally {
      setBusyCategoryId(null);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-800">Quản lý Danh mục Thực đơn</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Phân nhóm đồ uống, sắp xếp thứ tự hiển thị và kiểm soát trạng thái trên trang Menu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-sm font-semibold text-stone-700"
          >
            <Coffee className="w-4 h-4 text-amber-700" />
            <span>Quản lý sản phẩm</span>
          </Link>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => fetchCategories({ isInitial: false })}
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
            <span>Thêm danh mục</span>
          </button>
        </div>
      </div>

      {/* Thanh tìm kiếm & lọc */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL', label: `Tất cả (${categories.length})` },
            {
              key: 'ACTIVE',
              label: `Đang hiển thị (${categories.filter((c) => c.isActive).length})`,
            },
            {
              key: 'INACTIVE',
              label: `Đang ẩn (${categories.filter((c) => !c.isActive).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-stone-800 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm tên danh mục hoặc slug..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Bảng danh sách danh mục */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {initialLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FolderKanban className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-base font-bold text-stone-800">Chưa có danh mục nào phù hợp</p>
            <p className="text-sm text-stone-500">
              Bấm &ldquo;Thêm danh mục&rdquo; để tạo nhóm thực đơn mới.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-stone-500">
                  <th className="py-3.5 px-4 w-28">Thứ tự</th>
                  <th className="py-3.5 px-4">Danh mục</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Ngày tạo</th>
                  <th className="py-3.5 px-4">Cập nhật</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCategories.map((cat) => {
                  const hasValidImg = cat.imageUrl && !brokenImgIds[cat.id];
                  const isBusy = busyCategoryId === cat.id;

                  return (
                    <tr key={cat.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 bg-stone-100 rounded-lg px-2 py-1">
                          <span className="font-mono text-xs font-extrabold text-stone-800 w-5 text-center">
                            {cat.sortOrder ?? '—'}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStepSortOrder(cat, -1)}
                              title="Giảm số thứ tự (lên trước)"
                              className="text-stone-500 hover:text-amber-800 disabled:opacity-40 cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStepSortOrder(cat, 1)}
                              title="Tăng số thứ tự (xuống sau)"
                              className="text-stone-500 hover:text-amber-800 disabled:opacity-40 cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-stone-200 overflow-hidden flex items-center justify-center shrink-0">
                            {hasValidImg ? (
                              <img
                                src={cat.imageUrl}
                                alt={cat.name}
                                onError={() =>
                                  setBrokenImgIds((prev) => ({ ...prev, [cat.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FolderKanban className="w-5 h-5 text-amber-800" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-stone-800">{cat.name}</p>
                            <p className="font-mono text-xs text-stone-400">#{cat.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-stone-600">
                        /{cat.slug}
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleActive(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            cat.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                          }`}
                        >
                          {cat.isActive ? (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Đang hiển thị</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Đang ẩn</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-600 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-400" />
                          <span>{formatDateTime(cat.createdAt)}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-stone-500 whitespace-nowrap">
                        {formatDateTime(cat.updatedAt)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cat)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDeleteCategory(cat)}
                            title="Xóa danh mục"
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
      </div>

      {/* Modal Thêm / Chỉnh sửa danh mục */}
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
              <h2 className="text-base font-extrabold text-stone-800">
                {modalState.editingCategory
                  ? `Cập nhật danh mục: ${modalState.editingCategory.name}`
                  : 'Thêm danh mục mới'}
              </h2>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tên danh mục <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalState.form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Trà trái cây nhiệt đới..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Đường dẫn (Slug)
                  </label>
                  <input
                    type="text"
                    value={modalState.form.slug}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        slugTouched: true,
                        form: { ...prev.form, slug: e.target.value },
                      }))
                    }
                    placeholder="tra-trai-cay"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modalState.form.sortOrder}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        form: { ...prev.form, sortOrder: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  URL ảnh đại diện danh mục
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="url"
                    value={modalState.form.imageUrl}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        previewBroken: false,
                        form: { ...prev.form, imageUrl: e.target.value },
                      }))
                    }
                    placeholder="https://..."
                    className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                  <div className="w-11 h-11 rounded-xl border border-stone-200 bg-stone-50 overflow-hidden flex items-center justify-center shrink-0">
                    {modalState.form.imageUrl && !modalState.previewBroken ? (
                      <img
                        src={modalState.form.imageUrl}
                        alt="Preview"
                        onError={() =>
                          setModalState((prev) => ({ ...prev, previewBroken: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-stone-400" />
                    )}
                  </div>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modalState.form.isActive}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, isActive: e.target.checked },
                    }))
                  }
                  className="rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                />
                <span>Hiển thị danh mục này cho khách hàng</span>
              </label>

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
                  {modalState.saving ? 'Đang lưu...' : 'Lưu danh mục'}
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

export default AdminCategoriesPage;