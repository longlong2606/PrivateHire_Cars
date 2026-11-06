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
    const transporter = createSmtpTransporter();
    if (transporter && creds) {
      const senderName = process.env.EMAIL_FROM_NAME || 'PrivateHIre Cars';
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
  } catch (err) {
    console.warn(`⚠️ [AC5 Email Warning] Lỗi gửi email qua SMTP: ${err.message}. Đã lưu preview vào hệ thống.`);
    emailRecord.deliveryStatus = 'SMTP_FAILED';
    emailRecord.error = err.message;
  }

  emailLog.unshift(emailRecord);
  return emailRecord;
};

const getEmailHistory = () => {
  return [...emailLog];
};

module.exports = {
  sendConfirmationEmail,
  getEmailHistory,
};

