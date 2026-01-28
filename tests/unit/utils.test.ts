import { formatCurrency, formatDate } from '@/lib/utils';

describe('Utility Functions', () => {
    describe('formatCurrency', () => {
        it('should format numbers as LYD currency', () => {
            expect(formatCurrency(100)).toContain('د.ل');
            expect(formatCurrency(100)).toContain('100'); // Or whatever the format is
        });

        it('should handle zero', () => {
            expect(formatCurrency(0)).toContain('0');
        });
    });

    // Add more tests
});
