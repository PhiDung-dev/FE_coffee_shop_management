import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Coffee,
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
  Image as ImageIcon,
  FolderKanban,
  ArrowUpDown,
  Clock,
  RotateCcw,
} from 'lucide-react';
import productService from '../../service/productService';
import categoryService from '../../service/categoryService';

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

const INITIAL_PRODUCT_FORM = {
  name: '',
  slug: '',
  basePrice: '',
  categoryId: '',
  description: '',
  imageUrl: '',
  isAvailable: true,
};

const AdminProductsPage = () => {
  // Dữ liệu từ API
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Phân trang & sắp xếp
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  // Bộ lọc server-side
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('ALL'); // 'ALL' | 'AVAILABLE' | 'UNAVAILABLE'

  // Trạng thái UI
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [brokenImgIds, setBrokenImgIds] = useState({});
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Modal Tạo / Chỉnh sửa sản phẩm
  const [modalState, setModalState] = useState({
    open: false,
    editingProduct: null,
    form: INITIAL_PRODUCT_FORM,
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

  // Debounce từ khóa tìm kiếm 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setKeyword(keywordInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // Tải danh sách danh mục 1 lần
  const fetchCategories = useCallback(async () => {
    try {
      const res = await categoryService.getAllCategories();
      const list = Array.isArray(res?.result) ? res.result : [];
      setCategories(list);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Tải danh sách sản phẩm theo bộ lọc & phân trang
  const fetchProducts = useCallback(
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
        if (categoryFilter) params.categoryId = Number(categoryFilter);
        if (availabilityFilter === 'AVAILABLE') params.isAvailable = true;
        if (availabilityFilter === 'UNAVAILABLE') params.isAvailable = false;

        const res = await productService.getAllProducts(params);
        const pageData = res?.result;

        if (Array.isArray(pageData?.content)) {
          setProducts(pageData.content);
          setTotalPages(Math.max(1, pageData.totalPages || 1));
          setTotalElements(pageData.totalElements ?? pageData.content.length);
        } else if (Array.isArray(pageData)) {
          setProducts(pageData);
          setTotalPages(1);
          setTotalElements(pageData.length);
        } else {
          setProducts([]);
        }
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách sản phẩm.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [page, size, sortBy, sortDir, keyword, categoryFilter, availabilityFilter, showToast]
  );

  useEffect(() => {
    fetchProducts({ isInitial: true });
  }, [fetchProducts]);

  const categoryNameById = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[Number(c.id)] = c.name;
    });
    return map;
  }, [categories]);

  const availableOnPageCount = useMemo(
    () => products.filter((p) => p.isAvailable).length,
    [products]
  );

  const hasActiveFilters = Boolean(
    keywordInput.trim() || categoryFilter || availabilityFilter !== 'ALL'
  );

  const handleResetFilters = () => {
    setKeywordInput('');
    setKeyword('');
    setCategoryFilter('');
    setAvailabilityFilter('ALL');
    setPage(0);
  };

  // Mở modal thêm mới
  const handleOpenCreate = () => {
    setModalState({
      open: true,
      editingProduct: null,
      form: {
        ...INITIAL_PRODUCT_FORM,
        categoryId: categories[0]?.id ? String(categories[0].id) : '',
      },
      slugTouched: false,
      previewBroken: false,
      saving: false,
    });
  };

  // Mở modal chỉnh sửa
  const handleOpenEdit = (product) => {
    setModalState({
      open: true,
      editingProduct: product,
      form: {
        name: product.name || '',
        slug: product.slug || '',
        basePrice: product.basePrice ?? '',
        categoryId: product.categoryId ? String(product.categoryId) : '',
        description: product.description || '',
        imageUrl: product.imageUrl || '',
        isAvailable: product.isAvailable ?? true,
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

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const { form, editingProduct } = modalState;

    if (!form.name.trim()) {
      showToast('error', 'Vui lòng nhập tên sản phẩm.');
      return;
    }
    if (form.basePrice === '' || isNaN(Number(form.basePrice)) || Number(form.basePrice) < 0) {
      showToast('error', 'Vui lòng nhập giá bán hợp lệ.');
      return;
    }
    if (!form.categoryId) {
      showToast('error', 'Vui lòng chọn danh mục cho sản phẩm.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      slug: (form.slug.trim() || toSlug(form.name)).toLowerCase(),
      basePrice: Number(form.basePrice),
      description: form.description.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      isAvailable: Boolean(form.isAvailable),
      categoryId: Number(form.categoryId),
    };

    setModalState((prev) => ({ ...prev, saving: true }));
    try {
      if (editingProduct) {
        const res = await productService.updateProduct(editingProduct.id, payload);
        const updated = res?.result || {
          ...editingProduct,
          ...payload,
          categoryName:
            categoryNameById[Number(payload.categoryId)] || editingProduct.categoryName,
          updatedAt: new Date().toISOString(),
        };
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
        setBrokenImgIds((prev) => ({ ...prev, [editingProduct.id]: false }));
        showToast('success', `Đã cập nhật sản phẩm "${payload.name}".`);
      } else {
        await productService.createProduct(payload);
        showToast('success', `Đã thêm sản phẩm "${payload.name}" vào thực đơn.`);
        await fetchProducts({ isInitial: false });
      }
      setModalState((prev) => ({ ...prev, open: false, saving: false }));
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin sản phẩm.');
      setModalState((prev) => ({ ...prev, saving: false }));
    }
  };

  // Bật / tắt nhanh trạng thái Còn bán / Hết hàng ngay trên dòng bảng
  const handleToggleAvailability = async (product) => {
    const nextAvailable = !product.isAvailable;
    setTogglingId(product.id);
    try {
      const res = await productService.updateProduct(product.id, {
        name: product.name,
        slug: product.slug,
        basePrice: product.basePrice,
        description: product.description,
        imageUrl: product.imageUrl,
        isAvailable: nextAvailable,
        categoryId: product.categoryId,
      });
      const updated = res?.result || {
        ...product,
        isAvailable: nextAvailable,
        updatedAt: new Date().toISOString(),
      };
      setProducts((prev) => prev.map((p) => (p.id === product.id ? updated : p)));
      showToast(
        'success',
        `"${product.name}" → ${nextAvailable ? 'Đang mở bán' : 'Tạm hết hàng'}`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể cập nhật trạng thái bán.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Xác nhận xóa sản phẩm "${product.name}"?`)) return;
    setDeletingId(product.id);
    try {
      await productService.deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setTotalElements((prev) => Math.max(0, prev - 1));
      showToast('success', `Đã xóa sản phẩm "${product.name}".`);
    } catch (err) {
      showToast(
        'error',
        err?.message || 'Không thể xóa sản phẩm này (có thể đã phát sinh đơn hàng).'
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

  const previewCategoryName =
    categoryNameById[Number(modalState.form.categoryId)] || 'Chưa chọn danh mục';

  return (
    <div className="space-y-6 pb-16">
      {/* Header cam ấm với bố cục nút 2 tầng cân đối */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-amber-950 to-orange-900 text-white p-6 sm:p-8 shadow-md border border-orange-500/25 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="absolute -right-10 -top-12 w-64 h-64 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-16 w-56 h-56 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-orange-500/20 border border-orange-400/35 px-3 py-1 rounded-full">
            <Coffee className="w-3.5 h-3.5 text-orange-300" />
            <span>Danh mục món & Giá bán CoffeeHouse</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Quản lý Thực đơn & Sản phẩm
          </h1>
          <p className="text-sm text-amber-100/85">
            Thêm món mới, điều chỉnh giá bán, phân loại danh mục và trạng thái phục vụ
          </p>
        </div>

        {/* Cụm nút thao tác & thống kê sắp xếp 2 hàng gọn gàng */}
        <div className="relative z-10 flex flex-col items-start lg:items-end gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/categories"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-orange-400/30 bg-orange-950/75 hover:bg-orange-900/85 text-xs sm:text-sm font-semibold text-amber-100 transition-colors"
            >
              <FolderKanban className="w-4 h-4 text-orange-300" />
              <span>Quản lý danh mục</span>
            </Link>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm sản phẩm</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-orange-950/60 border border-orange-400/20 text-xs">
              <span className="text-amber-200/75">Tổng thực đơn:</span>
              <span className="font-extrabold text-amber-300">
                {totalElements} món ({availableOnPageCount} mở bán/trang)
              </span>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchProducts({ isInitial: false })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-orange-400/25 bg-orange-950/60 hover:bg-orange-900/80 text-xs font-semibold text-amber-100 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-orange-300 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm & bộ lọc */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Tìm theo từ khóa */}
          <div className="md:col-span-5 relative">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="Tìm tên món, mô tả hoặc slug..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Lọc theo danh mục */}
          <div className="md:col-span-4">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Tất cả danh mục ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="md:col-span-3 relative">
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="createdAt:desc">Mới thêm nhất</option>
              <option value="updatedAt:desc">Cập nhật gần nhất</option>
              <option value="basePrice:asc">Giá tăng dần</option>
              <option value="basePrice:desc">Giá giảm dần</option>
              <option value="name:asc">Tên A → Z</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Tabs lọc trạng thái bán */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'Tất cả món' },
              { key: 'AVAILABLE', label: 'Đang mở bán' },
              { key: 'UNAVAILABLE', label: 'Tạm hết hàng' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setAvailabilityFilter(st.key);
                  setPage(0);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  availabilityFilter === st.key
                    ? 'bg-orange-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {st.label}
              </button>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-600 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>

          <span className="text-xs text-stone-500">
            Tổng cộng: <strong className="text-stone-800">{totalElements}</strong> sản phẩm
          </span>
        </div>
      </div>

      {/* Bảng danh sách sản phẩm */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {initialLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Coffee className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-base font-bold text-stone-800">Không tìm thấy sản phẩm nào</p>
            <p className="text-sm text-stone-500">
              Thử thay đổi từ khóa, bộ lọc danh mục hoặc bấm &ldquo;Thêm sản phẩm&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-stone-500">
                  <th className="py-3.5 px-4">Sản phẩm</th>
                  <th className="py-3.5 px-4">Danh mục</th>
                  <th className="py-3.5 px-4 text-right">Giá niêm yết</th>
                  <th className="py-3.5 px-4">Trạng thái bán</th>
                  <th className="py-3.5 px-4">Thời gian</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {products.map((prod) => {
                  const catName =
                    prod.categoryName ||
                    categoryNameById[Number(prod.categoryId)] ||
                    'Chưa phân loại';
                  const hasValidImg = prod.imageUrl && !brokenImgIds[prod.id];
                  const isDeleting = deletingId === prod.id;

                  return (
                    <tr key={prod.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3.5 min-w-[240px] max-w-md">
                          <div className="w-14 h-14 rounded-xl bg-orange-50 border border-orange-200/70 overflow-hidden flex items-center justify-center shrink-0">
                            {hasValidImg ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                onError={() =>
                                  setBrokenImgIds((prev) => ({ ...prev, [prod.id]: true }))
                                }
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Coffee className="w-6 h-6 text-orange-700" />
                            )}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 shrink-0">
                                #{prod.id}
                              </span>
                              <p className="font-bold text-stone-800 truncate">{prod.name}</p>
                            </div>
                            <p className="text-xs font-mono text-stone-400 truncate">
                              /{prod.slug}
                            </p>
                            {prod.description && (
                              <p className="text-xs text-stone-500 line-clamp-1">
                                {prod.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-50 border border-orange-200/80 text-orange-900 text-xs font-semibold">
                          <FolderKanban className="w-3.5 h-3.5 text-orange-600" />
                          <span>{catName}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-extrabold text-orange-800 whitespace-nowrap">
                        {formatPrice(prod.basePrice)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={togglingId === prod.id}
                          onClick={() => handleToggleAvailability(prod)}
                          title="Bấm để đổi nhanh trạng thái mở bán"
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                            prod.isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              prod.isAvailable ? 'bg-emerald-500' : 'bg-stone-400'
                            }`}
                          />
                          <span>{prod.isAvailable ? 'Còn bán' : 'Hết hàng'}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <div className="space-y-0.5 text-stone-600">
                          <p className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>Tạo: {formatDateTime(prod.createdAt)}</span>
                          </p>
                          {prod.updatedAt && (
                            <p className="text-[11px] text-stone-400 pl-4">
                              Sửa: {formatDateTime(prod.updatedAt)}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteProduct(prod)}
                            title="Xóa sản phẩm"
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

      {/* Modal Thêm / Chỉnh sửa sản phẩm */}
      {modalState.open && (
        <div
          onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">
                  {modalState.editingProduct
                    ? `Cập nhật sản phẩm #${modalState.editingProduct.id}`
                    : 'Thêm sản phẩm mới'}
                </h2>
                {modalState.editingProduct && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Tạo lúc {formatDateTime(modalState.editingProduct.createdAt)} • Cập nhật gần
                    nhất {formatDateTime(modalState.editingProduct.updatedAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveProduct}
              className="p-5 overflow-y-auto space-y-3.5 text-sm"
            >
              {/* Thẻ xem trước nhanh sản phẩm */}
              <div className="p-3 rounded-xl bg-orange-50/40 border border-orange-200/70 flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl border border-stone-200 bg-white overflow-hidden flex items-center justify-center shrink-0">
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
                    <ImageIcon className="w-5 h-5 text-stone-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-stone-800 truncate">
                      {modalState.form.name.trim() || 'Tên sản phẩm xem trước'}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        modalState.form.isAvailable
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {modalState.form.isAvailable ? 'Còn bán' : 'Hết hàng'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">{previewCategoryName}</p>
                  <p className="text-sm font-extrabold text-orange-800">
                    {formatPrice(modalState.form.basePrice || 0)}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tên sản phẩm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modalState.form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Cà phê sữa đá Sài Gòn..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
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
                    placeholder="ca-phe-sua-da"
                    className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Danh mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={modalState.form.categoryId}
                    onChange={(e) =>
                      setModalState((prev) => ({
                        ...prev,
                        form: { ...prev.form, categoryId: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Giá cơ bản (VNĐ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={modalState.form.basePrice}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, basePrice: e.target.value },
                    }))
                  }
                  placeholder="35000"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  URL hình ảnh sản phẩm
                </label>
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
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Mô tả hương vị / ghi chú
                </label>
                <textarea
                  rows={3}
                  value={modalState.form.description}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, description: e.target.value },
                    }))
                  }
                  placeholder="Mô tả ngắn gọn về thành phần, hương vị..."
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={modalState.form.isAvailable}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      form: { ...prev.form, isAvailable: e.target.checked },
                    }))
                  }
                  className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <span>Sẵn sàng mở bán trên thực đơn</span>
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
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {modalState.saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
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

export default AdminProductsPage;