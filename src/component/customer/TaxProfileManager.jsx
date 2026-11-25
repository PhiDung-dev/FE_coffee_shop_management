import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit3, Trash2, Check, X, AlertCircle } from 'lucide-react';
import taxProfileService from '../../service/taxProfileService';

const TaxProfileManager = ({ accountId }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    companyName: '',
    taxCode: '',
    companyAddress: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProfiles = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await taxProfileService.getTaxProfilesByAccountId(accountId);
      setProfiles(Array.isArray(res?.result) ? res.result : []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm({ companyName: '', taxCode: '', companyAddress: '' });
    setError('');
    setShowForm(true);
  };

  const handleOpenEdit = (profile) => {
    setEditingId(profile.id);
    setForm({
      companyName: profile.companyName || '',
      taxCode: profile.taxCode || '',
      companyAddress: profile.companyAddress || '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim() || !form.taxCode.trim()) {
      setError('Vui lòng nhập đầy đủ Tên công ty và Mã số thuế.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await taxProfileService.updateTaxProfile(editingId, {
          companyName: form.companyName.trim(),
          taxCode: form.taxCode.trim(),
          companyAddress: form.companyAddress.trim() || null,
        });
      } else {
        await taxProfileService.createTaxProfile({
          companyName: form.companyName.trim(),
          taxCode: form.taxCode.trim(),
          companyAddress: form.companyAddress.trim() || null,
          accountId: Number(accountId),
        });
      }
      setShowForm(false);
      await fetchProfiles();
    } catch (err) {
      setError(err?.message || 'Không thể lưu thông tin xuất hóa đơn VAT.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await taxProfileService.deleteTaxProfile(id);
      await fetchProfiles();
    } catch (err) {
      setError(err?.message || 'Không thể xóa hồ sơ thuế này.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-stone-800">Thông tin xuất hóa đơn VAT</h2>
            <p className="text-xs text-stone-500">
              Lưu sẵn Tên công ty & Mã số thuế để xuất hóa đơn đỏ nhanh khi đặt hàng
            </p>
          </div>
        </div>

        {!showForm && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm công ty</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-sm"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tên công ty / Đơn vị <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Công ty TNHH..."
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mã số thuế <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.taxCode}
                onChange={(e) => setForm({ ...form, taxCode: e.target.value })}
                placeholder="0101234567"
                className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Địa chỉ đăng ký kinh doanh
            </label>
            <input
              type="text"
              value={form.companyAddress}
              onChange={(e) => setForm({ ...form, companyAddress: e.target.value })}
              placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành phố"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Hủy</span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</span>
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-20 rounded-xl bg-stone-100 animate-pulse" />
      ) : profiles.length === 0 ? (
        <p className="text-xs text-stone-400 text-center py-4">
          Bạn chưa lưu thông tin công ty / mã số thuế nào.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map((tp) => (
            <div
              key={tp.id}
              className="p-4 rounded-xl border border-stone-200 bg-stone-50/60 flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-bold text-stone-800 truncate">{tp.companyName}</p>
                <p className="text-xs font-mono font-semibold text-sky-800">MST: {tp.taxCode}</p>
                {tp.companyAddress && (
                  <p className="text-xs text-stone-500 line-clamp-2">{tp.companyAddress}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(tp)}
                  className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:text-amber-800 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(tp.id)}
                  className="p-1.5 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaxProfileManager;