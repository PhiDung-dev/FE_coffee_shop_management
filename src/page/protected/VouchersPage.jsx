import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Ticket,
  Gift,
  Wallet,
  Copy,
  Check,
  Plus,
  Search,
  RefreshCw,
  Clock,
  Tag,
  Sparkles,
  Trash2,
  Edit3,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  Power,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import voucherService from '../../service/voucherService';
import userVoucherService from '../../service/userVoucherService';
import accountService from '../../service/accountService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const formatPrice = (price) => {
  if (price == null || isNaN(price)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(Number(price));
};

const formatDateTime = (iso) => {
  if (!iso) return 'Không giới hạn';
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
  return String(iso).slice(0, 16);
};

const toBackendLocalDateTime = (val) => {
  if (!val) return null;
  return val.length === 16 ? `${val}:00` : val;
};

const isExpired = (endDate) => {
  if (!endDate) return false;
  const d = new Date(endDate);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
};

const formatDiscountBadge = (discountType, discountValue) => {
  const type = (discountType || '').toUpperCase();
  if (type === 'PERCENTAGE' || type === 'PERCENT') {
    return `Giảm ${Number(discountValue || 0)}%`;
  }
  return `Giảm ${formatPrice(discountValue)}`;
};

const INITIAL_VOUCHER_FORM = {
  title: '',
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  maxDiscountAmount: '',
  minOrderValue: '0',
  startDate: '',
  endDate: '',
  usageLimit: '100',
  isActive: true,
};

const VouchersPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;
  const rawRole = (claims?.role || user?.role || '').toUpperCase();
  const isStaff = rawRole.includes('STAFF');
  const isAdmin = rawRole.includes('ADMIN');
  const isStaffOrAdmin = isStaff || isAdmin;

  // Tab mặc định: Staff/Admin vào thẳng tab ưu đãi & tra cứu quầy; Customer vào săn ưu đãi
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' | 'WALLET' | 'MANAGE'

  // Dữ liệu từ API
  const [activeVouchers, setActiveVouchers] = useState([]);
  const [allVouchers, setAllVouchers] = useState([]);
  const [myWallet, setMyWallet] = useState([]);

  // Bộ lọc & tìm kiếm
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'PERCENTAGE' | 'FIXED_AMOUNT'
  const [walletFilter, setWalletFilter] = useState('AVAILABLE'); // 'AVAILABLE' | 'HISTORY'

  // Trạng thái tải & phản hồi
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Staff: Tra cứu nhanh theo mã code (GET /api/vouchers/code/{code})
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Staff/Admin: Modal tặng voucher cho khách hàng (POST /api/user-vouchers)
  const [giftModal, setGiftModal] = useState({
    open: false,
    voucher: null,
    customerAccounts: [],
    loadingCustomers: false,
    targetAccountId: '',
    sending: false,
  });

  // Staff/Admin: Modal tạo / cập nhật voucher (POST / PUT /api/vouchers)
  const [formModal, setFormModal] = useState({
    open: false,
    editingVoucher: null,
    form: INITIAL_VOUCHER_FORM,
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const requests = [voucherService.getActiveVouchers()];

      if (isStaffOrAdmin) {
        requests.push(voucherService.getAllVouchers().catch(() => ({ result: [] })));
      } else if (accountId) {
        requests.push(
          userVoucherService.getUserVouchersByAccountId(accountId).catch(() => ({ result: [] }))
        );
      }

      const [activeRes, secondRes] = await Promise.all(requests);
      setActiveVouchers(Array.isArray(activeRes?.result) ? activeRes.result : []);

      if (isStaffOrAdmin) {
        setAllVouchers(Array.isArray(secondRes?.result) ? secondRes.result : []);
      } else if (accountId) {
        setMyWallet(Array.isArray(secondRes?.result) ? secondRes.result : []);
      }
    } catch (err) {
      showToast('error', err?.message || 'Không thể tải danh sách ưu đãi.');
    } finally {
      setLoading(false);
    }
  }, [accountId, isStaffOrAdmin, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Tập ID voucher khách hàng đã lưu chưa dùng (để hiển thị trạng thái "Đã lưu")
  const savedUnUsedVoucherIds = useMemo(() => {
    const ids = new Set();
    myWallet.forEach((uv) => {
      if (!uv.isUsed && !isExpired(uv.voucherEndDate)) {
        ids.add(Number(uv.voucherId));
      }
    });
    return ids;
  }, [myWallet]);

  // Lọc danh sách voucher đang chạy
  const filteredActiveVouchers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return activeVouchers.filter((v) => {
      const vType = (v.discountType || '').toUpperCase();
      const matchType =
        typeFilter === 'ALL' ||
        (typeFilter === 'PERCENTAGE' && (vType === 'PERCENTAGE' || vType === 'PERCENT')) ||
        (typeFilter === 'FIXED_AMOUNT' && vType !== 'PERCENTAGE' && vType !== 'PERCENT');

      const matchQuery =
        !q ||
        (v.code || '').toLowerCase().includes(q) ||
        (v.title || '').toLowerCase().includes(q);

      return matchType && matchQuery;
    });
  }, [activeVouchers, keyword, typeFilter]);

  // Lọc ví voucher của khách hàng
  const filteredWallet = useMemo(() => {
    return myWallet.filter((uv) => {
      const expired = isExpired(uv.voucherEndDate);
      const canUse = !uv.isUsed && !expired;
      return walletFilter === 'AVAILABLE' ? canUse : !canUse;
    });
  }, [myWallet, walletFilter]);

  // Lọc toàn bộ voucher cho Staff/Admin quản lý
  const filteredAllVouchers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return allVouchers.filter((v) => {
      if (!q) return true;
      return (
        (v.code || '').toLowerCase().includes(q) || (v.title || '').toLowerCase().includes(q)
      );
    });
  }, [allVouchers, keyword]);

  const handleCopyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast('success', `Đã sao chép mã "${code}"`);
      setTimeout(() => setCopiedCode(''), 2000);
    } catch {
      showToast('error', 'Không thể sao chép tự động, vui lòng bôi đen mã.');
    }
  };

  // Customer bấm "Lưu vào ví"
  const handleClaimVoucher = async (voucher) => {
    if (!token || !accountId) {
      navigate('/login');
      return;
    }

    setClaimingId(voucher.id);
    try {
      const res = await userVoucherService.createUserVoucher({
        accountId: Number(accountId),
        voucherId: Number(voucher.id),
      });
      if (res?.result) {
        setMyWallet((prev) => [res.result, ...prev]);
      } else {
        const walletRes = await userVoucherService.getUserVouchersByAccountId(accountId);
        setMyWallet(Array.isArray(walletRes?.result) ? walletRes.result : []);
      }
      showToast('success', `Đã lưu mã ${voucher.code} vào ví ưu đãi của bạn!`);
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu mã ưu đãi này.');
    } finally {
      setClaimingId(null);
    }
  };

  // Customer xóa voucher khỏi ví cá nhân
  const handleRemoveFromWallet = async (userVoucher) => {
    try {
      await userVoucherService.deleteUserVoucher(userVoucher.id);
      setMyWallet((prev) => prev.filter((item) => item.id !== userVoucher.id));
      showToast('success', `Đã gỡ mã ${userVoucher.voucherCode} khỏi ví.`);
    } catch (err) {
      showToast('error', err?.message || 'Không thể xóa voucher khỏi ví.');
    }
  };

  // Staff tra cứu nhanh voucher theo mã code
  const handleLookupByCode = async (e) => {
    e.preventDefault();
    const trimmed = lookupCode.trim().toUpperCase();
    if (!trimmed) return;

    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await voucherService.getVoucherByCode(trimmed);
      setLookupResult(res?.result || null);
    } catch (err) {
      showToast('error', err?.message || `Không tìm thấy mã voucher "${trimmed}".`);
    } finally {
      setLookupLoading(false);
    }
  };

  // Staff/Admin mở modal tặng voucher cho khách hàng
  const handleOpenGiftModal = async (voucher) => {
    setGiftModal({
      open: true,
      voucher,
      customerAccounts: [],
      loadingCustomers: true,
      targetAccountId: '',
      sending: false,
    });

    try {
      const accRes = await accountService.getAllAccounts();
      const list = Array.isArray(accRes?.result) ? accRes.result : [];
      const customers = list.filter((a) =>
        (a.roleName || '').toUpperCase().includes('CUSTOMER')
      );
      setGiftModal((prev) => ({
        ...prev,
        customerAccounts: customers.length > 0 ? customers : list,
        loadingCustomers: false,
      }));
    } catch {
      // Nếu role STAFF không có quyền gọi GET /api/accounts -> cho phép nhập trực tiếp accountId
      setGiftModal((prev) => ({
        ...prev,
        customerAccounts: [],
        loadingCustomers: false,
      }));
    }
  };

  const handleSubmitGiftVoucher = async (e) => {
    e.preventDefault();
    if (!giftModal.voucher || !giftModal.targetAccountId) {
      showToast('error', 'Vui lòng chọn hoặc nhập mã tài khoản khách hàng.');
      return;
    }

    setGiftModal((prev) => ({ ...prev, sending: true }));
    try {
      await userVoucherService.createUserVoucher({
        accountId: Number(giftModal.targetAccountId),
        voucherId: Number(giftModal.voucher.id),
      });
      showToast(
        'success',
        `Đã tặng mã ${giftModal.voucher.code} cho khách hàng #${giftModal.targetAccountId}.`
      );
      setGiftModal((prev) => ({ ...prev, open: false, sending: false }));
    } catch (err) {
      showToast('error', err?.message || 'Không thể tặng voucher cho tài khoản này.');
      setGiftModal((prev) => ({ ...prev, sending: false }));
    }
  };

  // Staff/Admin mở modal tạo / sửa voucher
  const handleOpenCreateVoucher = () => {
    setFormModal({
      open: true,
      editingVoucher: null,
      form: INITIAL_VOUCHER_FORM,
      saving: false,
    });
  };

  const handleOpenEditVoucher = (voucher) => {
    setFormModal({
      open: true,
      editingVoucher: voucher,
      form: {
        title: voucher.title || '',
        code: voucher.code || '',
        discountType: voucher.discountType || 'PERCENTAGE',
        discountValue: voucher.discountValue ?? '',
        maxDiscountAmount: voucher.maxDiscountAmount ?? '',
        minOrderValue: voucher.minOrderValue ?? '0',
        startDate: toDateTimeLocalInput(voucher.startDate),
        endDate: toDateTimeLocalInput(voucher.endDate),
        usageLimit: voucher.usageLimit ?? '100',
        isActive: voucher.isActive ?? true,
      },
      saving: false,
    });
  };

  const handleSaveVoucherForm = async (e) => {
    e.preventDefault();
    const { form, editingVoucher } = formModal;

    if (!form.title.trim() || !form.code.trim() || !form.discountValue) {
      showToast('error', 'Vui lòng nhập Tên chương trình, Mã code và Mức giảm.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxDiscountAmount:
        form.discountType === 'PERCENTAGE' && form.maxDiscountAmount !== ''
          ? Number(form.maxDiscountAmount)
          : null,
      minOrderValue: form.minOrderValue !== '' ? Number(form.minOrderValue) : 0,
      startDate: toBackendLocalDateTime(form.startDate),
      endDate: toBackendLocalDateTime(form.endDate),
      usageLimit: form.usageLimit !== '' ? Number(form.usageLimit) : null,
      isActive: Boolean(form.isActive),
    };

    setFormModal((prev) => ({ ...prev, saving: true }));
    try {
      if (editingVoucher) {
        await voucherService.updateVoucher(editingVoucher.id, payload);
        showToast('success', `Đã cập nhật voucher ${payload.code}.`);
      } else {
        await voucherService.createVoucher(payload);
        showToast('success', `Đã tạo mới voucher ${payload.code}.`);
      }
      setFormModal((prev) => ({ ...prev, open: false, saving: false }));
      await fetchData();
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin voucher.');
      setFormModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Bật / tắt nhanh trạng thái hoạt động của voucher (cập nhật tại chỗ)
  const handleToggleVoucherActive = async (voucher) => {
    const nextState = !voucher.isActive;
    try {
      const res = await voucherService.updateVoucher(voucher.id, {
        title: voucher.title,
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        maxDiscountAmount: voucher.maxDiscountAmount,
        minOrderValue: voucher.minOrderValue,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        usageLimit: voucher.usageLimit,
        isActive: nextState,
      });
      const updated = res?.result || { ...voucher, isActive: nextState };
      setAllVouchers((prev) => prev.map((v) => (v.id === voucher.id ? updated : v)));
      if (nextState) {
        setActiveVouchers((prev) =>
          prev.some((v) => v.id === voucher.id) ? prev : [updated, ...prev]
        );
      } else {
        setActiveVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
      }
      showToast(
        'success',
        `Đã ${nextState ? 'kích hoạt' : 'tạm ngưng'} mã ${voucher.code}.`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể thay đổi trạng thái voucher.');
    }
  };

  const handleDeleteVoucher = async (voucher) => {
    if (!window.confirm(`Xác nhận xóa vĩnh viễn voucher "${voucher.code}"?`)) return;
    try {
      await voucherService.deleteVoucher(voucher.id);
      setAllVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
      setActiveVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
      showToast('success', `Đã xóa voucher ${voucher.code}.`);
    } catch (err) {
      showToast('error', err?.message || 'Không thể xóa voucher này.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-stone-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-amber-100 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isStaffOrAdmin ? 'Trung tâm Khuyến mãi & Điều phối Voucher' : 'Ưu đãi & Quà tặng'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {isStaffOrAdmin ? 'Ưu đãi & Quản lý Voucher' : 'Săn mã giảm giá & Ví ưu đãi'}
          </h1>
          <p className="text-sm text-amber-100/90 max-w-xl">
            {isStaffOrAdmin
              ? 'Tra cứu nhanh mã khuyến mãi tại quầy, gửi tặng voucher tri ân khách hàng và quản lý các chương trình ưu đãi.'
              : 'Lưu mã khuyến mãi vào ví cá nhân hoặc sao chép trực tiếp để áp dụng khi đặt đồ uống.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {isStaffOrAdmin ? (
            <button
              type="button"
              onClick={handleOpenCreateVoucher}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo voucher mới</span>
            </button>
          ) : (
            <Link
              to="/menu"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 text-sm font-bold shadow-xs transition-colors"
            >
              <span>Đặt món ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Thanh chuyển Tab theo vai trò */}
      <div className="bg-white rounded-2xl border border-stone-200 p-2 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-amber-700 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>{isStaffOrAdmin ? 'Ưu đãi đang áp dụng' : 'Săn ưu đãi'}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'ACTIVE'
                  ? 'bg-amber-800 text-amber-100'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {activeVouchers.length}
            </span>
          </button>

          {!isStaffOrAdmin && accountId && (
            <button
              type="button"
              onClick={() => setActiveTab('WALLET')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'WALLET'
                  ? 'bg-amber-700 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Ví voucher của tôi</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'WALLET'
                    ? 'bg-amber-800 text-amber-100'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {myWallet.filter((uv) => !uv.isUsed && !isExpired(uv.voucherEndDate)).length}
              </span>
            </button>
          )}

          {isStaffOrAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('MANAGE')}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'MANAGE'
                  ? 'bg-amber-700 text-white'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Kho voucher hệ thống</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'MANAGE'
                    ? 'bg-amber-800 text-amber-100'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {allVouchers.length}
              </span>
            </button>
          )}
        </div>

        {/* Ô tìm kiếm */}
        {activeTab !== 'WALLET' && (
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo mã code hoặc tên ưu đãi..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
            />
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        )}
      </div>

      {/* Khu vực tra cứu mã nhanh dành riêng cho Staff/Admin tại quầy */}
      {isStaffOrAdmin && activeTab === 'ACTIVE' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
          <form
            onSubmit={handleLookupByCode}
            className="flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-600 shrink-0">
              <Tag className="w-4 h-4 text-amber-700" />
              <span>Kiểm tra nhanh mã khách đưa:</span>
            </div>

            <div className="flex flex-1 gap-2">
              <input
                type="text"
                value={lookupCode}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã voucher (VD: WELCOME20)..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
              <button
                type="submit"
                disabled={lookupLoading || !lookupCode.trim()}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                {lookupLoading ? 'Đang tra...' : 'Tra cứu'}
              </button>
            </div>
          </form>

          {lookupResult && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-amber-900 text-sm">
                    {lookupResult.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      lookupResult.isActive && !isExpired(lookupResult.endDate)
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {lookupResult.isActive && !isExpired(lookupResult.endDate)
                      ? 'Hợp lệ'
                      : 'Ngưng hoạt động / Hết hạn'}
                  </span>
                </div>
                <p className="text-stone-700 font-medium">{lookupResult.title}</p>
                <p className="text-stone-500">
                  {formatDiscountBadge(lookupResult.discountType, lookupResult.discountValue)} •
                  Đơn tối thiểu: {formatPrice(lookupResult.minOrderValue)} • Đã dùng:{' '}
                  {lookupResult.usedCount ?? 0}/{lookupResult.usageLimit ?? '∞'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyCode(lookupResult.code)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 font-semibold cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLookupResult(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: SĂN ƯU ĐÃI / ƯU ĐÃI ĐANG ÁP DỤNG */}
      {activeTab === 'ACTIVE' && (
        <div className="space-y-4">
          {/* Lọc nhanh theo loại giảm giá */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'Tất cả ưu đãi' },
              { key: 'PERCENTAGE', label: 'Giảm theo %' },
              { key: 'FIXED_AMOUNT', label: 'Giảm tiền trực tiếp' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTypeFilter(item.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === item.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, idx) => (
                <div
                  key={idx}
                  className="h-44 rounded-2xl bg-white border border-stone-200 animate-pulse"
                />
              ))}
            </div>
          ) : filteredActiveVouchers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center space-y-2">
              <Ticket className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-base font-bold text-stone-800">
                Hiện chưa có mã ưu đãi nào phù hợp
              </p>
              <p className="text-sm text-stone-500">
                Vui lòng quay lại sau hoặc thử bỏ bộ lọc tìm kiếm.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredActiveVouchers.map((voucher) => {
                const isPercent =
                  (voucher.discountType || '').toUpperCase() === 'PERCENTAGE' ||
                  (voucher.discountType || '').toUpperCase() === 'PERCENT';
                const remaining =
                  voucher.usageLimit != null
                    ? Math.max(0, Number(voucher.usageLimit) - Number(voucher.usedCount || 0))
                    : null;
                const isOutOfStock = remaining !== null && remaining <= 0;
                const alreadySaved = savedUnUsedVoucherIds.has(Number(voucher.id));

                return (
                  <div
                    key={voucher.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col sm:flex-row"
                  >
                    {/* Cột trái: Giá trị giảm giá nổi bật kiểu vé */}
                    <div className="sm:w-40 bg-amber-50 border-b sm:border-b-0 sm:border-r border-dashed border-amber-300 p-4 flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                        {isPercent ? 'Ưu đãi %' : 'Voucher'}
                      </span>
                      <p className="text-xl font-extrabold text-amber-900 mt-1">
                        {isPercent
                          ? `${Number(voucher.discountValue || 0)}%`
                          : formatPrice(voucher.discountValue)}
                      </p>
                      {isPercent && Number(voucher.maxDiscountAmount) > 0 && (
                        <span className="text-[11px] text-amber-800 mt-1">
                          Tối đa {formatPrice(voucher.maxDiscountAmount)}
                        </span>
                      )}
                    </div>

                    {/* Cột phải: Điều kiện & nút thao tác */}
                    <div className="flex-1 p-4 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-stone-800 text-sm sm:text-base leading-snug">
                            {voucher.title}
                          </h3>
                          {remaining !== null && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                                isOutOfStock
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {isOutOfStock ? 'Hết lượt' : `Còn ${remaining} lượt`}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-stone-600">
                          Đơn tối thiểu:{' '}
                          <strong className="text-stone-800">
                            {Number(voucher.minOrderValue) > 0
                              ? formatPrice(voucher.minOrderValue)
                              : '0 ₫ (Mọi đơn)'}
                          </strong>
                        </p>

                        <p className="text-xs text-stone-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>HSD: {formatDateTime(voucher.endDate)}</span>
                        </p>
                      </div>

                      {/* Thanh mã code + nút bấm */}
                      <div className="pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(voucher.code)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-mono text-xs font-extrabold cursor-pointer"
                        >
                          <span>{voucher.code}</span>
                          {copiedCode === voucher.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-stone-500" />
                          )}
                        </button>

                        {isStaffOrAdmin ? (
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleOpenGiftModal(voucher)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Tặng khách</span>
                          </button>
                        ) : alreadySaved ? (
                          <Link
                            to="/menu"
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Đã lưu • Dùng ngay</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock || claimingId === voucher.id}
                            onClick={() => handleClaimVoucher(voucher)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>
                              {claimingId === voucher.id ? 'Đang lưu...' : 'Lưu vào ví'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VÍ VOUCHER CỦA TÔI (Dành cho Customer) */}
      {activeTab === 'WALLET' && !isStaffOrAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[
              { key: 'AVAILABLE', label: 'Có thể sử dụng' },
              { key: 'HISTORY', label: 'Đã dùng / Hết hạn' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setWalletFilter(st.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                  walletFilter === st.key
                    ? 'bg-stone-800 text-white'
                    : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {filteredWallet.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 py-16 text-center space-y-3">
              <Wallet className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-base font-bold text-stone-800">
                {walletFilter === 'AVAILABLE'
                  ? 'Ví voucher của bạn đang trống'
                  : 'Chưa có lịch sử sử dụng voucher'}
              </p>
              {walletFilter === 'AVAILABLE' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ACTIVE')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Gift className="w-4 h-4" />
                  <span>Đi săn ưu đãi ngay</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredWallet.map((uv) => {
                const expired = isExpired(uv.voucherEndDate);
                const usable = !uv.isUsed && !expired;

                return (
                  <div
                    key={uv.id}
                    className={`bg-white rounded-2xl border p-4 shadow-2xs flex flex-col justify-between gap-3 ${
                      usable ? 'border-stone-200' : 'border-stone-200 opacity-70 bg-stone-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-mono text-xs font-extrabold">
                          {uv.voucherCode}
                        </span>
                        <h3 className="font-bold text-stone-800 text-sm">{uv.voucherTitle}</h3>
                        <p className="text-xs font-semibold text-amber-800">
                          {formatDiscountBadge(uv.discountType, uv.discountValue)}
                          {Number(uv.maxDiscountAmount) > 0
                            ? ` (Tối đa ${formatPrice(uv.maxDiscountAmount)})`
                            : ''}
                        </p>
                        <p className="text-xs text-stone-500">
                          Đơn tối thiểu: {formatPrice(uv.minOrderValue)} • HSD:{' '}
                          {formatDateTime(uv.voucherEndDate)}
                        </p>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
                          uv.isUsed
                            ? 'bg-stone-200 text-stone-700'
                            : expired
                              ? 'bg-red-50 text-red-600'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {uv.isUsed ? 'Đã sử dụng' : expired ? 'Đã hết hạn' : 'Sẵn sàng dùng'}
                      </span>
                    </div>

                    <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
                      {usable ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(uv.voucherCode)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép mã</span>
                          </button>

                          <Link
                            to="/menu"
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold"
                          >
                            <span>Dùng đặt món</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400">
                          {uv.usedAt ? `Dùng lúc: ${formatDateTime(uv.usedAt)}` : 'Không còn hiệu lực'}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveFromWallet(uv)}
                        title="Xóa khỏi ví"
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUẢN LÝ KHO VOUCHER HỆ THỐNG (Dành cho Staff / Admin) */}
      {activeTab === 'MANAGE' && isStaffOrAdmin && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
          {filteredAllVouchers.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Ticket className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-base font-bold text-stone-800">Chưa có voucher nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase text-stone-500">
                    <th className="py-3.5 px-4">Mã / Chương trình</th>
                    <th className="py-3.5 px-4">Mức giảm</th>
                    <th className="py-3.5 px-4">Đơn tối thiểu</th>
                    <th className="py-3.5 px-4">Lượt dùng</th>
                    <th className="py-3.5 px-4">Hiệu lực</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAllVouchers.map((v) => {
                    const expired = isExpired(v.endDate);
                    return (
                      <tr key={v.id} className="hover:bg-stone-50/70">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-extrabold text-amber-800">{v.code}</span>
                          <p className="text-xs text-stone-600 mt-0.5">{v.title}</p>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-stone-800">
                          {formatDiscountBadge(v.discountType, v.discountValue)}
                          {Number(v.maxDiscountAmount) > 0 && (
                            <p className="text-[11px] font-normal text-stone-500">
                              Tối đa {formatPrice(v.maxDiscountAmount)}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-stone-700">
                          {formatPrice(v.minOrderValue)}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-stone-700">
                          {v.usedCount ?? 0} / {v.usageLimit ?? '∞'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-stone-500">
                          {formatDateTime(v.endDate)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              v.isActive && !expired
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {expired ? 'Hết hạn' : v.isActive ? 'Đang chạy' : 'Tạm ngưng'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenGiftModal(v)}
                              title="Tặng khách hàng"
                              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleVoucherActive(v)}
                              title={v.isActive ? 'Tạm ngưng' : 'Kích hoạt'}
                              className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditVoucher(v)}
                              title="Chỉnh sửa"
                              className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-amber-800 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteVoucher(v)}
                                title="Xóa voucher"
                                className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
      )}

      {/* Modal 1: Staff/Admin tặng voucher vào ví khách hàng */}
      {giftModal.open && giftModal.voucher && (
        <div
          onClick={() => setGiftModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-stone-800">
                  Tặng voucher {giftModal.voucher.code}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">{giftModal.voucher.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setGiftModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGiftVoucher} className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Chọn khách hàng nhận ưu đãi <span className="text-red-500">*</span>
                </label>

                {giftModal.loadingCustomers ? (
                  <div className="h-10 rounded-xl bg-stone-100 animate-pulse" />
                ) : giftModal.customerAccounts.length > 0 ? (
                  <select
                    value={giftModal.targetAccountId}
                    onChange={(e) =>
                      setGiftModal((prev) => ({ ...prev, targetAccountId: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">-- Chọn tài khoản khách hàng --</option>
                    {giftModal.customerAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        #{acc.id} • {acc.email} {acc.phone ? `(${acc.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={giftModal.targetAccountId}
                    onChange={(e) =>
                      setGiftModal((prev) => ({ ...prev, targetAccountId: e.target.value }))
                    }
                    placeholder="Nhập ID tài khoản khách hàng (accountId)..."
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGiftModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={giftModal.sending || !giftModal.targetAccountId}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {giftModal.sending ? 'Đang gửi...' : 'Xác nhận tặng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Staff/Admin tạo hoặc chỉnh sửa Voucher */}
      {formModal.open && (
        <div
          onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-stone-800">
                {formModal.editingVoucher
                  ? `Cập nhật voucher ${formModal.editingVoucher.code}`
                  : 'Tạo chương trình voucher mới'}
              </h2>
              <button
                type="button"
                onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveVoucherForm}
              className="p-5 overflow-y-auto space-y-3.5 text-sm"
            >
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Tên chương trình ưu đãi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formModal.form.title}
                  onChange={(e) =>
                    setFormModal((prev) => ({
                      ...prev,
                      form: { ...prev.form, title: e.target.value },
                    }))
                  }
                  placeholder="Giảm 20% mừng khai trương..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Mã voucher (Code) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formModal.form.code}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, code: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="COFFEE20"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Loại giảm giá
                  </label>
                  <select
                    value={formModal.form.discountType}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, discountType: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white"
                  >
                    <option value="PERCENTAGE">Theo phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Giá trị giảm ({formModal.form.discountType === 'PERCENTAGE' ? '%' : 'VNĐ'}){' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formModal.form.discountValue}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, discountValue: e.target.value },
                      }))
                    }
                    placeholder={formModal.form.discountType === 'PERCENTAGE' ? '20' : '15000'}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>

                {formModal.form.discountType === 'PERCENTAGE' && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Giảm tối đa (VNĐ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formModal.form.maxDiscountAmount}
                      onChange={(e) =>
                        setFormModal((prev) => ({
                          ...prev,
                          form: { ...prev.form, maxDiscountAmount: e.target.value },
                        }))
                      }
                      placeholder="30000"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Đơn tối thiểu (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formModal.form.minOrderValue}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, minOrderValue: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Giới hạn lượt sử dụng
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formModal.form.usageLimit}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, usageLimit: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Thời gian bắt đầu
                  </label>
                  <input
                    type="datetime-local"
                    value={formModal.form.startDate}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, startDate: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Thời gian kết thúc
                  </label>
                  <input
                    type="datetime-local"
                    value={formModal.form.endDate}
                    onChange={(e) =>
                      setFormModal((prev) => ({
                        ...prev,
                        form: { ...prev.form, endDate: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formModal.form.isActive}
                  onChange={(e) =>
                    setFormModal((prev) => ({
                      ...prev,
                      form: { ...prev.form, isActive: e.target.checked },
                    }))
                  }
                  className="rounded border-stone-300 text-amber-700 focus:ring-amber-600"
                />
                <span>Kích hoạt áp dụng ngay</span>
              </label>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formModal.saving}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold cursor-pointer"
                >
                  {formModal.saving ? 'Đang lưu...' : 'Lưu voucher'}
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

export default VouchersPage;