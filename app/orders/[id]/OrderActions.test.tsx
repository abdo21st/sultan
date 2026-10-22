/** @jest-environment node */
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/app/components/ToastProvider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

import { renderToStaticMarkup } from 'react-dom/server';
import { ORDER_STATUS } from '@/lib/constants';
import { PERMISSIONS } from '@/lib/permissions';
import OrderActions from './OrderActions';

const order = { id: 'synthetic', status: ORDER_STATUS.REGISTERED, remainingAmount: 70, reviewRequired: false, rejectionReason: null };
const factory = { role: 'USER', permissions: [PERMISSIONS.STATUS_CHANGE_PROCESSING, PERMISSIONS.STATUS_CHANGE_SHOP_READY, PERMISSIONS.STATUS_CHANGE_REVIEW] };

function instructionClasses(html: string) {
    return html.match(/<p class="([^"]*)"/)?.[1].split(' ') ?? [];
}

it('shows the waiting instruction on phones when the shop cannot start production', () => {
    const html = renderToStaticMarkup(<OrderActions order={order} currentUser={{ role: 'USER', permissions: [PERMISSIONS.STATUS_CHANGE_COMPLETED] }} />);
    expect(html).toContain('ينتظر بدء التجهيز في المصنع');
    expect(instructionClasses(html)).not.toContain('hidden');
    expect(html).not.toContain('بدء تجهيز الطلب في المصنع</button>');
});

it('keeps the compact phone action when the factory can start production', () => {
    const html = renderToStaticMarkup(<OrderActions order={order} currentUser={factory} />);
    expect(html).toContain('بدء تجهيز الطلب في المصنع</button>');
    expect(instructionClasses(html)).toContain('hidden');
});

it('shows the handoff explanation when the ready order is waiting for the shop', () => {
    const html = renderToStaticMarkup(<OrderActions order={{ ...order, status: ORDER_STATUS.SHOP_READY }} currentUser={factory} />);
    expect(html).toContain('يؤكد المحل التسليم');
    expect(instructionClasses(html)).not.toContain('hidden');
    expect(html).not.toContain('تأكيد تسليم الطلب للعميل</button>');
});

it('does not leave an empty action card after delivery without print permission', () => {
    expect(renderToStaticMarkup(<OrderActions order={{ ...order, status: ORDER_STATUS.COMPLETED }} currentUser={factory} />)).toBe('');
});
