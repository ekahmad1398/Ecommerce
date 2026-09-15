import jwt from "jsonwebtoken";
import env from "../config.js";
import bcrypt from "bycryptjs";


const accessjwtfun = (
  id ,
  role ,
  isBanned ,
  type ,
) => {
  const payload = { id, role, isBanned };

  if (type) {
    payload.type = type;
  }


  return jwt.sign(payload, env.JWT_temp_token, {
    expiresIn: `${env.Expiry_For_Temp_JWT}m`,
  });
};

export default accessjwtfun;

export const resetjwtfun = (id, type, password) => {
  const secret = env.JWT_temp_token + password;

  return jwt.sign({ id, type }, secret, {
    expiresIn: `15m`,
  });
};




export const refreshjwtfun = (id) => {
  return jwt.sign(id, env.JWT_Long_Token, {
    expiresIn: `${env.Expiry_For_Long_JWT}d`,
  });
};





export const hashingpassword = (password) => {
  
  const hashedpassword = bcrypt.hashSync(password, 12);
  return hashedpassword;
};
