import ngrok from "@ngrok/ngrok";

export default async function forwardToApp() {
  const forwarder = await ngrok.forward({
    addr: "localhost:3000",
    authtoken_from_env: true,
    domain: "uncurious-axis-stardom.ngrok-free.dev",

  });
  console.log(`Available at: ${forwarder.url()}`);
}
