const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const baseTemplate = (title, body) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: Arial, sans-serif; background: #f6f8fb; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 24px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.08); overflow: hidden; }
      .header { background: #0d6efd; color: white; padding: 24px; text-align: center; }
      .content { padding: 24px; line-height: 1.6; }
      .footer { padding: 18px 24px; font-size: 12px; color: #7a7a7a; text-align: center; }
      .card { background: #f8f9ff; border-radius: 10px; padding: 18px; margin-bottom: 18px; }
      .button { display: inline-block; background: #0d6efd; color: white; padding: 12px 18px; border-radius: 8px; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="content">${body}</div>
      <div class="footer">Smart Campus Notification</div>
    </div>
  </body>
</html>`;

const templates = {
  bookingConfirm: ({ studentName, room, date, timeslot, purpose, link }) => {
    const body = `
      <p>Hi ${studentName || "Student"},</p>
      <div class="card">
        <h2>Booking Confirmed</h2>
        <p>Your classroom booking has been confirmed.</p>
        <ul>
          <li><strong>Room:</strong> ${room}</li>
          <li><strong>Date:</strong> ${date}</li>
          <li><strong>Timeslot:</strong> ${timeslot}</li>
          <li><strong>Purpose:</strong> ${purpose || "N/A"}</li>
        </ul>
      </div>
      ${link ? `<p><a class="button" href="${link}">View Booking</a></p>` : ""}
      <p>Thank you for using Smart Campus.</p>
    `;
    return baseTemplate("Booking Confirmed", body);
  },
  lostMatch: ({
    studentName,
    itemTitle,
    matchScore,
    matchReason,
    candidateTitle,
    candidateLocation,
    link,
  }) => {
    const body = `
      <p>Hi ${studentName || "Campus user"},</p>
      <div class="card">
        <h2>Lost &amp; Found Match Alert</h2>
        <p>We found a strong match for your item:</p>
        <ul>
          <li><strong>Your item:</strong> ${itemTitle}</li>
          <li><strong>Matched item:</strong> ${candidateTitle}</li>
          <li><strong>Confidence:</strong> ${matchScore}%</li>
          <li><strong>Reason:</strong> ${matchReason}</li>
          ${candidateLocation ? `<li><strong>Location:</strong> ${candidateLocation}</li>` : ""}
        </ul>
      </div>
      ${link ? `<p><a class="button" href="${link}">Review Matched Item</a></p>` : ""}
      <p>Please confirm the match in the Smart Campus app.</p>
    `;
    return baseTemplate("Lost Item Match", body);
  },
  burnoutAlert: ({
    studentName,
    riskLevel,
    summary,
    personalizedTip,
    supportLink,
  }) => {
    const body = `
      <p>Hi ${studentName || "Student"},</p>
      <div class="card">
        <h2>Burnout Risk Alert</h2>
        <p>Your wellbeing check shows a <strong>${riskLevel}</strong> risk level.</p>
        <p>${summary}</p>
      </div>
      <div class="card">
        <h3>Personalized Guidance</h3>
        <p>${personalizedTip}</p>
      </div>
      ${supportLink ? `<p><a class="button" href="${supportLink}">Get Support</a></p>` : ""}
      <p>Take a moment to rest and reach out to your mentor if needed.</p>
    `;
    return baseTemplate("Burnout Alert", body);
  },
  sosAlert: ({
    studentName,
    location,
    severity,
    incidentSummary,
    responseLink,
  }) => {
    const body = `
      <p>Hi ${studentName || "Campus staff"},</p>
      <div class="card">
        <h2>SOS Alert</h2>
        <p><strong>Severity:</strong> ${severity}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p>${incidentSummary}</p>
      </div>
      ${responseLink ? `<p><a class="button" href="${responseLink}">Respond Now</a></p>` : ""}
      <p>This alert has been classified as top priority. Please act immediately.</p>
    `;
    return baseTemplate("SOS Alert", body);
  },
  moodAlert: ({ studentName, mood, note, loggedAt, supportLink }) => {
    const body = `
      <p>Hi ${studentName || "Staff member"},</p>
      <div class="card">
        <h2>Mood Alert</h2>
        <p>The latest mood check indicates <strong>${mood}</strong>.</p>
        <p>${note}</p>
        ${loggedAt ? `<p><strong>Logged at:</strong> ${loggedAt}</p>` : ""}
      </div>
      ${supportLink ? `<p><a class="button" href="${supportLink}">Review Student Support</a></p>` : ""}
      <p>Please follow up if you believe the student needs extra support.</p>
    `;
    return baseTemplate("Mood Alert", body);
  },
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  template,
  templateData = {},
}) => {
  if (!to || !subject) {
    throw new Error("Email recipient and subject are required");
  }

  const computedHtml = template ? templates[template]?.(templateData) : html;
  const computedText =
    text || (computedHtml ? computedHtml.replace(/<[^>]+>/g, "") : "");

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text: computedText,
    html: computedHtml,
  });
};

module.exports = { sendEmail, templates };
