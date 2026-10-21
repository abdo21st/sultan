import { ORDER_STATUS, ORDER_STATUS_LABELS, normalizeOrderStatus } from '@/lib/constants';

export default function OrderStatusBadge({ status }: { status: string }) {
    const phase = normalizeOrderStatus(status);
    const tone = phase === ORDER_STATUS.PROCESSING ? 'processing' : phase === ORDER_STATUS.SHOP_READY ? 'ready' : phase === ORDER_STATUS.COMPLETED ? 'completed' : phase === ORDER_STATUS.CANCELLED || phase === ORDER_STATUS.RETURNED ? 'closed' : 'registered';
    return <span className="order-status" data-tone={tone}><span aria-hidden="true" className="order-status-dot" />{ORDER_STATUS_LABELS[phase] || ORDER_STATUS_LABELS[status] || status}</span>;
}
