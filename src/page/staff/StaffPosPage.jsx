import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Coffee,
  Search,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Ticket,
  RefreshCw,
  Store,
} from 'lucide-react';
import categoryService from '../../service/categoryService';
import productService from '../../service/productService';
import tableService from '../../service/tableService';
import orderService from '../../service/orderService';
import orderItemService from '../../service/orderItemService';
import paymentService from '../../service/paymentService';
import voucherService from '../../service/voucherService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const QUICK_NOTES = ['Ít đá', 'Ít đường', 'Không đường', 'Nhiều sữa'];

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const PosProductThumb = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/70 flex items-center justify-center shrink-0">
        <Coffee className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0"
    />
  );
};

const StaffPosPage = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const claims = token ? parseJwt(token) : null;
  const staffAccountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  // Dữ liệu thực đơn, bàn, voucher
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [loadingMenu, setLoadingMenu] = useState(true);

  // Loại đơn: 'DINE_IN' | 'TAKEAWAY'
  const [orderType, setOrderType] = useState('DINE_IN');
  const [selectedTableId, setSelectedTableId] = useState(() => searchParams.get('tableId') || '');

  // Đơn đang mở tại bàn (nếu bàn đang phục vụ)
  const [activeTableOrder, setActiveTableOrder] = useState(null);
  const [loadingTableOrder, setLoadingTableOrder] = useState(false);

  // Giỏ món mới chưa gửi bếp
  const [draftItems, setDraftItems] = useState([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState('CASH');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchInitialPosData = useCallback(async () => {
    setLoadingMenu(true);
    try {
      const [catRes, prodRes, tableRes, voucherRes] = await Promise.all([
        categoryService.getActiveCategories(),
        productService.getAllProducts({ page: 0, size: 100, isAvailable: true }),
        tableService.getAllTables(),
        voucherService.getActiveVouchers().catch(() => null),
      ]);

      setCategories(Array.isArray(catRes?.result) ? catRes.result : []);
      setProducts(Array.isArray(prodRes?.result?.content) ? prodRes.result.content : []);
      setTables(Array.isArray(tableRes?.result) ? tableRes.result : []);
      setVouchers(Array.isArray(voucherRes?.result) ? voucherRes.result : []);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Không thể tải dữ liệu POS.' });
    } finally {
      setLoadingMenu(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialPosData();
  }, [fetchInitialPosData]);

  // Khi chọn bàn -> kiểm tra xem bàn có đơn hàng đang mở hay không
  const fetchActiveOrderForTable = useCallback(async (tableId) => {
    if (!tableId) {
      setActiveTableOrder(null);
      return;
    }

    setLoadingTableOrder(true);
    try {
      const res = await orderService.getAllOrders({
        tableId: Number(tableId),
        page: 0,
        size: 5,
        sortBy: 'createdAt',
        sortDir: 'desc',
      });
      const list = Array.isArray(res?.result?.content) ? res.result.content : [];
      const openOrder = list.find(
        (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
      );
      setActiveTableOrder(openOrder || null);
    } catch {
      setActiveTableOrder(null);
    } finally {
      setLoadingTableOrder(false);
    }
  }, []);

  useEffect(() => {
    if (orderType === 'DINE_IN' && selectedTableId) {
      fetchActiveOrderForTable(selectedTableId);
    } else {
      setActiveTableOrder(null);
    }
  }, [orderType, selectedTableId, fetchActiveOrderForTable]);

  const handleSelectTable = (tableId) => {
    setSelectedTableId(tableId);
    setDraftItems([]);
    setFeedback({ type: '', message: '' });

    const next = new URLSearchParams(searchParams);
    if (tableId) next.set('tableId', tableId);
    else next.delete('tableId');
    setSearchParams(next);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        !selectedCategoryId || Number(p.categoryId) === Number(selectedCategoryId);
      const matchKey =
        !keyword.trim() ||
        (p.name || '').toLowerCase().includes(keyword.trim().toLowerCase());
      return matchCat && matchKey;
    });
  }, [products, selectedCategoryId, keyword]);

  const occupiedTablesCount = useMemo(
    () => tables.filter((t) => (t.status || '').toUpperCase() === 'OCCUPIED').length,
    [tables]
  );

  // Nếu bàn đã có đơn mở -> gọi POST /api/order-items để thêm thẳng vào đơn của bàn
  // Nếu chưa có đơn -> thêm vào danh sách tạm draftItems để tạo đơn mới
  const handleAddProduct = async (product) => {
    setFeedback({ type: '', message: '' });

    if (orderType === 'DINE_IN' && activeTableOrder) {
      setSubmitting(true);
      try {
        await orderItemService.createOrderItem({
          orderId: Number(activeTableOrder.id),
          productId: Number(product.id),
          quantity: 1,
          selectedOptions: null,
        });
        await fetchActiveOrderForTable(selectedTableId);
        setFeedback({
          type: 'success',
          message: `Đã thêm "${product.name}" vào đơn ${activeTableOrder.orderCode}.`,
        });
      } catch (err) {
        setFeedback({
          type: 'error',
          message: err?.message || 'Không thể thêm món vào đơn hiện tại.',
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setDraftItems((prev) => {
      const idx = prev.findIndex((item) => item.productId === product.id && !item.note);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [
        ...prev,
        {
          key: `${product.id}_${Date.now()}`,
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.basePrice) || 0,
          quantity: 1,
          note: '',
        },
      ];
    });
  };

  const handleUpdateDraftQty = (key, delta) => {
    setDraftItems((prev) =>
      prev
        .map((item) => (item.key === key ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleToggleDraftNote = (key, tag) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const parts = item.note ? item.note.split(', ').filter(Boolean) : [];
        const nextParts = parts.includes(tag)
          ? parts.filter((p) => p !== tag)
          : [...parts, tag];
        return { ...item, note: nextParts.join(', ') };
      })
    );
  };

  // Cập nhật số lượng / xóa món trên đơn đang mở tại bàn (OrderItemController)
  const handleUpdateExistingItemQty = async (item, delta) => {
    const nextQty = Number(item.quantity) + delta;
    setSubmitting(true);
    try {
      if (nextQty <= 0) {
        await orderItemService.deleteOrderItem(item.id);
      } else {
        await orderItemService.updateOrderItem(item.id, {
          productId: Number(item.productId),
          quantity: nextQty,
          selectedOptions: item.selectedOptions || null,
        });
      }
      await fetchActiveOrderForTable(selectedTableId);
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Không thể cập nhật món.' });
    } finally {
      setSubmitting(false);
    }
  };

  const draftSubtotal = useMemo(
    () => draftItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [draftItems]
  );

  // Tạo đơn hàng mới (POST /api/orders)
  const handleCreatePosOrder = async () => {
    if (orderType === 'DINE_IN' && !selectedTableId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn bàn phục vụ trước khi tạo đơn.' });
      return;
    }

    if (draftItems.length === 0) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn ít nhất 1 món.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const payload = {
        orderType,
        status: 'CONFIRMED',
        tableId: orderType === 'DINE_IN' ? Number(selectedTableId) : null,
        staffAccountId: staffAccountId ? Number(staffAccountId) : null,
        appliedVoucherId: selectedVoucherId ? Number(selectedVoucherId) : null,
        items: draftItems.map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
          selectedOptions: item.note || null,
        })),
      };

      const orderRes = await orderService.createOrder(payload);
      const createdOrder = orderRes?.result;

      if (orderType === 'DINE_IN' && selectedTableId) {
        await tableService.updateTableStatus(Number(selectedTableId), 'OCCUPIED').catch(() => null);
        await fetchInitialPosData();
        await fetchActiveOrderForTable(selectedTableId);
      } else if (createdOrder?.id) {
        await paymentService.createPayment({
          orderId: createdOrder.id,
          amount: createdOrder.finalAmount ?? draftSubtotal,
          paymentGateway: posPaymentMethod === 'VNPAY' ? 'VNPAY' : 'NONE',
          paymentMethod: posPaymentMethod,
        });
        await orderService.updateOrder(createdOrder.id, {
          orderType: 'TAKEAWAY',
          status: 'COMPLETED',
          staffAccountId: staffAccountId ? Number(staffAccountId) : null,
        });
      }

      setDraftItems([]);
      setSelectedVoucherId('');
      setFeedback({
        type: 'success',
        message: `Đã tạo đơn ${createdOrder?.orderCode || ''} thành công!`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Không thể tạo đơn hàng.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Thanh toán & Trả bàn cho đơn đang mở tại bàn
  const handleSettleTableOrder = async () => {
    if (!activeTableOrder) return;
    setSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      await paymentService.createPayment({
        orderId: Number(activeTableOrder.id),
        amount: activeTableOrder.finalAmount ?? activeTableOrder.subtotal ?? 0,
        paymentGateway: posPaymentMethod === 'VNPAY' ? 'VNPAY' : 'NONE',
        paymentMethod: posPaymentMethod,
      });

      await orderService.updateOrder(activeTableOrder.id, {
        orderType: activeTableOrder.orderType || 'DINE_IN',
        status: 'COMPLETED',
        tableId: Number(selectedTableId),
        staffAccountId: staffAccountId ? Number(staffAccountId) : null,
      });

      if (selectedTableId) {
        await tableService.updateTableStatus(Number(selectedTableId), 'AVAILABLE');
      }

      setActiveTableOrder(null);
      await fetchInitialPosData();
      setFeedback({
        type: 'success',
        message: `Đã thanh toán đơn ${activeTableOrder.orderCode} và trả bàn trống.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err?.message || 'Lỗi khi thanh toán đơn tại bàn.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-6 pb-12">
      {/* Header đồng bộ màu sắc với các trang khác */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 text-white p-6 sm:p-8 shadow-md border border-stone-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/25 px-3 py-1 rounded-full">
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span>Quầy thu ngân & Gọi món trực tiếp</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Bán hàng tại quầy (POS)
          </h1>
          <p className="text-sm text-stone-300 max-w-2xl">
            Mở bàn mới, gọi thêm món cho bàn đang phục vụ, áp dụng ưu đãi và thanh toán nhanh
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 self-start lg:self-center">
          <div className="px-4 py-2 rounded-2xl bg-stone-900/85 border border-stone-700/80 text-xs">
            <span className="text-stone-400 block">Bàn đang phục vụ</span>
            <span className="text-sm font-extrabold text-amber-300">
              {occupiedTablesCount} / {tables.length} bàn
            </span>
          </div>

          <button
            type="button"
            onClick={fetchInitialPosData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMenu ? 'animate-spin' : ''}`} />
            <span>Đồng bộ thực đơn</span>
          </button>
        </div>
      </div>

      {/* Khu vực làm việc 2 cột: Thực đơn & Phiếu Order */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (7 phần): Chọn món từ thực đơn */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">Danh sách món khả dụng</h2>
                <p className="text-xs text-stone-500">
                  Hiển thị {filteredProducts.length} món phù hợp
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm nhanh tên món..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Danh mục */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                  selectedCategoryId === null
                    ? 'bg-amber-700 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Tất cả món
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                    Number(selectedCategoryId) === Number(cat.id)
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Lưới món */}
          {loadingMenu ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-white border border-stone-200 animate-pulse"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-12 px-4 text-center text-sm text-stone-500">
              Không tìm thấy món nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleAddProduct(product)}
                  className="group bg-white rounded-2xl border border-stone-200 hover:border-amber-500 p-3.5 text-left transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <PosProductThumb src={product.imageUrl} alt={product.name} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        {product.categoryName || 'Đồ uống'}
                      </span>
                      <h3 className="text-sm font-bold text-stone-800 group-hover:text-amber-900 line-clamp-2 mt-0.5">
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-amber-800">
                      {formatPrice(product.basePrice)}
                    </span>
                    <span className="w-7 h-7 rounded-lg bg-amber-50 group-hover:bg-amber-700 text-amber-800 group-hover:text-white transition-colors flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cột phải (5 phần): Phiếu Order tại bàn / Mang về */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4 lg:sticky lg:top-20">
          {/* Chọn hình thức phục vụ */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-stone-100 border border-stone-200">
            <button
              type="button"
              onClick={() => setOrderType('DINE_IN')}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'DINE_IN'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Uống tại bàn</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOrderType('TAKEAWAY');
                setActiveTableOrder(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                orderType === 'TAKEAWAY'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Mang về</span>
            </button>
          </div>

          {/* Chọn bàn nếu là DINE_IN */}
          {orderType === 'DINE_IN' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                Chọn bàn phục vụ
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => handleSelectTable(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-medium text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                <option value="">-- Chọn bàn --</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tableNumber} ({t.areaName || 'Chung'}) - {t.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {feedback.message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                feedback.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Trường hợp 1: Bàn đang có đơn mở -> Quản lý trực tiếp các món trên đơn đó */}
          {loadingTableOrder ? (
            <div className="py-10 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Đang kiểm tra đơn tại bàn...</span>
            </div>
          ) : orderType === 'DINE_IN' && activeTableOrder ? (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-amber-800">Đơn đang mở: </span>
                  <strong className="font-mono text-amber-950">{activeTableOrder.orderCode}</strong>
                </div>
                <span className="px-2 py-0.5 rounded bg-white text-amber-800 font-bold">
                  Bấm món bên trái để gọi thêm
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                {(activeTableOrder.orderItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">{item.productName}</p>
                      <p className="text-xs text-stone-500">
                        {formatPrice(item.unitPrice)} x {item.quantity}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleUpdateExistingItemQty(item, -1)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleUpdateExistingItemQty(item, 1)}
                          className="p-1.5 text-stone-600 hover:text-stone-900 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-700">Tổng hóa đơn bàn</span>
                  <span className="text-xl font-extrabold text-amber-800">
                    {formatPrice(activeTableOrder.finalAmount ?? activeTableOrder.subtotal)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPosPaymentMethod('CASH')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      posPaymentMethod === 'CASH'
                        ? 'border-amber-600 bg-amber-50 text-amber-900'
                        : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tiền mặt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosPaymentMethod('VNPAY')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                      posPaymentMethod === 'VNPAY'
                        ? 'border-amber-600 bg-amber-50 text-amber-900'
                        : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Chuyển khoản / QR</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSettleTableOrder}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {submitting ? 'Đang xử lý...' : 'Thanh toán & Trả bàn'}
                </button>
              </div>
            </div>
          ) : (
            /* Trường hợp 2: Tạo đơn mới */
            <div className="space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
                {draftItems.length === 0 ? (
                  <div className="py-10 text-center text-xs text-stone-400 space-y-1.5">
                    <Coffee className="w-8 h-8 mx-auto text-stone-300" />
                    <p>Chưa chọn món nào. Bấm vào thẻ đồ uống bên trái để thêm.</p>
                  </div>
                ) : (
                  draftItems.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl border border-stone-200 bg-stone-50/70 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-stone-800 truncate">{item.name}</p>
                          <p className="text-xs font-semibold text-amber-800">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="inline-flex items-center rounded-lg border border-stone-300 bg-white">
                            <button
                              type="button"
                              onClick={() => handleUpdateDraftQty(item.key, -1)}
                              className="p-1 text-stone-600 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateDraftQty(item.key, 1)}
                              className="p-1 text-stone-600 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setDraftItems((prev) => prev.filter((d) => d.key !== item.key))
                            }
                            className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {QUICK_NOTES.map((tag) => {
                          const active = item.note.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleToggleDraftNote(item.key, tag)}
                              className={`px-2 py-0.5 rounded text-[11px] border cursor-pointer ${
                                active
                                  ? 'bg-amber-100 border-amber-400 text-amber-900 font-semibold'
                                  : 'bg-white border-stone-200 text-stone-500'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {vouchers.length > 0 && (
                <div>
                  <label className="flex items-center gap-1 text-xs font-semibold text-stone-600 mb-1">
                    <Ticket className="w-3.5 h-3.5 text-amber-700" />
                    <span>Áp dụng voucher (nếu có)</span>
                  </label>
                  <select
                    value={selectedVoucherId}
                    onChange={(e) => setSelectedVoucherId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">-- Không dùng voucher --</option>
                    {vouchers.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} - {v.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-stone-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-stone-700">Tạm tính</span>
                  <span className="text-xl font-extrabold text-amber-800">
                    {formatPrice(draftSubtotal)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={submitting || draftItems.length === 0}
                  onClick={handleCreatePosOrder}
                  className="w-full py-3 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {submitting
                    ? 'Đang gửi đơn...'
                    : orderType === 'DINE_IN'
                      ? 'Xác nhận mở bàn & Gửi pha chế'
                      : 'Tạo đơn mang về & Thu tiền'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffPosPage;