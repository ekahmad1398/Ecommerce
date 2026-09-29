import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const accessjwtfun = ({ id, role, vendorID = null }) => {
  const payload = { id, role, vendorID };

  return jwt.sign(payload, process.env.JWT_temp_token, {
    expiresIn: `${JSON.parse(process.env.Expiry_For_Temp_JWT)}m`,
  });
};

export default accessjwtfun;

export const resetjwtfun = ({ id, type, password }) => {
  const secret = process.env.JWT_temp_token + password;

  return jwt.sign({ id, type }, secret, {
    expiresIn: `${JSON.parse(process.env.Expiry_For_Temp_JWT)}m`,
  });
};

export const refreshjwtfun = ({ id }) => {
  return jwt.sign({ id }, process.env.JWT_Long_Token, {
    expiresIn: `${JSON.parse(process.env.Expiry_For_Long_JWT)}d`,
  });
};

export const hashingpassword = (password) => {
  const hashedpassword = bcrypt.hashSync(password, 12);
  return hashedpassword;
};
