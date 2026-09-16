import { dash } from "@better-auth/infra";

export const auth = betterAuth({
  // ... your existing config
  baseURL:`http://localhost:${process.env.PORT}`,
  plugins: [
    // ... other plugins
    dash()
  ],
  trustedOrigins:["http://localhost:3001"]
})

// this upper code is for connecting google or github sign in.