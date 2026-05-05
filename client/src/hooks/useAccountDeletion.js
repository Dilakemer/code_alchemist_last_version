import { useState } from 'react';

export const useAccountDeletion = ({ apiBase, authHeaders, onShowAlert, onLogout, onClose }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteAccount = async (password) => {
        const trimmedPassword = (password || '').trim();

        setIsDeleting(true);
        localStorage.setItem('is_deleting_account', 'true');

        try {
            const res = await fetch(`${apiBase}/api/auth/delete-account`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ password: trimmedPassword }),
            });

            const data = await res.json();

            if (res.ok) {
                console.log('Account deleted successfully. Waiting for UI to settle.');

                setTimeout(() => {
                    const finalize = () => {
                        console.log('Finalizing logout.');
                        localStorage.removeItem('is_deleting_account');
                        setIsDeleting(false);
                        if (onLogout) onLogout(true);
                        if (onClose) onClose();
                    };

                    if (onShowAlert) {
                        onShowAlert('Hesabınız başarıyla silindi.', 'success', finalize);
                    } else {
                        console.warn('onShowAlert missing. Finalizing logout immediately.');
                        finalize();
                    }
                }, 300);

                return true;
            } else {
                console.error('Account deletion failed:', data.error);
                localStorage.removeItem('is_deleting_account');
                if (onShowAlert) onShowAlert(data.error || 'Hesap silme işlemi başarısız oldu.', 'error');
                setIsDeleting(false);
                return false;
            }
        } catch (err) {
            console.error('Account deletion error:', err);
            localStorage.removeItem('is_deleting_account');
            if (onShowAlert) onShowAlert('Sunucu ile bağlantı kurulamadı. Lütfen tekrar deneyin.', 'error');
            setIsDeleting(false);
            return false;
        }
    };

    return { deleteAccount, isDeleting };
};