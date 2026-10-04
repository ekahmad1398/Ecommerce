import "dotenv/config";
import { cleanEnv, str, port, num } from "envalid";

const env = cleanEnv(process.env, {
  MONGODB_URI: str(),
  PORT: port(),
  NODE_ENV: str(),
  MAILTRAP_TOKEN: str(),
  CLOUDINARY_CLOUD_NAME: str(),
  CLOUDINARY_API_KEY: str(),
  CLOUDINARY_API_SECRET: str(),
  BETTER_AUTH_API_KEY: str(),
  JWT_temp_token: str(),
  Expiry_For_Temp_JWT: num(),
  Frontend_URL: str(),
  JWT_Long_Token: str(),
  Expiry_For_Long_JWT: num(),
  JWT_RESET_TEXT: str(),
  STRIPE_PUBLISHABLE_KEY: str(),
  STRIPE_SECRET_KEY: str(),
  NGROK_AUTHTOKEN: str(),
  STRIPE_WEBHOOK_SECRET:str()
});

export default env;
