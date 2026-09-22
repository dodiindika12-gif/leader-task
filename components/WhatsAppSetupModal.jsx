'use client';

import React, { useState } from 'react';

const digitsOf = (value) => (value || '').replace(/[^0-9]/g, '');

const validateWaNumber = (value) => {
    const digits = digitsOf(value);
    if (!digits) return 'Nomor WhatsApp tidak boleh kosong.';
    if (digits.length < 9) return 'Nomor terlalu pendek (minimal 9 digit).';
    if (digits.length > 15) return 'Nomor terlalu panjang (maksimal 15 digit).';
    if (!/^(0|62|8)/.test(digits)) return 'Nomor harus diawali 0, 62, atau langsung 8. Contoh: 08123456789.';
    return '';
};

const normalizePreview = (value) => {
    let clean = digitsOf(value);
    if (clean.startsWith('0')) return '62' + clean.slice(1);
    return clean;
};

const WhatsAppSetupModal = ({ isOpen, onSave }) => {
    const [waNumber, setWaNumber] = useState('');
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Reset ulang form ketika modal ditutup (state adjustment during render)
    const [lastOpen, setLastOpen] = useState(isOpen);
    if (lastOpen !== isOpen) {
        setLastOpen(isOpen);
        if (!isOpen) {
            setWaNumber('');
            setSaving(false);
            setErrorMsg('');
        }
    }

    if (!isOpen) return null;

    const digits = digitsOf(waNumber);
    const isValid = !validateWaNumber(waNumber);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationMsg = validateWaNumber(waNumber);
        if (validationMsg) {
            setErrorMsg(validationMsg);
            return;
        }
        setSaving(true);
        setErrorMsg('');
        try {
            const success = await onSave(waNumber.trim());
            if (!success) {
                setErrorMsg('Gagal menyimpan nomor WhatsApp. Silakan coba lagi.');
            }
        } catch (err) {
            setErrorMsg('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"></div>

            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden animate-scale-in border border-slate-100 flex flex-col max-h-[92vh] my-auto">
                {/* Header */}
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-emerald-50/50 shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
                        <i className="fa-brands fa-whatsapp text-white text-xl"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                                Lengkapi Nomor WhatsApp
                            </h3>
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                Wajib
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Masukkan nomor WhatsApp aktif Anda untuk menerima notifikasi
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
                    <div className="bg-emerald-50/90 border border-emerald-200/80 text-emerald-900 p-3 rounded-2xl text-xs flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                            <i className="fa-solid fa-bell text-xs"></i>
                        </div>
                        <div className="flex-1 min-w-0 leading-relaxed">
                            <strong className="block font-semibold text-emerald-950">Notifikasi WhatsApp Belum Aktif</strong>
                            Nomor ini digunakan untuk menerima notifikasi tugas dan jadwal otomatis setiap pagi jam 07:00 WIB. Nomor dapat diubah kapan saja di menu Pengaturan.
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div>
                            <label htmlFor="wa-setup-number" className="block text-xs font-bold text-slate-900 mb-1">
                                Nomor WhatsApp <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <i className="fa-brands fa-whatsapp absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500 text-base"></i>
                                <input
                                    id="wa-setup-number"
                                    type="tel"
                                    inputMode="tel"
                                    autoComplete="tel"
                                    autoFocus
                                    value={waNumber}
                                    onChange={(e) => {
                                        setWaNumber(e.target.value);
                                        if (errorMsg) setErrorMsg('');
                                    }}
                                    placeholder="08123456789 atau 628123456789"
                                    disabled={saving}
                                    className="w-full text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl pl-10 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition placeholder:text-slate-400 placeholder:font-normal disabled:bg-slate-50 disabled:cursor-not-allowed"
                                />
                            </div>
                            {digits.length > 0 && isValid && (
                                <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1.5 font-medium">
                                    <i className="fa-solid fa-circle-check"></i>
                                    <span>Akan disimpan sebagai: {normalizePreview(waNumber)}</span>
                                </p>
                            )}
                        </div>

                        {errorMsg && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2 animate-fade-in">
                                <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-sm shadow-emerald-200 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin"></i>
                                    <span>Menyimpan...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-brands fa-whatsapp text-sm"></i>
                                    <span>Simpan &amp; Lanjutkan</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppSetupModal;
