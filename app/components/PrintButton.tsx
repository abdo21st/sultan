'use client';

export default function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="no-print fixed bottom-8 right-8 bg-amber-500 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform font-bold z-50 feedback-button"
        >
            🖨️ طباعة التقرير
        </button>
    );
}
