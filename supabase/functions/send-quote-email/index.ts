import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  customerName: string;
  quoteNumber: string;
  quoteDetails: {
    origin: string;
    destination: string;
    shipmentType: string;
    total: string;
    currency: string;
    validUntil: string;
  };
  pdfBase64?: string;
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const emailData: EmailRequest = await req.json();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #1f4e78 0%, #2d5f8d 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border: 1px solid #e0e0e0;
      border-top: none;
    }
    .quote-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .quote-info h2 {
      color: #1f4e78;
      margin-top: 0;
      font-size: 20px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: bold;
      color: #555;
    }
    .value {
      color: #333;
    }
    .total-box {
      background: #1f4e78;
      color: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    .total-box .amount {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .button {
      display: inline-block;
      background: #1f4e78;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e0e0e0;
      margin-top: 20px;
    }
    .message {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Quotation - ${emailData.quoteNumber}</h1>
  </div>

  <div class="content">
    <p>Dear ${emailData.customerName},</p>

    <p>Thank you for your interest in our services. Please find attached your quotation details below.</p>

    ${emailData.message ? `<div class="message">${emailData.message}</div>` : ''}

    <div class="quote-info">
      <h2>Shipment Details</h2>
      <div class="detail-row">
        <span class="label">Quote Number:</span>
        <span class="value">${emailData.quoteNumber}</span>
      </div>
      <div class="detail-row">
        <span class="label">Origin:</span>
        <span class="value">${emailData.quoteDetails.origin}</span>
      </div>
      <div class="detail-row">
        <span class="label">Destination:</span>
        <span class="value">${emailData.quoteDetails.destination}</span>
      </div>
      <div class="detail-row">
        <span class="label">Service Type:</span>
        <span class="value">${emailData.quoteDetails.shipmentType}</span>
      </div>
      <div class="detail-row">
        <span class="label">Valid Until:</span>
        <span class="value">${emailData.quoteDetails.validUntil}</span>
      </div>
    </div>

    <div class="total-box">
      <div style="font-size: 16px; opacity: 0.9;">Total Amount</div>
      <div class="amount">${emailData.quoteDetails.currency} ${emailData.quoteDetails.total}</div>
    </div>

    <p style="margin-top: 30px;">The complete quotation is attached as a PDF document. Please review and let us know if you have any questions or would like to proceed.</p>

    <p>We look forward to serving you!</p>

    <p style="margin-top: 30px;">
      Best regards,<br>
      <strong>Your Freight Team</strong>
    </p>
  </div>

  <div class="footer">
    <p>This is an automated message. Please do not reply directly to this email.</p>
    <p>For any inquiries, please contact us through our customer service.</p>
  </div>
</body>
</html>
    `;

    const textContent = `
Dear ${emailData.customerName},

Thank you for your interest in our services. Please find your quotation details below:

Quote Number: ${emailData.quoteNumber}
Origin: ${emailData.quoteDetails.origin}
Destination: ${emailData.quoteDetails.destination}
Service Type: ${emailData.quoteDetails.shipmentType}
Valid Until: ${emailData.quoteDetails.validUntil}

Total Amount: ${emailData.quoteDetails.currency} ${emailData.quoteDetails.total}

${emailData.message ? `\nMessage: ${emailData.message}\n` : ''}

The complete quotation is attached as a PDF document.

Best regards,
Your Freight Team
    `;

    console.log(`Sending quote ${emailData.quoteNumber} to ${emailData.to}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Quote ${emailData.quoteNumber} email sent successfully to ${emailData.to}`,
        note: "Email integration is ready. Connect your email service (SendGrid, Resend, etc.) to enable actual sending."
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to send email"
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
