import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import env from "../config.js";

const accessjwtfun = ({ id, role, vendorID = null }: { id: string; role: string; vendorID?: string | null }) => {
  const payload = { id, role, vendorID };

  return jwt.sign(payload, env.JWT_temp_token, {
    expiresIn: `${env.Expiry_For_Temp_JWT}m`,
  });
};

export default accessjwtfun;

export const resetjwtfun = ({ id, type, password }: { id: string; type: string; password: string }) => {
  const secret = process.env.JWT_temp_token + password;

  return jwt.sign({ id, type }, secret, {
    expiresIn: `${env.Expiry_For_Temp_JWT}m`,
  });
};

export const refreshjwtfun = ({ id }: { id: string }) => {
  return jwt.sign({ id }, env.JWT_Long_Token, {
    expiresIn: `${env.Expiry_For_Long_JWT}d`,
  });
};

export const hashingpassword = (password: string) => {
  const hashedpassword = bcrypt.hashSync(password, 12);
  return hashedpassword;
};
