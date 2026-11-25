import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Lock,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Camera,
  Clock,
  ChevronRight,
  Building2,
} from 'lucide-react';
import accountService from '../../service/accountService';
import userService from '../../service/userService';
import useAuth from '../../hook/useAuth';
import { parseJwt } from '../../utils/jwtUtils';
import TaxProfileManager from '../../component/customer/TaxProfileManager';

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TABS = [
  {
    id: 'profile',
    label: 'Thông tin cá nhân',
    description: 'Họ tên, ngày sinh, giới tính & ảnh',
    icon: User,
  },
  {
    id: 'account',
    label: 'Tài khoản & Bảo mật',
    description: 'Email, số điện thoại & mật khẩu',
    icon: Shield,
  },
  {
    id: 'tax',
    label: 'Hóa đơn VAT & MST',
    description: 'Thông tin công ty xuất hóa đơn đỏ',
    icon: Building2,
  },
];

const ProfilePage = () => {
  const { user, token } = useAuth();
  const claims = token ? parseJwt(token) : null;
  const accountId = claims?.accountId ?? claims?.id ?? user?.accountId ?? null;

  // Tab đang chọn trên thanh điều hướng dọc
  const [activeTab, setActiveTab] = useState('profile');

  // Dữ liệu gốc từ API
  const [accountInfo, setAccountInfo] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [avatarError, setAvatarError] = useState(false);

  // Form 1: Thông tin cá nhân (UserController - bảng users)
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    dob: '',
    gender: 'MALE',
    avatarUrl: '',
  });

  // Form 2: Tài khoản & Bảo mật (AccountController - bảng accounts)
  const [accountForm, setAccountForm] = useState({
    email: '',
    phone: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // Trạng thái tải & thông báo
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState({ type: '', message: '' });

  const [savingAccount, setSavingAccount] = useState(false);
  const [accountStatus, setAccountStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    if (!accountId) {
      setPageError('Không xác định được mã tài khoản từ phiên đăng nhập. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }

    const fetchProfileData = async () => {
      setLoading(true);
      setPageError('');

      try {
        const [accountRes, usersRes] = await Promise.all([
          accountService.getAccountById(accountId),
          userService.getAllUsers(),
        ]);

        const acc = accountRes?.result || null;
        setAccountInfo(acc);
        if (acc) {
          setAccountForm({
            email: acc.email || '',
            phone: acc.phone || '',
            newPassword: '',
            confirmPassword: '',
          });
        }

        const allUsers = Array.isArray(usersRes?.result) ? usersRes.result : [];
        const matchedUser = allUsers.find((u) => Number(u.accountId) === Number(accountId)) || null;

        setUserInfo(matchedUser);
        if (matchedUser) {
          setProfileForm({
            fullName: matchedUser.fullName || '',
            dob: matchedUser.dob || '',
            gender: matchedUser.gender || 'MALE',
            avatarUrl: matchedUser.avatarUrl || '',
          });
          setAvatarError(false);
        }
      } catch (err) {
        setPageError(err?.message || 'Không thể tải thông tin cá nhân.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [accountId]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'avatarUrl') setAvatarError(false);
    if (profileStatus.message) setProfileStatus({ type: '', message: '' });
  };

  const handleAccountChange = (e) => {
    const { name, value } = e.target;
    setAccountForm((prev) => ({ ...prev, [name]: value }));
    if (accountStatus.message) setAccountStatus({ type: '', message: '' });
  };

  const handleResetProfileForm = () => {
    setProfileForm({
      fullName: userInfo?.fullName || '',
      dob: userInfo?.dob || '',
      gender: userInfo?.gender || 'MALE',
      avatarUrl: userInfo?.avatarUrl || '',
    });
    setAvatarError(false);
    setProfileStatus({ type: '', message: '' });
  };

  const handleResetAccountForm = () => {
    setAccountForm({
      email: accountInfo?.email || '',
      phone: accountInfo?.phone || '',
      newPassword: '',
      confirmPassword: '',
    });
    setAccountStatus({ type: '', message: '' });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) {
      setProfileStatus({ type: 'error', message: 'Vui lòng nhập họ và tên.' });
      return;
    }

    setSavingProfile(true);
    setProfileStatus({ type: '', message: '' });

    try {
      let savedUser = null;

      if (userInfo?.id) {
        const res = await userService.updateUser(userInfo.id, {
          fullName: profileForm.fullName.trim(),
          avatarUrl: profileForm.avatarUrl.trim() || null,
          dob: profileForm.dob || null,
          gender: profileForm.gender || null,
        });
        savedUser = res?.result || null;
      } else {
        const res = await userService.createUser({
          fullName: profileForm.fullName.trim(),
          avatarUrl: profileForm.avatarUrl.trim() || null,
          dob: profileForm.dob || null,
          gender: profileForm.gender || null,
          accountId,
        });
        savedUser = res?.result || null;
      }

      if (savedUser) {
        setUserInfo(savedUser);
        setProfileForm({
          fullName: savedUser.fullName || '',
          dob: savedUser.dob || '',
          gender: savedUser.gender || 'MALE',
          avatarUrl: savedUser.avatarUrl || '',
        });

        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (storedUser) {
            localStorage.setItem(
              'user',
              JSON.stringify({ ...storedUser, fullName: savedUser.fullName || '' })
            );
          }
        } catch {
          // Bỏ qua nếu localStorage không hợp lệ
        }
      }

      setProfileStatus({
        type: 'success',
        message: 'Đã lưu thay đổi thông tin cá nhân.',
      });
    } catch (err) {
      setProfileStatus({
        type: 'error',
        message: err?.message || 'Cập nhật thông tin cá nhân thất bại.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.email.trim()) {
      setAccountStatus({ type: 'error', message: 'Email đăng nhập không được để trống.' });
      return;
    }

    if (accountForm.newPassword) {
      if (accountForm.newPassword.length < 6) {
        setAccountStatus({
          type: 'error',
          message: 'Mật khẩu mới phải có ít nhất 6 ký tự.',
        });
        return;
      }
      if (accountForm.newPassword !== accountForm.confirmPassword) {
        setAccountStatus({
          type: 'error',
          message: 'Mật khẩu xác nhận không khớp.',
        });
        return;
      }
    }

    setSavingAccount(true);
    setAccountStatus({ type: '', message: '' });

    try {
      const res = await accountService.updateAccount(accountId, {
        email: accountForm.email.trim(),
        phone: accountForm.phone.trim() || null,
        password: accountForm.newPassword || null,
        status: null,
        roleId: null,
      });

      const updatedAcc = res?.result || null;
      if (updatedAcc) {
        setAccountInfo(updatedAcc);
        setAccountForm({
          email: updatedAcc.email || '',
          phone: updatedAcc.phone || '',
          newPassword: '',
          confirmPassword: '',
        });

        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
          if (storedUser) {
            localStorage.setItem(
              'user',
              JSON.stringify({
                ...storedUser,
                email: updatedAcc.email || storedUser.email,
                username: updatedAcc.email || storedUser.username,
              })
            );
          }
        } catch {
          // Bỏ qua nếu localStorage không hợp lệ
        }
      }

      setAccountStatus({
        type: 'success',
        message: accountForm.newPassword
          ? 'Đã cập nhật thông tin tài khoản và đổi mật khẩu thành công.'
          : 'Đã lưu thay đổi thông tin tài khoản.',
      });
    } catch (err) {
      setAccountStatus({
        type: 'error',
        message: err?.message || 'Cập nhật thông tin tài khoản thất bại.',
      });
    } finally {
      setSavingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-32 bg-white rounded-2xl border border-stone-200" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 h-44 bg-white rounded-2xl border border-stone-200" />
          <div className="md:col-span-8 h-96 bg-white rounded-2xl border border-stone-200" />
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-2xl mx-auto p-5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>{pageError}</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Thẻ tổng quan hồ sơ */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center overflow-hidden border border-amber-200 shrink-0">
          {profileForm.avatarUrl && !avatarError ? (
            <img
              src={profileForm.avatarUrl}
              alt={profileForm.fullName || 'Avatar'}
              onError={() => setAvatarError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-9 h-9" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl font-bold text-stone-800">
              {userInfo?.fullName || profileForm.fullName || accountInfo?.email || 'Người dùng'}
            </h1>
            {accountInfo?.roleName && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                {accountInfo.roleName}
              </span>
            )}
            {accountInfo?.status && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  accountInfo.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {accountInfo.status === 'ACTIVE' ? 'Đang hoạt động' : accountInfo.status}
              </span>
            )}
          </div>

          <p className="text-sm text-stone-600">
            {accountInfo?.email}
            {accountInfo?.phone ? ` • ${accountInfo.phone}` : ''}
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-stone-400 pt-0.5">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Tham gia: {formatDateTime(accountInfo?.createdAt)}
            </span>
            {(userInfo?.updatedAt || accountInfo?.updatedAt) && (
              <span>
                Cập nhật gần nhất: {formatDateTime(userInfo?.updatedAt || accountInfo?.updatedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bố cục Nav dọc bên trái + Nội dung Tab bên phải */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Thanh Nav dọc */}
        <aside className="md:col-span-4 bg-white rounded-2xl border border-stone-200 shadow-sm p-3">
          <nav aria-label="Cài đặt hồ sơ" className="space-y-1.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs'
                      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-amber-700 text-white'
                          : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-bold' : 'font-medium'}`}>
                        {tab.label}
                      </p>
                      <p className="text-xs text-stone-400 truncate mt-0.5">{tab.description}</p>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive ? 'text-amber-700 translate-x-0.5' : 'text-stone-300'
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Nội dung Tab tương ứng */}
        <section className="md:col-span-8">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-800">Thông tin cá nhân</h2>
                    <p className="text-xs text-stone-500">
                      Chỉnh sửa họ tên, ngày sinh, giới tính và ảnh đại diện
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetProfileForm}
                  title="Hoàn tác thay đổi"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hoàn tác</span>
                </button>
              </div>

              {profileStatus.message && (
                <div
                  className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    profileStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {profileStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{profileStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={profileForm.fullName}
                    onChange={handleProfileChange}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dob" className="block text-sm font-medium text-stone-700 mb-1">
                      Ngày sinh
                    </label>
                    <div className="relative">
                      <input
                        id="dob"
                        name="dob"
                        type="date"
                        value={profileForm.dob}
                        onChange={handleProfileChange}
                        className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                      />
                      <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="gender"
                      className="block text-sm font-medium text-stone-700 mb-1"
                    >
                      Giới tính
                    </label>
                    <select
                      id="gender"
                      name="gender"
                      value={profileForm.gender}
                      onChange={handleProfileChange}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm text-stone-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    >
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="avatarUrl"
                    className="block text-sm font-medium text-stone-700 mb-1"
                  >
                    URL ảnh đại diện
                  </label>
                  <div className="relative">
                    <input
                      id="avatarUrl"
                      name="avatarUrl"
                      type="url"
                      value={profileForm.avatarUrl}
                      onChange={handleProfileChange}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                    />
                    <Camera className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="w-full sm:w-auto py-2.5 px-6 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingProfile ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{savingProfile ? 'Đang lưu...' : 'Lưu thông tin cá nhân'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-800">Tài khoản & Bảo mật</h2>
                    <p className="text-xs text-stone-500">
                      Cập nhật email đăng nhập, số điện thoại và mật khẩu
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetAccountForm}
                  title="Hoàn tác thay đổi"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hoàn tác</span>
                </button>
              </div>

              {accountStatus.message && (
                <div
                  className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    accountStatus.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {accountStatus.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{accountStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
                      Email đăng nhập <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={accountForm.email}
                        onChange={handleAccountChange}
                        placeholder="email@example.com"
                        className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                      />
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-stone-700 mb-1">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        maxLength={15}
                        value={accountForm.phone}
                        onChange={handleAccountChange}
                        placeholder="0901234567"
                        className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                      />
                      <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 space-y-3.5">
                  <p className="text-xs font-semibold text-stone-600 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Đổi mật khẩu (bỏ trống nếu giữ nguyên mật khẩu cũ)</span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="newPassword"
                        className="block text-sm font-medium text-stone-700 mb-1"
                      >
                        Mật khẩu mới
                      </label>
                      <div className="relative">
                        <input
                          id="newPassword"
                          name="newPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={accountForm.newPassword}
                          onChange={handleAccountChange}
                          placeholder="Tối thiểu 6 ký tự"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-stone-700 mb-1"
                      >
                        Xác nhận mật khẩu mới
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={accountForm.confirmPassword}
                        onChange={handleAccountChange}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="w-full sm:w-auto py-2.5 px-6 bg-stone-800 hover:bg-stone-900 disabled:bg-stone-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {savingAccount ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{savingAccount ? 'Đang cập nhật...' : 'Cập nhật tài khoản'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'tax' && <TaxProfileManager accountId={accountId} />}
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;