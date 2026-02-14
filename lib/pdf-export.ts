import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import arabicReshaper from 'arabic-reshaper';
import { AmiriRegularBase64 } from './amiri-font-raw';

export interface PDFExportOptions {
    title: string;
    subtitle?: string;
    columns: { header: string; dataKey: string }[];
    rows: Record<string, unknown>[];
    fileName?: string;
}

// Handle Arabic Text Reshaping and RTL correction
export const reshapeArabic = (text: string) => {
    try {
        if (!text) return '';
        // Check if text has Arabic characters
        if (/[\u0600-\u06FF]/.test(text)) {
            const reshaped = arabicReshaper.reshape(text);
            return reshaped.split('').reverse().join('');
        }
        return text;
    } catch {
        return text;
    }
};

export const exportToPDF = (options: PDFExportOptions) => {
    const { title, subtitle, columns, rows, fileName } = options;

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Add Amiri font and register it
    doc.addFileToVFS('Amiri-Regular.ttf', AmiriRegularBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    // Reshape title and subtitle
    const reshapedTitle = reshapeArabic(title);
    const reshapedSubtitle = subtitle ? reshapeArabic(subtitle) : '';

    // Reshape headers
    const reshapedColumns = columns.map(col => ({
        header: reshapeArabic(col.header),
        dataKey: col.dataKey
    }));

    // Reshape cell content if it's string and contains Arabic
    const reshapedRows = rows.map(row => {
        const newRow: Record<string, unknown> = { ...row };
        Object.keys(newRow).forEach(key => {
            if (typeof newRow[key] === 'string') {
                newRow[key] = reshapeArabic(newRow[key] as string);
            }
        });
        return newRow;
    });

    // Add Title
    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55); // slate-800
    doc.text(reshapedTitle, 105, 15, { align: 'center' });

    if (reshapedSubtitle) {
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128); // gray-500
        doc.text(reshapedSubtitle, 105, 22, { align: 'center' });
    }

    // Generate Table
    autoTable(doc, {
        columns: reshapedColumns,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: reshapedRows as any[],
        startY: 30,
        styles: {
            font: 'Amiri',
            fontSize: 9,
            halign: 'right',
            cellPadding: 3,
        },
        headStyles: {
            fillColor: [180, 83, 9], // sultan amber-700
            textColor: [255, 255, 255],
            fontStyle: 'normal',
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251] // gray-50
        },
        margin: { top: 30, right: 10, left: 10, bottom: 20 },
        didDrawPage: (data) => {
            // Footer
            const str = `صفحة ${data.pageNumber}`;
            doc.setFontSize(8);
            doc.text(reshapeArabic(str), 105, 285, { align: 'center' });
        }
    });

    // Save PDF
    const name = fileName || `report_${new Date().getTime()}.pdf`;
    doc.save(name);
};

export interface OrderExportData {
    serialNumber: number;
    customerName: string;
    totalAmount: number;
    status: string;
    dueDate?: string;
    createdAt?: string;
}

// Legacy support for existing call if any
export const exportOrdersToPDF = (orders: OrderExportData[], title: string) => {
    exportToPDF({
        title,
        columns: [
            { header: 'التسلسل', dataKey: 'serialNumber' },
            { header: 'اسم العميل', dataKey: 'customerName' },
            { header: 'القيمة', dataKey: 'totalAmount' },
            { header: 'الحالة', dataKey: 'status' },
            { header: 'التاريخ', dataKey: 'displayDate' },
        ],
        rows: orders.map(o => ({
            ...o,
            totalAmount: o.totalAmount?.toLocaleString(),
            displayDate: o.dueDate
                ? new Date(o.dueDate).toLocaleDateString('ar-EG')
                : (o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : '')
        })),
        fileName: `orders_${new Date().getTime()}.pdf`
    });
};
