// Roda na subida do servidor: valida a configuração antes da primeira requisição.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./server/env");
}
