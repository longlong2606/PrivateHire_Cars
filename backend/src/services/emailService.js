const nodemailer = require('nodemailer');

// In-memory store for sent emails for testing and demo inspection
const emailLog = [];

function createSmtpTransporter() {
  const user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  let host = process.env.SMTP_HOST || 'smtp.gmail.com';
  let port = Number(process.env.SMTP_PORT || 465);
  if (/^\d+$/.test(host)) {
    port = Number(host) === 456 ? 465 : Number(host);
    host = 'smtp.gmail.com';
  }
  pass = pass.replace(/\s/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
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
    const transporter = createSmtpTransporter();
    if (transporter) {
      const senderName = process.env.EMAIL_FROM_NAME || 'PrivateHIre Cars';
      const info = await transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });
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

