'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, drawer = false }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode; drawer?: boolean }) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        if (!isOpen || !ref.current) return;
        const dialog = ref.current;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        return () => {
            if (dialog.open) dialog.close();
            document.body.style.overflow = overflow;
            if (opener?.isConnected) opener.focus();
        };
    }, [isOpen]);
    if (!isOpen) return null;
    return <dialog ref={ref} aria-labelledby={titleId} className={`ui-dialog ${drawer ? 'ui-dialog-drawer' : ''}`} onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
        <header className="ui-dialog-header"><h2 id={titleId} className="text-lg font-semibold">{title}</h2><button type="button" onClick={onClose} className="ui-icon-button" aria-label={`إغلاق ${title}`}><X size={20} aria-hidden="true" /></button></header>
        <div className="ui-dialog-body">{children}</div>
    </dialog>;
}
