import Nodemailer from "nodemailer";
import { MailtrapTransport } from "mailtrap";


const TOKEN = process.env.MAILTRAP_TOKEN
const transport = Nodemailer.createTransport(
  MailtrapTransport({
    token: TOKEN,
  }),
);
const sender = {
  address: "hello@demomailtrap.co",
  name: "Mailtrap Test",
};

export const welcomeemail = async (
  recipient,
  subject,
  body,
) => {
  const recipients = [recipient];
  try {
    const result = await transport.sendMail({
      from: sender,
      to: recipients,
      subject: subject,
      text: body,
      category: "Integration Test",
    });
    console.log("email sent successfully");
  } catch (error) {
    console.log(error);
  }
};


export const OTPMail = async (
  recipient,
  OTP,
) => {
  try {
    const result = await transport.sendMail({
      from: sender,
      to: recipient, 
      subject:"OTP Request",
      text: `Your 6-digit security code is: ${OTP}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>OTP Approaval request</h2>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; tracking-content: 2px; color: #2563eb;">${OTP}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280;">This verification code will expire in 5 minutes.</p>
        </div>
      `,
      headers: {
        "X-Mailtrap-Category": "Integration Test",
      },
    });

    const messageId = result.messageId ?? result.id ?? null;
    console.log("Email sent successfully to Mailtrap:", messageId);
    return { success: true, messageId };
  } catch (error) {
    console.error("Nodemailer transmission failed:", error);
    return { success: false, error };
  }
};


export const forgetmail = async (
  recipient,
  link,
) => {
  try {
    const result = await transport.sendMail({
      from: sender,
      to: recipient, 
      subject:"link Request",
      text: `Your security link is here`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>link Approaval request</h2>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; tracking-content: 2px; color: #2563eb;">${link}</span>
          </div>
          <p style="font-size: 12px; color: #6b7280;">This verification code will expire in 5 minutes.</p>
        </div>
      `,
      headers: {
        "X-Mailtrap-Category": "Integration Test",
      },
    });


  } catch (error) {
    console.error("Nodemailer transmission failed:", error);
    return { success: false, error };
  }
};