#!/bin/sh
# Sobe os dois processos num container só: o serviço de chamados escuta só por dentro (4001)
# e o web atende na porta que a plataforma passar em $PORT. Os bancos ficam no volume /data.
set -e

DATA_DIR="${DATA_DIR:-/data}"
TICKETS_PORT="${TICKETS_PORT:-4001}"
mkdir -p "$DATA_DIR"

: "${TICKET_SERVICE_TOKEN:?Defina TICKET_SERVICE_TOKEN (mínimo de 16 caracteres)}"
: "${SESSION_SECRET:?Defina SESSION_SECRET (mínimo de 32 caracteres)}"

(
  cd apps/ticket-service
  PORT="$TICKETS_PORT" DATABASE_URL="file:$DATA_DIR/tickets.db" exec node_modules/.bin/tsx src/server.ts
) &
TICKETS_PID=$!

# Se o serviço de chamados cair, o container cai junto e a plataforma reinicia tudo.
trap 'kill $TICKETS_PID 2>/dev/null' EXIT

cd apps/web
DATABASE_URL="file:$DATA_DIR/app.db" TICKET_SERVICE_URL="http://127.0.0.1:$TICKETS_PORT" \
  node_modules/.bin/next start --port "${PORT:-3000}" &
WEB_PID=$!

while kill -0 $TICKETS_PID 2>/dev/null && kill -0 $WEB_PID 2>/dev/null; do sleep 2; done
exit 1
