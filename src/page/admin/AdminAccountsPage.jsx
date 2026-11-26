import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Users,
  UserCog,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  Mail,
  Phone,
  ShieldCheck,
  Crown,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Calendar,
  Info,
  Image as ImageIcon,
} from 'lucide-react';
import accountService from '../../service/accountService';
import userService from '../../service/userService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';

const STATUS_META = {
  ACTIVE: {
    label: 'Hoạt động',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
    dotClass: 'bg-emerald-500',
  },
  INACTIVE: {
    label: 'Tạm khóa',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90',
    dotClass: 'bg-rose-500',
  },
};

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

const GENDER_LABEL = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

const getInitials = (name, email) => {
  const source = (name || email || 'U').trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

const normalizeStatus = (status) => {
  const up = (status || 'ACTIVE').toUpperCase();
  return up === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
};

const AdminAccountsPage = () => {
  const { user: authUser, token } = useAuth();
  const claims = useMemo(() => (token ? parseJwt(token) : null), [token]);

  const currentAccountId = useMemo(() => {
    const rawId =
      claims?.accountId ?? claims?.id ?? claims?.userId ?? authUser?.accountId ?? authUser?.id;
    return rawId != null && !isNaN(Number(rawId)) ? Number(rawId) : null;
  }, [claims, authUser]);

  // 2 Tab chính: 'STAFF' | 'CUSTOMER'
  const [activeTab, setActiveTab] = useState('STAFF');

  // Dữ liệu từ API
  const [accounts, setAccounts] = useState([]);
  const [users, setUsers] = useState([]);

  // Trạng thái tải & thông báo
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });
  const toastTimerRef = useRef(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [togglingId, setTogglingId] = useState(null);

  // Modal Xem chi tiết tài khoản & hồ sơ
  const [detailTarget, setDetailTarget] = useState(null);

  // Modal Thêm Staff / Cập nhật Tài khoản & Hồ sơ
  const [showPassword, setShowPassword] = useState(false);
  const [formModal, setFormModal] = useState({
    open: false,
    mode: 'CREATE', // 'CREATE' (chỉ dành cho STAFF) | 'EDIT'
    accountId: null,
    userId: null,
    roleName: 'STAFF',
    email: '',
    phone: '',
    password: '',
    status: 'ACTIVE',
    fullName: '',
    dob: '',
    gender: 'MALE',
    avatarUrl: '',
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

  // Tải đồng thời danh sách Accounts và Users
  const fetchAllData = useCallback(
    async ({ isInitial = false } = {}) => {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const [accRes, userRes] = await Promise.all([
          accountService.getAllAccounts(),
          userService.getAllUsers().catch(() => ({ result: [] })),
        ]);

        setAccounts(Array.isArray(accRes?.result) ? accRes.result : []);
        setUsers(Array.isArray(userRes?.result) ? userRes.result : []);
      } catch (err) {
        showToast('error', err?.message || 'Không thể tải danh sách tài khoản.');
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

  // Ánh xạ User theo accountId
  const userByAccountId = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      if (u.accountId != null) {
        map[Number(u.accountId)] = u;
      }
    });
    return map;
  }, [users]);

  // Ghép Account + User
  const mergedAccounts = useMemo(() => {
    return accounts
      .map((acc) => ({
        ...acc,
        profile: userByAccountId[Number(acc.id)] || null,
      }))
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [accounts, userByAccountId]);

  const staffAccounts = useMemo(
    () =>
      mergedAccounts.filter((item) => (item.roleName || '').toUpperCase() !== 'CUSTOMER'),
    [mergedAccounts]
  );

  const customerAccounts = useMemo(
    () =>
      mergedAccounts.filter((item) => (item.roleName || '').toUpperCase() === 'CUSTOMER'),
    [mergedAccounts]
  );

  const currentTabList = activeTab === 'STAFF' ? staffAccounts : customerAccounts;

  // Thống kê nhanh cho tab hiện tại
  const tabStats = useMemo(() => {
    const total = currentTabList.length;
    const active = currentTabList.filter(
      (i) => normalizeStatus(i.status) === 'ACTIVE'
    ).length;
    const inactive = total - active;
    const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, inactive, activePercent };
  }, [currentTabList]);

  // Lọc theo từ khóa và trạng thái
  const filteredList = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return currentTabList.filter((item) => {
      const st = normalizeStatus(item.status);
      const matchStatus = statusFilter === 'ALL' || st === statusFilter;

      const fullName = item.profile?.fullName || '';
      const matchKeyword =
        !q ||
        String(item.id).includes(q) ||
        (item.email || '').toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q) ||
        fullName.toLowerCase().includes(q);

      return matchStatus && matchKeyword;
    });
  }, [currentTabList, keyword, statusFilter]);

  const handleSwitchTab = (tabKey) => {
    setActiveTab(tabKey);
    setStatusFilter('ALL');
    setKeyword('');
  };

  // Mở modal Tạo mới (Chỉ dành cho STAFF)
  const openCreateStaffModal = () => {
    setShowPassword(false);
    setFormModal({
      open: true,
      mode: 'CREATE',
      accountId: null,
      userId: null,
      roleName: 'STAFF',
      email: '',
      phone: '',
      password: '',
      status: 'ACTIVE',
      fullName: '',
      dob: '',
      gender: 'MALE',
      avatarUrl: '',
      submitting: false,
    });
  };

  // Mở modal Chỉnh sửa (áp dụng cho cả Staff & Customer)
  const openEditModal = (item) => {
    setShowPassword(false);
    setFormModal({
      open: true,
      mode: 'EDIT',
      accountId: item.id,
      userId: item.profile?.id || null,
      roleName: (item.roleName || 'CUSTOMER').toUpperCase(),
      email: item.email || '',
      phone: item.phone || '',
      password: '',
      status: normalizeStatus(item.status),
      fullName: item.profile?.fullName || '',
      dob: item.profile?.dob ? String(item.profile.dob).slice(0, 10) : '',
      gender: item.profile?.gender || 'MALE',
      avatarUrl: item.profile?.avatarUrl || '',
      submitting: false,
    });
  };

  // Lưu Tạo mới Staff / Cập nhật tài khoản & hồ sơ
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    const emailTrimmed = formModal.email.trim();
    const phoneTrimmed = formModal.phone.trim();
    const fullNameTrimmed = formModal.fullName.trim();

    if (!emailTrimmed) {
      showToast('error', 'Vui lòng nhập địa chỉ email.');
      return;
    }

    if (formModal.mode === 'CREATE' && formModal.password.trim().length < 6) {
      showToast('error', 'Mật khẩu khởi tạo phải có ít nhất 6 ký tự.');
      return;
    }

    if (
      formModal.mode === 'EDIT' &&
      formModal.password.trim().length > 0 &&
      formModal.password.trim().length < 6
    ) {
      showToast('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setFormModal((prev) => ({ ...prev, submitting: true }));

    try {
      if (formModal.mode === 'CREATE') {
        // Chỉ tạo tài khoản Staff (POST /api/accounts/staff)
        const accountPayload = {
          email: emailTrimmed,
          password: formModal.password.trim(),
          phone: phoneTrimmed || null,
          status: formModal.status,
          roleId: null,
        };

        const accRes = await accountService.createStaffAccount(accountPayload);
        const createdAcc = accRes?.result;

        const hasProfileData =
          fullNameTrimmed || formModal.dob || formModal.avatarUrl.trim();

        if (createdAcc?.id && hasProfileData) {
          const userPayload = {
            fullName: fullNameTrimmed || emailTrimmed.split('@')[0],
            avatarUrl: formModal.avatarUrl.trim() || null,
            dob: formModal.dob || null,
            gender: formModal.gender || null,
            accountId: Number(createdAcc.id),
          };
          await userService.createUser(userPayload).catch(() => {
            showToast(
              'error',
              'Đã tạo tài khoản nhưng chưa lưu được hồ sơ cá nhân. Bạn có thể cập nhật lại sau.'
            );
          });
        }

        showToast('success', 'Đã tạo tài khoản nhân viên (Staff) thành công.');
      } else {
        // Cập nhật Account (PUT /api/accounts/{id})
        const accountUpdatePayload = {
          email: emailTrimmed,
          phone: phoneTrimmed || null,
          password: formModal.password.trim() ? formModal.password.trim() : null,
          status: formModal.status,
          roleId: null,
        };

        await accountService.updateAccount(formModal.accountId, accountUpdatePayload);

        // Cập nhật hoặc khởi tạo User profile
        const hasProfileData =
          fullNameTrimmed || formModal.dob || formModal.avatarUrl.trim();

        if (formModal.userId) {
          const userUpdatePayload = {
            fullName: fullNameTrimmed || null,
            avatarUrl: formModal.avatarUrl.trim() || null,
            dob: formModal.dob || null,
            gender: formModal.gender || null,
          };
          await userService.updateUser(formModal.userId, userUpdatePayload);
        } else if (hasProfileData) {
          const userCreatePayload = {
            fullName: fullNameTrimmed || emailTrimmed.split('@')[0],
            avatarUrl: formModal.avatarUrl.trim() || null,
            dob: formModal.dob || null,
            gender: formModal.gender || null,
            accountId: Number(formModal.accountId),
          };
          await userService.createUser(userCreatePayload);
        }

        showToast('success', 'Đã cập nhật thông tin tài khoản & hồ sơ.');
      }

      setFormModal((prev) => ({ ...prev, open: false, submitting: false }));
      await fetchAllData({ isInitial: false });
    } catch (err) {
      showToast('error', err?.message || 'Không thể lưu thông tin tài khoản.');
      setFormModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Khóa / Mở khóa nhanh tài khoản qua PUT /api/accounts/{id}
  const handleToggleAccountStatus = async (item) => {
    if (currentAccountId && Number(item.id) === currentAccountId) {
      showToast('error', 'Không thể tự khóa tài khoản quản trị đang đăng nhập.');
      return;
    }

    const currentSt = normalizeStatus(item.status);
    const nextStatus = currentSt === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    setTogglingId(item.id);
    try {
      const payload = {
        email: item.email,
        phone: item.phone || null,
        password: null,
        status: nextStatus,
        roleId: null,
      };
      const res = await accountService.updateAccount(item.id, payload);
      const updatedAcc = res?.result || { ...item, status: nextStatus };

      setAccounts((prev) =>
        prev.map((acc) => (Number(acc.id) === Number(item.id) ? updatedAcc : acc))
      );
      showToast(
        'success',
        nextStatus === 'ACTIVE'
          ? `Đã mở khóa tài khoản ${item.email}.`
          : `Đã tạm khóa tài khoản ${item.email}.`
      );
    } catch (err) {
      showToast('error', err?.message || 'Không thể thay đổi trạng thái tài khoản.');
    } finally {
      setTogglingId(null);
    }
  };

  const renderRoleBadge = (roleName) => {
    const roleUpper = (roleName || '').toUpperCase();
    if (roleUpper === 'ADMIN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-900 text-amber-50 shadow-2xs">
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          <span>ADMIN</span>
        </span>
      );
    }
    if (roleUpper === 'STAFF') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200/90">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          <span>STAFF</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/90">
        <Users className="w-3.5 h-3.5 text-amber-700" />
        <span>CUSTOMER</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-14">
      {/* Banner Header tinh tế */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950 text-white p-6 sm:p-7 shadow-sm">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
        <div className="absolute right-24 -bottom-16 w-44 h-44 rounded-full bg-amber-400/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Hệ thống phân quyền & Hồ sơ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Quản lý Tài khoản Hệ thống
            </h1>
            <p className="text-sm text-stone-300 max-w-xl">
              Cấp tài khoản vận hành cho nhân viên quầy, theo dõi hồ sơ khách hàng và kiểm
              soát trạng thái hoạt động toàn quán.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            <button
              type="button"
              disabled={refreshing}
              onClick={() => fetchAllData({ isInitial: false })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer backdrop-blur-xs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Làm mới dữ liệu</span>
            </button>

            {/* Chỉ hiển thị nút Thêm khi ở Tab STAFF */}
            {activeTab === 'STAFF' && (
              <button
                type="button"
                onClick={openCreateStaffModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Thêm tài khoản Staff</span>
              </button>
            )}
          </div>
        </div>

        {/* Thanh chuyển 2 Tab tích hợp ngay chân Header */}
        <div className="relative mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl bg-black/25 p-1 border border-white/10 self-start">
            <button
              type="button"
              onClick={() => handleSwitchTab('STAFF')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'STAFF'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <UserCog
                className={`w-4 h-4 ${
                  activeTab === 'STAFF' ? 'text-amber-700' : 'text-stone-400'
                }`}
              />
              <span>Tài khoản Staff</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'STAFF'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-white/10 text-stone-200'
                }`}
              >
                {staffAccounts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchTab('CUSTOMER')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'CUSTOMER'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Users
                className={`w-4 h-4 ${
                  activeTab === 'CUSTOMER' ? 'text-amber-700' : 'text-stone-400'
                }`}
              />
              <span>Tài khoản Customer</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'CUSTOMER'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-white/10 text-stone-200'
                }`}
              >
                {customerAccounts.length}
              </span>
            </button>
          </div>

          {activeTab === 'CUSTOMER' && (
            <p className="inline-flex items-center gap-1.5 text-xs text-amber-200/90 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Tài khoản khách hàng được khởi tạo từ trang đăng ký của khách</span>
            </p>
          )}
        </div>
      </div>

      {/* Thẻ KPI của Tab hiện tại */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              {activeTab === 'STAFF'
                ? 'Tổng nhân sự nội bộ'
                : 'Tổng khách hàng đăng ký'}
            </p>
            <p className="text-3xl font-extrabold text-stone-800 mt-1.5">{tabStats.total}</p>
            <p className="text-xs text-stone-500 mt-1">
              Tỷ lệ hoạt động: <strong className="text-stone-700">{tabStats.activePercent}%</strong>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200/70 flex items-center justify-center shrink-0">
            {activeTab === 'STAFF' ? (
              <UserCog className="w-6 h-6" />
            ) : (
              <Users className="w-6 h-6" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Đang hoạt động
            </p>
            <p className="text-3xl font-extrabold text-emerald-700 mt-1.5">
              {tabStats.active}
            </p>
            <div className="w-full h-1.5 rounded-full bg-stone-100 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${tabStats.activePercent}%` }}
              />
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Đang tạm khóa
            </p>
            <p className="text-3xl font-extrabold text-rose-600 mt-1.5">
              {tabStats.inactive}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              {tabStats.inactive === 0
                ? 'Tất cả tài khoản đều bình thường'
                : 'Bị hạn chế đăng nhập hệ thống'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/70 flex items-center justify-center shrink-0">
            <UserX className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc trạng thái & tìm kiếm */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL', label: `Tất cả (${tabStats.total})` },
            { key: 'ACTIVE', label: `Hoạt động (${tabStats.active})` },
            { key: 'INACTIVE', label: `Tạm khóa (${tabStats.inactive})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'bg-stone-100/80 text-stone-600 hover:bg-stone-200/70 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm họ tên, email, số điện thoại, ID..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-stone-300 bg-stone-50/50 focus:bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 transition-colors"
          />
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              className="text-stone-400 hover:text-stone-700 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bảng danh sách tài khoản */}
      {initialLoading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 space-y-3">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="h-14 rounded-xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 py-16 px-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
            {activeTab === 'STAFF' ? (
              <UserCog className="w-6 h-6" />
            ) : (
              <Users className="w-6 h-6" />
            )}
          </div>
          <p className="text-base font-bold text-stone-800">
            Không tìm thấy tài khoản phù hợp
          </p>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            {keyword || statusFilter !== 'ALL'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc trạng thái.'
              : activeTab === 'STAFF'
                ? 'Chưa có tài khoản nhân viên nào được tạo trong hệ thống.'
                : 'Chưa có khách hàng nào đăng ký tài khoản.'}
          </p>
          {activeTab === 'STAFF' && !keyword && statusFilter === 'ALL' && (
            <button
              type="button"
              onClick={openCreateStaffModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm tài khoản Staff đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-stone-50/90 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3.5 px-5">Người dùng</th>
                  <th className="py-3.5 px-4">Thông tin liên hệ</th>
                  <th className="py-3.5 px-4">Vai trò</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Ngày tham gia</th>
                  <th className="py-3.5 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredList.map((item) => {
                  const stKey = normalizeStatus(item.status);
                  const stMeta = STATUS_META[stKey] || STATUS_META.ACTIVE;
                  const isSelf =
                    currentAccountId != null && Number(item.id) === currentAccountId;

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-amber-50/30 transition-colors"
                    >
                      {/* Avatar + Họ tên + Giới tính / Ngày sinh */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          {item.profile?.avatarUrl ? (
                            <img
                              src={item.profile.avatarUrl}
                              alt={item.profile.fullName || item.email}
                              className="w-11 h-11 rounded-full object-cover ring-2 ring-stone-100 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-100 to-amber-200/80 text-amber-950 font-extrabold text-xs ring-1 ring-amber-300/60 flex items-center justify-center shrink-0">
                              {getInitials(item.profile?.fullName, item.email)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-stone-800 truncate">
                                {item.profile?.fullName || (
                                  <span className="text-stone-400 italic font-normal">
                                    Chưa cập nhật họ tên
                                  </span>
                                )}
                              </p>
                              {isSelf && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">
                              <span className="font-mono text-stone-400">#{item.id}</span>
                              {item.profile?.gender
                                ? ` • ${GENDER_LABEL[item.profile.gender] || item.profile.gender}`
                                : ''}
                              {item.profile?.dob ? ` • ${formatDate(item.profile.dob)}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email & Số điện thoại */}
                      <td className="py-4 px-4 text-xs space-y-1">
                        <p className="text-stone-800 font-medium flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-amber-700/80 shrink-0" />
                          <span>{item.email}</span>
                        </p>
                        <p className="text-stone-500 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{item.phone || 'Chưa có SĐT'}</span>
                        </p>
                      </td>

                      {/* Vai trò */}
                      <td className="py-4 px-4">{renderRoleBadge(item.roleName)}</td>

                      {/* Trạng thái */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${stMeta.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stMeta.dotClass}`} />
                          <span>{stMeta.label}</span>
                        </span>
                      </td>

                      {/* Ngày tạo */}
                      <td className="py-4 px-4 text-xs text-stone-500">
                        {formatDateTime(item.createdAt)}
                      </td>

                      {/* Thao tác: Xem chi tiết, Chỉnh sửa, Khóa / Mở khóa */}
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailTarget(item)}
                            title="Xem chi tiết hồ sơ"
                            className="p-2 rounded-xl border border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Sửa tài khoản & hồ sơ"
                            className="p-2 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:bg-amber-50 text-stone-700 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || togglingId === item.id}
                            onClick={() => handleToggleAccountStatus(item)}
                            title={
                              stKey === 'ACTIVE' ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'
                            }
                            className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40 ${
                              stKey === 'ACTIVE'
                                ? 'border-stone-200 bg-white hover:border-rose-300 hover:bg-rose-50 text-stone-700 hover:text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {stKey === 'ACTIVE' ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Khóa</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Mở khóa</span>
                              </>
                            )}
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
      )}

      {/* Modal Xem chi tiết Tài khoản & Hồ sơ (Dạng Profile Card) */}
      {detailTarget && (
        <div
          onClick={() => setDetailTarget(null)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-200"
          >
            {/* Cover Banner */}
            <div className="h-24 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-900 relative">
              <button
                type="button"
                onClick={() => setDetailTarget(null)}
                className="absolute right-3.5 top-3.5 p-1.5 rounded-full bg-black/30 text-white/80 hover:text-white hover:bg-black/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pb-6">
              {/* Avatar nổi đè lên banner */}
              <div className="flex items-end justify-between -mt-10 mb-4">
                {detailTarget.profile?.avatarUrl ? (
                  <img
                    src={detailTarget.profile.avatarUrl}
                    alt={detailTarget.profile.fullName || detailTarget.email}
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md bg-white"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 text-amber-950 font-extrabold text-xl ring-4 ring-white shadow-md flex items-center justify-center">
                    {getInitials(detailTarget.profile?.fullName, detailTarget.email)}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {renderRoleBadge(detailTarget.roleName)}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      (
                        STATUS_META[normalizeStatus(detailTarget.status)] ||
                        STATUS_META.ACTIVE
                      ).badgeClass
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        (
                          STATUS_META[normalizeStatus(detailTarget.status)] ||
                          STATUS_META.ACTIVE
                        ).dotClass
                      }`}
                    />
                    <span>
                      {
                        (
                          STATUS_META[normalizeStatus(detailTarget.status)] ||
                          STATUS_META.ACTIVE
                        ).label
                      }
                    </span>
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-extrabold text-stone-800">
                  {detailTarget.profile?.fullName || 'Chưa cập nhật họ tên'}
                </h3>
                <p className="text-xs text-stone-500">
                  Mã tài khoản <span className="font-mono font-semibold">#{detailTarget.id}</span>
                </p>
              </div>

              {/* Lưới thông tin chi tiết */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Email đăng nhập</span>
                  <strong className="text-stone-800 break-all">{detailTarget.email}</strong>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Số điện thoại</span>
                  <strong className="text-stone-800">
                    {detailTarget.phone || 'Chưa cập nhật'}
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Giới tính</span>
                  <strong className="text-stone-800">
                    {detailTarget.profile?.gender
                      ? GENDER_LABEL[detailTarget.profile.gender] ||
                        detailTarget.profile.gender
                      : 'Chưa cập nhật'}
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Ngày sinh</span>
                  <strong className="text-stone-800">
                    {formatDate(detailTarget.profile?.dob)}
                  </strong>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Ngày tạo</span>
                  <span className="text-stone-700 font-medium">
                    {formatDateTime(detailTarget.createdAt)}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70">
                  <span className="text-stone-400 block mb-0.5">Cập nhật gần nhất</span>
                  <span className="text-stone-700 font-medium">
                    {formatDateTime(detailTarget.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setDetailTarget(null)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = detailTarget;
                    setDetailTarget(null);
                    openEditModal(target);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Chỉnh sửa hồ sơ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm Staff / Cập nhật Tài khoản & Hồ sơ */}
      {formModal.open && (
        <div
          onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200"
          >
            <div className="p-5 sm:px-6 border-b border-stone-200 bg-stone-50/70 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-stone-800">
                    {formModal.mode === 'CREATE'
                      ? 'Thêm tài khoản Nhân viên (Staff)'
                      : `Cập nhật tài khoản #${formModal.accountId}`}
                  </h2>
                  {formModal.mode === 'EDIT' && renderRoleBadge(formModal.roleName)}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Quản lý đồng thời thông tin đăng nhập và hồ sơ cá nhân
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmitForm}
              className="p-5 sm:p-6 overflow-y-auto space-y-5 text-sm"
            >
              {/* Khối 1: Thông tin đăng nhập */}
              <div className="space-y-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  1. Thông tin đăng nhập
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={formModal.email}
                      onChange={(e) =>
                        setFormModal((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="staff@cfshop.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={formModal.phone}
                      onChange={(e) =>
                        setFormModal((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="0901234567"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      {formModal.mode === 'CREATE' ? (
                        <>
                          Mật khẩu <span className="text-red-500">*</span>
                        </>
                      ) : (
                        'Mật khẩu mới (tùy chọn)'
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required={formModal.mode === 'CREATE'}
                        value={formModal.password}
                        onChange={(e) =>
                          setFormModal((prev) => ({ ...prev, password: e.target.value }))
                        }
                        placeholder={
                          formModal.mode === 'CREATE'
                            ? 'Tối thiểu 6 ký tự'
                            : 'Để trống nếu giữ nguyên'
                        }
                        className="w-full pl-3.5 pr-9 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-stone-400 hover:text-stone-700 absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Trạng thái hoạt động
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'ACTIVE', label: 'Hoạt động' },
                        { value: 'INACTIVE', label: 'Tạm khóa' },
                      ].map((opt) => {
                        const selected = formModal.status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setFormModal((prev) => ({ ...prev, status: opt.value }))
                            }
                            className={`py-2.5 px-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              selected
                                ? opt.value === 'ACTIVE'
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Khối 2: Hồ sơ người dùng */}
              <div className="pt-4 border-t border-stone-200 space-y-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  2. Hồ sơ cá nhân
                </p>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={formModal.fullName}
                    onChange={(e) =>
                      setFormModal((prev) => ({ ...prev, fullName: e.target.value }))
                    }
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Ngày sinh
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={formModal.dob}
                        onChange={(e) =>
                          setFormModal((prev) => ({ ...prev, dob: e.target.value }))
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Giới tính
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENDER_OPTIONS.map((g) => {
                        const active = formModal.gender === g.value;
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() =>
                              setFormModal((prev) => ({ ...prev, gender: g.value }))
                            }
                            className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                              active
                                ? 'bg-amber-700 text-white border-amber-700'
                                : 'bg-white text-stone-600 border-stone-300 hover:border-amber-400'
                            }`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Nhập URL Avatar kèm xem trước trực tiếp */}
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Ảnh đại diện (Avatar URL)
                  </label>
                  <div className="flex items-center gap-3">
                    {formModal.avatarUrl.trim() ? (
                      <img
                        src={formModal.avatarUrl.trim()}
                        alt="Preview"
                        className="w-11 h-11 rounded-xl object-cover border border-stone-200 shrink-0 bg-stone-50"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {formModal.fullName || formModal.email ? (
                          getInitials(formModal.fullName, formModal.email)
                        ) : (
                          <ImageIcon className="w-4 h-4 text-amber-700/60" />
                        )}
                      </div>
                    )}

                    <input
                      type="url"
                      value={formModal.avatarUrl}
                      onChange={(e) =>
                        setFormModal((prev) => ({ ...prev, avatarUrl: e.target.value }))
                      }
                      placeholder="https://example.com/avatar.jpg"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormModal((prev) => ({ ...prev, open: false }))}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formModal.submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  {formModal.submitting
                    ? 'Đang lưu...'
                    : formModal.mode === 'CREATE'
                      ? 'Tạo tài khoản Staff'
                      : 'Lưu thay đổi'}
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

export default AdminAccountsPage;