# SCRUM-47 — real Gmail registration email

This addition leaves every original project file unchanged, including the frontend,
account controller/model/routes, database schema, `emailService.js`, package files
and original launch scripts. Nodemailer was already declared in the backend.

## Set up the sender

1. Use a Gmail account controlled by the team.
2. Enable 2-Step Verification for that Google account, then generate an App Password
   named `PrivateHire Cars`. If this option is unavailable, consult Google's account
   requirements; a school administrator may restrict it.
3. In `backend`, copy `.env.email.example` to `.env.email.local`.
4. Enter the Gmail address in `SMTP_USER` and the generated 16-character App Password
   in `SMTP_PASS`. Keep the SMTP host and port at `smtp.gmail.com` and `465`.
   Spaces in Google's displayed App Password are removed automatically.
5. Keep the other database settings in the team's existing `backend/.env`, if used.
   Neither that file nor `.env.example` needs to be replaced. Set `EMAIL_LOGIN_URL`
   to the actual local login-page URL if the frontend is hosted on another port.

`.env.email.local` is already ignored by the existing `.gitignore` pattern
`.env.*.local`. Environment variables take priority over these files. The email
configuration file takes priority over `backend/.env` for values not set externally.

Google setup: https://support.google.com/accounts/answer/185833

## Check the configuration without sending mail

From `backend`:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
node verify-email.js
```

Verification checks SMTP connection and authentication. It does not send a message
or prove delivery to an inbox.

## Start the application with real email enabled

Start the backend using the **new** launcher `backend/start-with-email.bat`, or:

```powershell
cd backend
node src/server-with-email.js
```

Start the frontend in another terminal with its existing command:

```powershell
cd frontend
npm run dev
```

Use one backend process on port 5000. The old `npm start`, `npm run dev` and
`run-all.bat` still use the unchanged, original in-memory email preview. They do not
enable real SMTP automatically. Stop an existing backend before using the new entry
point; starting the new backend alongside it causes a port conflict.

## How this connects to the original registration code

The new entry point loads the Gmail configuration and verifies SMTP first. It then
installs the real sender into the existing email-service export before loading the
original controller and server. The original registration flow continues to validate
input, hash the password and save the account before calling confirmation email.

Emails contain text and HTML versions, a greeting, account code, registered email,
mock-card reference and local sign-in link. Customer-provided values are HTML-escaped;
the account password is not included. This is a registration confirmation, not an
account-activation requirement.

The existing `/api/accounts/register` response and `/api/accounts/emails` history
remain compatible. Only messages accepted by SMTP enter the SENT history; records
also contain `deliveryStatus: SMTP_ACCEPTED`, the provider and message ID.
History is held in memory, like the original preview, and clears on backend restart.
SMTP acceptance does not guarantee inbox placement: check the recipient's Inbox and
Spam folders as the final delivery evidence.

If sending fails after account creation, the additional adapter returns HTTP 502
with `success: false`, `emailSent: false`, `accountCreated: true` and an explanatory
message. The account remains usable. This prevents the unchanged frontend from
incorrectly claiming that confirmation email was sent. Do not register the same
address again as a retry; record the delivery failure and resolve it with the team.
Automatic retry and a resend button are not added in this task.

## Verification and coursework evidence

```powershell
cd backend
node --test test/registration-email.test.js
```

The tests use a local SMTP server and an isolated in-memory test database. They send
no external email and do not change the team's database. For real Gmail evidence:

1. Configure and verify the Gmail sender locally.
2. Start the new backend and register a fresh account using a real inbox you control.
3. Check HTTP 201 and `emailSent: true`, the saved account, and the actual email in
   the recipient inbox. Check the existing email-history endpoint if needed.
4. Capture the email subject/body and date for the report. Exclude sender credentials
   and the `.env.email.local` file from screenshots.
5. Confirm an invalid/duplicate registration creates no extra confirmation message.

Real Gmail inbox delivery must be checked after sender credentials are configured;
passing the local tests alone is not proof of real Gmail delivery.
