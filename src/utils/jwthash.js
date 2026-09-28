import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs"

const accessjwtfun = ({ id, role, status, vendorID = null }) => {
  const payload = { id, role, status, vendorID };

  return jwt.sign(payload, process.env.JWT_temp_token, {
    expiresIn: `${process.env.Expiry_For_Temp_JWT}m`,
  });
};

export default accessjwtfun;

export const resetjwtfun = ({ id, type, password }) => {
  const secret = env.JWT_temp_token + password;

  return jwt.sign({ id, type }, secret, {
    expiresIn: `${process.env.Expiry_For_Temp_JWT}m`,
  });
};

export const refreshjwtfun = ({ id, role }) => {
  return jwt.sign(id, process.env.JWT_Long_Token, {
    expiresIn: `${env.Expiry_For_Long_JWT}d`,
  });
};

export const hashingpassword = (password) => {
  const hashedpassword = bcrypt.hashSync(password, 12);
  return hashedpassword;
};
