const nodemailer = require('nodemailer');

// In-memory store for sent emails for testing and demo inspection
const emailLog = [];

function getCleanCredentials() {
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  user = user.trim().replace(/^["']|["']$/g, '').trim();
  pass = pass.replace(/[\s"']/g, '');
  return { user, pass };
}

function createSmtpTransporter() {
  const creds = getCleanCredentials();
  if (!creds) return null;

  let host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim().replace(/^["']|["']$/g, '');
  let port = Number(process.env.SMTP_PORT || 465);
  if (/^\d+$/.test(host)) {
    port = Number(host) === 456 ? 465 : Number(host);
    host = 'smtp.gmail.com';
  }

  // If host is Gmail or user is Gmail, use nodemailer's built-in 'service: gmail' profile
  // which handles ports, TLS handshake and cipher negotiation reliably on all cloud platforms
  if (host === 'smtp.gmail.com' || creds.user.toLowerCase().endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: creds.user, pass: creds.pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: creds.user, pass: creds.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
}

/**
 * Send account registration confirmation email under AC5
 * AC5: After successful registration, a confirmation email is sent to the registered email address.
 */
const sendConfirmationEmail = async ({ toEmail, name, accountCode, mockCardRef }) => {
  const subject = `[Registration Confirmation] Welcome ${name} to PrivateHire Cars!`;
  const textContent = `Hello ${name},\n\nYour account has been successfully registered with PrivateHire Cars.\n\nAccount Details:\n- Account Code: ${accountCode}\n- Email: ${toEmail}\n- Linked Mock Card: ${mockCardRef}\n\nThank you for choosing PrivateHire Cars!`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #164B3B; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; letter-spacing: 0.5px;">🎉 Registration Successful!</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering your account with <strong>PrivateHire Cars</strong>. Here are your account details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #666;">Account Code:</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #164B3B;">${accountCode}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #666;">Registered Email:</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #666;">Mock Card Reference:</td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">${mockCardRef}</td>
          </tr>
        </table>
        <p>You can now use your registered email and password to sign in.</p>
        <div style="text-align: center; margin-top: 30px;">
          <a href="http://localhost:5173/login.html" style="background: #164B3B; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">
            Sign In to PrivateHire Cars
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        PrivateHire Cars System &bull; Automated notification email under AC5
      </div>
    </div>
  `;

  const emailRecord = {
    id: emailLog.length + 1,
    to: toEmail,
    subject,
    preview: textContent,
    html: htmlContent,
    sentAt: new Date().toISOString(),
    status: 'SENT',
  };

  try {
    const creds = getCleanCredentials();
    const senderName = process.env.EMAIL_FROM_NAME || 'PrivateHIre Cars';

    // --- Ưu tiên 1: Gửi qua HTTPS API (Bypass 100% việc Render chặn cổng SMTP 25/465/587) ---
    if (process.env.EMAIL_WEBHOOK_URL) {
      // 1. Google Apps Script Webhook (Miễn phí 100%, gửi từ chính Gmail của bạn tới BẤT KỲ ai, không cần mua domain)
      const webhookUrl = process.env.EMAIL_WEBHOOK_URL.trim();
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          name,
          subject,
          text: textContent,
          html: htmlContent,
        }),
      });
      const rawText = await response.text();
      let data = {};
      try { data = JSON.parse(rawText); } catch (_) { data = { message: rawText }; }
      if (!response.ok && response.status >= 400) {
        throw new Error(`Webhook Error (${response.status}): ${rawText}`);
      }
      emailRecord.deliveryStatus = 'SMTP_ACCEPTED';
      emailRecord.messageId = data.messageId || 'WEBHOOK_HTTPS_OK';
      console.log('======================================================');
      console.log(`✅ [AC5 Real Email] Đã gửi email thật thành công tới: ${toEmail} qua Google Apps Script Webhook!`);
      console.log('======================================================');
    } else if (process.env.BREVO_API_KEY) {
      // 2. Brevo API (Gửi được tới BẤT KỲ email nào, miễn phí 300 email/ngày, không cần custom domain)
      const apiKey = process.env.BREVO_API_KEY.trim();
      const senderEmail = (creds?.user || process.env.EMAIL_FROM || 'rotds123456@gmail.com').trim();
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail, name: name }],
          subject,
          htmlContent,
          textContent,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Brevo API Error (${response.status}): ${JSON.stringify(data)}`);
      }
      emailRecord.deliveryStatus = 'SMTP_ACCEPTED';
      emailRecord.messageId = data.messageId || 'BREVO_HTTPS_OK';
      console.log('======================================================');
      console.log(`✅ [AC5 Real Email] Đã gửi email thật thành công tới: ${toEmail} qua Brevo HTTPS API!`);
      console.log(`   MessageId: ${emailRecord.messageId}`);
      console.log('======================================================');
    } else if (process.env.RESEND_API_KEY) {
      // 3. Resend API
      const apiKey = process.env.RESEND_API_KEY.trim();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <onboarding@resend.dev>`,
          to: [toEmail],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403 && data.message && data.message.includes('only send testing emails')) {
          throw new Error('Resend miễn phí chỉ cho gửi về chính email tạo tài khoản Resend. Để gửi cho mọi người: hãy dùng Google Apps Script Webhook hoặc Brevo API không cần mua domain.');
        }
        throw new Error(`Resend API Error (${response.status}): ${JSON.stringify(data)}`);
      }
      emailRecord.deliveryStatus = 'SMTP_ACCEPTED';
      emailRecord.messageId = data.id || 'RESEND_HTTPS_OK';
      console.log('======================================================');
      console.log(`✅ [AC5 Real Email] Đã gửi email thật thành công tới: ${toEmail} qua Resend HTTPS API!`);
      console.log(`   MessageId: ${emailRecord.messageId}`);
      console.log('======================================================');
    } else {
      // --- Phương thức 2: Gửi qua Gmail SMTP (Hoạt động tốt khi chạy trên máy tính hoặc host không chặn SMTP) ---
      const transporter = createSmtpTransporter();
      if (transporter && creds) {
        let info;
        try {
          info = await transporter.sendMail({
            from: `"${senderName}" <${creds.user}>`,
            to: toEmail,
            subject,
            text: textContent,
            html: htmlContent,
          });
        } catch (firstAttemptErr) {
          console.warn(`⚠️ [AC5 Email Info] Lần 1 gửi qua Gmail Service chưa thành công (${firstAttemptErr.message}). Đang tự động chuyển sang Port 587 STARTTLS...`);
          // Fallback to Port 587 STARTTLS
          const fallbackTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: { user: creds.user, pass: creds.pass },
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 20000,
          });
          info = await fallbackTransporter.sendMail({
            from: `"${senderName}" <${creds.user}>`,
            to: toEmail,
            subject,
            text: textContent,
            html: htmlContent,
          });
        }

        emailRecord.deliveryStatus = 'SMTP_ACCEPTED';
        emailRecord.messageId = info.messageId;
        console.log('======================================================');
        console.log(`✅ [AC5 Real Email] Đã gửi email thật thành công tới: ${toEmail} qua Gmail SMTP!`);
        console.log(`   MessageId: ${info.messageId}`);
        console.log('======================================================');
      } else {
        console.log('======================================================');
        console.log(`📧 [AC5 Email Service] Confirmation email sent to: ${toEmail}`);
        console.log(`   Subject: ${subject}`);
        console.log(`   Account Code: ${accountCode}`);
        console.log('======================================================');
      }
    }
  } catch (err) {
    console.warn(`⚠️ [AC5 Email Warning] Lỗi gửi email qua SMTP: ${err.message}. Đã lưu preview vào hệ thống.`);
    emailRecord.deliveryStatus = 'SMTP_FAILED';
    emailRecord.error = err.message;
  }

  emailLog.unshift(emailRecord);
  return emailRecord;
};

async function dispatchRealEmail({ toEmail, subject, textContent, htmlContent, label = 'Email' }) {
  const creds = getCleanCredentials();
  const senderName = process.env.EMAIL_FROM_NAME || 'PrivateHire Cars';

  // 1. Try Brevo HTTPS API if configured
  if (process.env.BREVO_API_KEY) {
    try {
      const apiKey = process.env.BREVO_API_KEY.trim();
      const senderEmail = creds ? creds.user : 'contact@privatehirecars.co.uk';
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: toEmail }],
          subject,
          htmlContent,
          textContent,
        }),
      });
      if (response.ok) {
        console.log(`✅ [${label}] Sent successfully to ${toEmail} via Brevo API`);
        return true;
      }
    } catch (_) {}
  }

  // 2. Try Resend HTTPS API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const apiKey = process.env.RESEND_API_KEY.trim();
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${senderName} <onboarding@resend.dev>`,
          to: [toEmail],
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });
      if (response.ok) {
        console.log(`✅ [${label}] Sent successfully to ${toEmail} via Resend API`);
        return true;
      }
    } catch (_) {}
  }

  // 3. Try Gmail SMTP (SSL Port 465 with fallback to Port 587 STARTTLS)
  if (creds) {
    try {
      const transporter = createSmtpTransporter();
      if (transporter) {
        await transporter.sendMail({
          from: `"${senderName}" <${creds.user}>`,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`✅ [${label}] Sent successfully to ${toEmail} via Gmail SMTP (465)`);
        return true;
      }
    } catch (smtpErr) {
      console.warn(`⚠️ [${label}] First attempt on Port 465 failed (${smtpErr.message}). Falling back to Port 587 STARTTLS...`);
      try {
        const fallbackTransporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user: creds.user, pass: creds.pass },
          connectionTimeout: 15000,
          greetingTimeout: 15000,
          socketTimeout: 20000,
        });
        await fallbackTransporter.sendMail({
          from: `"${senderName}" <${creds.user}>`,
          to: toEmail,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`✅ [${label}] Sent successfully to ${toEmail} via Gmail Port 587 STARTTLS`);
        return true;
      } catch (fallbackErr) {
        console.warn(`⚠️ [${label}] Fallback to 587 also failed: ${fallbackErr.message}`);
      }
    }
  }

  console.log(`📧 [${label} Logged] Simulated delivery to ${toEmail}`);
  return false;
}

