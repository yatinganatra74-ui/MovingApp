import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [31, 78, 120];
}

interface QuoteData {
  quote_number: string;
  quote_date: string;
  valid_until: string;
  customer: {
    name: string;
    company_name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  shipment: {
    origin_port: string;
    destination_port: string;
    shipment_type: string;
    carrier_name?: string;
    transit_time_days?: number;
    incoterm?: string;
    estimated_cbm?: number;
    estimated_weight_kg?: number;
    number_of_packages?: number;
    container_type?: string;
    number_of_containers?: number;
    commodity_description?: string;
  };
  lineItems: Array<{
    description: string;
    quantity: number;
    unit_type: string;
    unit_rate: number;
    amount: number;
    is_included: boolean;
  }>;
  totals: {
    subtotal: number;
    discount_percentage?: number;
    discount_amount?: number;
    total: number;
    currency: string;
  };
  company: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo_url?: string;
    primary_color?: string;
  };
  notes?: string;
  terms_and_conditions?: string;
  is_agent_quote?: boolean;
}

export function generateQuotePDF(quoteData: QuoteData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  const primaryColor = quoteData.company.primary_color || '#1F4E78';
  const [r, g, b] = hexToRgb(primaryColor);

  if (quoteData.company.logo_url) {
    try {
      const logoImg = new Image();
      logoImg.src = quoteData.company.logo_url;
      doc.addImage(logoImg, 'PNG', 15, yPos, 40, 15);
      yPos += 20;
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(r, g, b);
  doc.text(quoteData.company.name, 15, yPos);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  yPos += 6;
  doc.text(quoteData.company.address, 15, yPos);
  yPos += 4;
  doc.text(`Tel: ${quoteData.company.phone} | Email: ${quoteData.company.email}`, 15, yPos);
  if (quoteData.company.website) {
    yPos += 4;
    doc.text(`Web: ${quoteData.company.website}`, 15, yPos);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(r, g, b);
  doc.text('QUOTATION', pageWidth - 15, 25, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Quote #: ${quoteData.quote_number}`, pageWidth - 15, 35, { align: 'right' });
  doc.text(`Date: ${new Date(quoteData.quote_date).toLocaleDateString()}`, pageWidth - 15, 40, { align: 'right' });
  doc.text(`Valid Until: ${new Date(quoteData.valid_until).toLocaleDateString()}`, pageWidth - 15, 45, { align: 'right' });

  yPos = 55;

  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPos, pageWidth - 30, 35, 'F');

  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(r, g, b);
  doc.text('CUSTOMER INFORMATION', 18, yPos);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  yPos += 6;
  doc.text(quoteData.customer.company_name || quoteData.customer.name, 18, yPos);
  yPos += 5;
  doc.text(`Contact: ${quoteData.customer.name}`, 18, yPos);
  yPos += 5;
  doc.text(`Email: ${quoteData.customer.email}`, 18, yPos);
  if (quoteData.customer.phone) {
    yPos += 5;
    doc.text(`Phone: ${quoteData.customer.phone}`, 18, yPos);
  }
  if (quoteData.customer.address) {
    yPos += 5;
    doc.text(`Address: ${quoteData.customer.address}`, 18, yPos);
  }

  yPos = 95;

  doc.setFillColor(245, 250, 255);
  doc.rect(15, yPos, pageWidth - 30, 30, 'F');

  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(r, g, b);
  doc.text('SHIPMENT DETAILS', 18, yPos);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  yPos += 6;

  const leftCol = 18;
  const rightCol = pageWidth / 2 + 5;

  doc.text(`Route: ${quoteData.shipment.origin_port} → ${quoteData.shipment.destination_port}`, leftCol, yPos);
  doc.text(`Service Type: ${quoteData.shipment.shipment_type}`, rightCol, yPos);
  yPos += 5;

  if (quoteData.shipment.carrier_name) {
    doc.text(`Carrier: ${quoteData.shipment.carrier_name}`, leftCol, yPos);
  }
  if (quoteData.shipment.transit_time_days) {
    doc.text(`Transit Time: ${quoteData.shipment.transit_time_days} days`, rightCol, yPos);
    yPos += 5;
  } else {
    yPos += 5;
  }

  if (quoteData.shipment.shipment_type === 'FCL') {
    doc.text(`Container: ${quoteData.shipment.number_of_containers} x ${quoteData.shipment.container_type}`, leftCol, yPos);
  } else {
    doc.text(`Volume: ${quoteData.shipment.estimated_cbm} CBM`, leftCol, yPos);
    if (quoteData.shipment.number_of_packages) {
      doc.text(`Packages: ${quoteData.shipment.number_of_packages}`, rightCol, yPos);
    }
  }

  if (quoteData.shipment.estimated_weight_kg) {
    yPos += 5;
    doc.text(`Weight: ${quoteData.shipment.estimated_weight_kg} KG`, leftCol, yPos);
  }

  if (quoteData.shipment.incoterm) {
    doc.text(`Incoterm: ${quoteData.shipment.incoterm}`, rightCol, yPos);
  }

  yPos = 130;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(r, g, b);
  doc.text('PRICING BREAKDOWN', 18, yPos);

  yPos += 5;

  const tableData = quoteData.lineItems
    .filter(item => item.is_included)
    .map(item => [
      item.description,
      item.quantity.toFixed(2),
      item.unit_type,
      `${quoteData.totals.currency} ${item.unit_rate.toFixed(2)}`,
      `${quoteData.totals.currency} ${item.amount.toFixed(2)}`
    ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [r, g, b],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: 50
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  const summaryX = pageWidth - 75;

  doc.setFillColor(245, 245, 245);
  doc.rect(summaryX - 5, yPos - 5, 60, 30, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Subtotal:', summaryX, yPos);
  doc.text(`${quoteData.totals.currency} ${quoteData.totals.subtotal.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });

  if (quoteData.totals.discount_amount && quoteData.totals.discount_amount > 0) {
    yPos += 6;
    doc.text(`Discount (${quoteData.totals.discount_percentage}%):`, summaryX, yPos);
    doc.text(`-${quoteData.totals.currency} ${quoteData.totals.discount_amount.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
  }

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(r, g, b);
  doc.text('TOTAL:', summaryX, yPos);
  doc.text(`${quoteData.totals.currency} ${quoteData.totals.total.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });

  yPos += 15;

  if (quoteData.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Notes:', 15, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(quoteData.notes, pageWidth - 30);
    doc.text(notesLines, 15, yPos);
    yPos += notesLines.length * 5 + 5;
  }

  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Terms & Conditions:', 15, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  const terms = quoteData.terms_and_conditions || `
1. This quotation is valid until ${new Date(quoteData.valid_until).toLocaleDateString()}.
2. Rates are subject to currency fluctuations and may be adjusted accordingly.
3. All charges are exclusive of taxes unless stated otherwise.
4. Cargo must be ready for collection on the agreed date.
5. Payment terms: As per agreed credit terms or proforma invoice.
6. The carrier reserves the right to increase rates in case of market changes.
7. Insurance is not included unless specifically mentioned.
8. Additional charges may apply for special handling or hazardous goods.
  `.trim();

  const termsLines = doc.splitTextToSize(terms, pageWidth - 30);
  doc.text(termsLines, 15, yPos);

  doc.setDrawColor(r, g, b);
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your business!', pageWidth / 2, pageHeight - 18, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 13, { align: 'center' });

  return doc;
}

export function downloadQuotePDF(quoteData: QuoteData) {
  const doc = generateQuotePDF(quoteData);
  doc.save(`Quote_${quoteData.quote_number}.pdf`);
}

export function getQuotePDFBlob(quoteData: QuoteData): Blob {
  const doc = generateQuotePDF(quoteData);
  return doc.output('blob');
}

export function getQuotePDFBase64(quoteData: QuoteData): string {
  const doc = generateQuotePDF(quoteData);
  return doc.output('dataurlstring');
}
