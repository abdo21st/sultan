import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import arabicReshaper from 'arabic-reshaper';
import { AmiriRegularBase64 } from './amiri-font-raw';

export interface OrderExportData {
    serialNumber: number;
    customerName: string;
    totalAmount: number;
    status: string;
    dueDate: string;
}

export const exportOrdersToPDF = (orders: OrderExportData[], title: string) => {
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
    });

    // Add Amiri font to vFS and register it
    doc.addFileToVFS('Amiri-Regular.ttf', AmiriRegularBase64);
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
    doc.setFont('Amiri');

    // Handle Arabic Text Reshaping
    const reshape = (text: string) => {
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

    // Table Header (Arabic)
    const columns = [
        { header: reshape('التسلسل'), dataKey: 'serial' },
        { header: reshape('اسم العميل'), dataKey: 'name' },
        { header: reshape('القيمة (د.ل)'), dataKey: 'amount' },
        { header: reshape('الحالة'), dataKey: 'status' },
        { header: reshape('تاريخ الاستحقاق'), dataKey: 'date' },
    ];

    // Data Mapping
    const rows = orders.map(order => ({
        serial: order.serialNumber,
        name: reshape(order.customerName),
        amount: order.totalAmount.toLocaleString(),
        status: reshape(order.status),
        date: order.dueDate ? new Date(order.dueDate).toLocaleDateString('ar-EG') : '---'
    }));

    // Add Title
    doc.setFontSize(22);
    doc.text(reshape(title), 105, 20, { align: 'center' });

    // Generate Table
    autoTable(doc, {
        columns: columns,
        body: rows,
        startY: 30,
        styles: {
            font: 'Amiri',
            fontSize: 10,
            halign: 'right',
            cellPadding: 5,
        },
        headStyles: {
            fillColor: [180, 83, 9], // sultan amber-700
            textColor: [255, 255, 255],
            fontStyle: 'normal', // Bold might not work with custom font unless specifically added
            halign: 'center'
        },
        alternateRowStyles: {
            fillColor: [250, 250, 250]
        },
        margin: { top: 30 },
    });

    // Save PDF
    const fileName = `orders_${new Date().getTime()}.pdf`;
    doc.save(fileName);
};