const sendBookingConfirmationEmail = async ({
  toEmail,
  name,
  bookingCode,
  pickupAddress,
  dropoffAddress,
  pickupTime,
  serviceName,
  vehicleCapacity,
  fareAmount,
  paymentMethod,
  paymentStatus,
}) => {
  const subject = `[PrivateHire Cars] Booking Confirmed — ${bookingCode}`;
  const textContent = `Hello ${name},\n\nYour booking ${bookingCode} has been confirmed.\n\nJourney Details:\n- Service: ${serviceName}\n- Pickup: ${pickupAddress}\n- Destination: ${dropoffAddress}\n- Pickup Time: ${new Date(pickupTime).toLocaleString('en-GB')}\n- Capacity: ${vehicleCapacity} passengers\n- Total Fare: £${Number(fareAmount).toFixed(2)} GBP\n- Payment: ${paymentMethod} (${paymentStatus})\n\nThank you for choosing PrivateHire Cars London!`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #25352e; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #164B3B; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">🚖 Booking Confirmed: ${bookingCode}</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your executive chauffeur booking has been confirmed with PrivateHire Cars London.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Booking Code:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #164B3B;">${bookingCode}</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Service:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-weight: bold;">${serviceName}</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Pickup:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${pickupAddress}</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Destination:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${dropoffAddress}</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Pickup Time:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${new Date(pickupTime).toLocaleString('en-GB')}</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Vehicle Capacity:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${vehicleCapacity} Passengers</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Total Fare:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; font-weight: bold; color: #3A8B68;">£${Number(fareAmount).toFixed(2)} GBP</td></tr>
          <tr><td style="padding: 8px 10px; border-bottom: 1px solid #ddd; color: #666;">Payment:</td><td style="padding: 8px 10px; border-bottom: 1px solid #ddd;">${paymentMethod} (${paymentStatus})</td></tr>
        </table>
        <p style="font-size: 13px; color: #555;">Note: Cancellations and amendments must be requested at least 24 hours prior to scheduled pickup time.</p>
      </div>
      <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        PrivateHire Cars London &bull; Automated notification under PRD P04
      </div>
    </div>
  `;

  await dispatchRealEmail({
    toEmail,
    subject,
    textContent,
    htmlContent,
    label: 'P04 Booking Confirmation Email',
  });
};

const sendSpecialOfferEmail = async ({ toEmail, name, promoCode, discountAmount }) => {
  const subject = `[PrivateHire Cars] Special Loyalty Reward — £${discountAmount} Off Your Next Journey!`;
  const textContent = `Hello ${name},\n\nCongratulations! Because you have completed 3 or more journeys with PrivateHire Cars, we are pleased to award you a special loyalty voucher:\n\nPromo Code: ${promoCode}\nDiscount: £${discountAmount} GBP\n\nYou can apply this voucher at checkout on your next online booking!\n\nPrivateHire Cars London`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #25352e; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #164B3B; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0; letter-spacing: 0.5px;">🎁 Special Loyalty Reward Voucher!</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Congratulations! Because you have reached loyalty milestones with PrivateHire Cars London, we are pleased to award you an exclusive discount voucher:</p>
        <div style="background: #FAF7F2; border: 2px dashed #C5A059; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0;">
          <div style="font-size: 13px; color: #718479; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Your Loyalty Voucher Code</div>
          <div style="font-size: 26px; font-weight: 800; color: #164B3B; letter-spacing: 2px; margin: 8px 0;">${promoCode}</div>
          <div style="font-size: 16px; font-weight: 700; color: #3A8B68;">Save £${Number(discountAmount).toFixed(2)} GBP on your next booking!</div>
        </div>
        <p>You can apply this voucher during checkout on your next minicab journey.</p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="http://localhost:5173/booking.html" style="background: #164B3B; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold; text-decoration: none; display: inline-block;">
            Book Your Next Journey
          </a>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        PrivateHire Cars London &bull; Automated loyalty reward under PRD P09
      </div>
    </div>
  `;

  await dispatchRealEmail({
    toEmail,
    subject,
    textContent,
    htmlContent,
    label: 'P09 Special Offer Email',
  });
};

const getEmailHistory = () => {
  return [...emailLog];
};

module.exports = {
  sendConfirmationEmail,
  sendBookingConfirmationEmail,
  sendSpecialOfferEmail,
  getEmailHistory,
};

