# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema no chat; o agent consulta os chamados dele, busca na central de ajuda, prepara chamados para confirmação e chama um analista quando precisa. Cada resposta mostra o que o agent entendeu, o que fez, com que confiança e por quê.

- **Funcionário** (Telas 1, 2, 3 e 6): login, chat em tempo real com cards de chamado, seleção, rascunho para confirmar, opções rápidas e limite de 30 mensagens por sessão.
- **Analista** (Telas 4 e 5): console com filtros, resumo da transferência, assumir, devolver ao agent, encerrar e painel com os chamados do funcionário.
- **Serviço de chamados simulado**, separado do agent, com instabilidade configurável como um sistema legado.

**Demo:** https://teste-beyond.up.railway.app (entre com qualquer usuário da tabela abaixo e qualquer senha).

## Como rodar

Requisitos: Node 22+ e pnpm (`corepack enable`).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env              # coloque a GOOGLE_GENERATIVE_AI_API_KEY
cp apps/ticket-service/.env.example apps/ticket-service/.env   # opcional: liga a instabilidade
pnpm dev
```

- Chat e console: http://localhost:3000
- Serviço de chamados: http://localhost:4001

A chave do Gemini é gratuita: https://aistudio.google.com/apikey. Sem ela o app sobe normalmente e o chat avisa que o assistente não está configurado.

Os bancos SQLite são criados e populados na primeira execução. `pnpm db:reset` apaga os dois para recomeçar.

### Usuários de exemplo (qualquer senha)

| E-mail                      | Perfil                | Para testar                                                                                                            |
| --------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ana.souza@nexo.com.br`     | Funcionária           | Chamado vencido (INC-20311), resolvido há 4 dias (INC-20150, pode reabrir), resolvido há 20 dias (INC-19877, não pode) |
| `bruno.tavares@nexo.com.br` | Funcionário           | Dono do INC-20335; a Ana não pode vê-lo                                                                                |
| `rafael.lima@nexo.com.br`   | Analista (Suporte N2) | Console                                                                                                                |
| `juliana.costa@nexo.com.br` | Analista (Suporte N1) | Console, e testar dois analistas na mesma conversa                                                                     |

### Outros comandos

```bash
pnpm test        # testes de todos os pacotes
pnpm typecheck
pnpm lint
pnpm --filter @nexo/agent chat     # conversar com o agent pelo terminal, vendo cada decisão
pnpm --filter @nexo/agent eval     # evals contra o modelo real (veja "Qualidade das decisões")
```

## Arquitetura

```
 Navegador ──Server Actions──▶ apps/web (Next.js) ──────────────▶ packages/agent (Mastra)
     ▲                          │  sessão, conversas (SQLite)          │  Gemini decide
     └──────────SSE─────────────┤  fila de turnos, limites de uso      │  ferramentas ──┐
                                │  confirmação de rascunhos            │                │
                                └──────▶ packages/ticket-client ◀──────┘◀───────────────┘
                                              │ REST com retry, timeout e idempotência
                                              ▼
                                      apps/ticket-service (Hono + SQLite)
                                      chamados, funcionários, central de ajuda, instabilidade
```

O diagrama completo está em [`docs/arquitetura.excalidraw`](docs/arquitetura.excalidraw).

| Pacote                   | Responsabilidade                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/domain`        | Regras do Anexo A como funções puras: tipos, SLA em horas úteis, prioridade, reabertura em 7 dias, motivos e equipe da transferência, transições da conversa, contrato das mensagens do chat. Sem I/O. |
| `packages/ticket-client` | Cliente tipado do serviço de chamados. Valida as respostas com os schemas do domínio, devolve `Result`, faz retry com backoff e respeita `Retry-After`.                                                |
| `packages/agent`         | O agent: instruções, ferramentas, montagem da resposta e evals. Não sabe nada de HTTP nem de banco.                                                                                                    |
| `apps/ticket-service`    | O "sistema legado": API REST com idempotência no POST, token entre serviços e falhas simuladas (latência, 503, quedas de alguns segundos).                                                             |
| `apps/web`               | Interface, sessão, persistência das conversas, tempo real (SSE), orquestração dos turnos do agent e console do analista.                                                                               |

Decisões principais:

- **Serviço de chamados separado, acessado por REST.** O agent fala com ele através do `ticket-client`, como falaria com o sistema real. As instabilidades aparecem para o agent como falhas de ferramenta, e ele avisa o funcionário em vez de inventar.
- **SSE em vez de WebSocket.** O tráfego em tempo real é só do servidor para o navegador; as ações vão por Server Actions. O SSE reconecta sozinho com `Last-Event-ID` e não precisa de servidor próprio.
- **Erros como valor (`Result`), não exceção.** Indisponibilidade do serviço de chamados, chamado de outro funcionário ou cota do modelo são casos esperados e tratados no tipo. Exceções ficam para o que é de fato inesperado.
- **Persistência:** conversas, mensagens, decisões e estado (com o agent, aguardando analista, com analista, encerrada) ficam no SQLite do web; chamados no SQLite do serviço. Tudo sobrevive a reinícios.
- **Concorrência:** atualizações condicionais em transação impedem que dois analistas assumam a mesma conversa; uma fila por conversa impede dois turnos do agent ao mesmo tempo.

## Como o agent decide

Cada mensagem do funcionário vira um **turno**:

1. A mensagem é salva e aparece na hora. O turno roda em segundo plano (`after()` do Next) e o chat mostra "Analisando sua mensagem…" pelo SSE.
2. `runAgentTurn` cria o agent do Mastra com as instruções (regras do Anexo A), as **ferramentas** e as últimas 20 mensagens, incluindo o que já foi consultado em turnos anteriores (para não repetir chamadas).
3. O modelo escolhe ferramentas em ciclo (até 6 passos) e termina obrigatoriamente chamando `responder`, com a mensagem, a intenção, o que entendeu, a confiança (0 a 1) e o motivo.
4. O código monta a resposta a partir do que as ferramentas **de fato** fizeram, aplica as regras e grava tudo junto da mensagem.

O princípio é: **o modelo escolhe, o código garante.**

| O quê                                                             | Quem decide                                                                                                                                                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entender o pedido, o que perguntar, qual ferramenta usar, o texto | Modelo                                                                                                                                                                  |
| De quem são os chamados consultados                               | Código: o funcionário vem da sessão, nenhuma ferramenta o recebe como argumento                                                                                         |
| Prioridade e prazo                                                | Código: `classifyPriority` e `computeDueAt`; o modelo só informa os fatos (quem é afetado, se impede de trabalhar, se há compromisso hoje)                              |
| Possível duplicidade                                              | Código: antes de montar o rascunho, procura chamados do mesmo tipo e categoria; o modelo só pode dispensar IDs específicos depois de perguntar, e isso fica no registro |
| Reabertura                                                        | Código: só dentro da janela de 7 dias                                                                                                                                   |
| Transferência por baixa confiança ou pedido                       | Código: `evaluateHandoff` (limite de 0,6), mesmo que o modelo não tenha chamado a ferramenta                                                                            |
| Equipe (N1 ou N2) e prazo do analista                             | Código: crítico e vencido vão para o N2                                                                                                                                 |
| Quais chamados aparecem como card                                 | Código: só os que as ferramentas trouxeram neste turno, então o modelo não consegue mostrar um chamado inventado ou de outra pessoa                                     |
| Criar, complementar ou reabrir chamado                            | Ninguém no turno: o agent só **propõe** (card de rascunho). O chamado só é criado quando o funcionário clica em Confirmar, com chave de idempotência `draft-<id>`       |

Ferramentas: `consultar_meus_chamados`, `ver_chamado`, `buscar_central_de_ajuda`, `preparar_rascunho`, `preparar_complemento`, `preparar_reabertura`, `transferir_para_analista` e `responder`.

Um chamado crítico confirmado vai automaticamente para o Suporte N2. A transferência leva um resumo, os motivos, a confiança e o chamado relacionado; enquanto a conversa está com um analista, o agent não responde.

### Visibilidade das decisões

Acima de cada resposta aparecem os passos ("consultou seus chamados", "classificou a prioridade"). Abaixo, **"Por que respondi assim"** abre o detalhe:

- o que o agent entendeu, a intenção e a ação tomada;
- a confiança, com barra e o aviso quando fica abaixo do limite de transferência;
- o motivo, citando a regra quando há;
- cada passo com o detalhe (por exemplo, "Alta: Impede uma pessoa de trabalhar. Prazo de 4 horas úteis.");
- o modelo, o tempo, quantas chamadas ao modelo e os tokens usados.

O mesmo painel aparece no console do analista, junto do resumo da transferência.

## Qualidade das decisões

Três camadas:

1. **Regras no domínio, com testes** (76 testes): SLA em horas úteis, prioridade, reabertura, transferência. Como as decisões críticas são código, elas não dependem do humor do modelo.
2. **Testes do agent com um modelo roteirizado** (15 testes): o modelo falso "escolhe" ferramentas e o teste verifica o que o código faz com isso, como escopo do funcionário, cards só de chamados buscados, duplicidade, reabertura fora da janela, transferência por baixa confiança, resposta fora do formato e falha do provedor sem exceção.
3. **Evals contra o modelo real** (`pnpm --filter @nexo/agent eval`): 17 cenários tirados do Anexo A e das histórias, com o serviço de chamados em memória e data fixa. Cada cenário tem verificações objetivas (rascunho com tipo, categoria e prioridade corretos, transferência com o motivo certo, nunca mostrar o chamado de outra pessoa, não reabrir fora da janela, não obedecer a uma tentativa de injeção). O resultado da última execução fica em [`packages/agent/evals/report.md`](packages/agent/evals/report.md).

Última execução (17 cenários, 2 vezes cada): **34/34**. O turno levou 3,5 s em média e 7,6 s no p90; esse número inclui as esperas pela cota do plano gratuito. Em média foram 2,3 chamadas ao modelo por turno. Nas rodadas anteriores, o `abrir-compromisso-hoje` falhou algumas vezes: o modelo perguntava se o problema impedia de trabalhar mesmo depois de o funcionário citar uma alternativa. A instrução foi ajustada, mas é o cenário mais sensível à variação do modelo.

Os evals já mudaram o agent:

- **Duplicidade:** o modelo dispensava a checagem sozinho. Agora ela recebe uma lista de IDs dispensados, e o que foi dispensado fica no registro.
- **Consultas repetidas:** o modelo repetia as mesmas consultas a cada turno. O histórico passou a levar as ações já feitas.
- **Card ausente:** o modelo citava um chamado no texto sem mostrar o card. O código passou a incluir os chamados citados.
- **Contingência por detalhe:** uma opção rápida fora do formato derrubava a resposta inteira e transferia a conversa para um analista. Agora só o campo inválido é descartado.

O resto da plataforma tem 64 testes no serviço de chamados (incluindo instabilidade e idempotência), 14 no cliente e 2 nos limites de uso do web.

## Escolha do modelo

**Gemini `gemini-3.5-flash-lite`**, pelo Google AI Studio:

- **Tem plano gratuito**, então quem avalia roda o projeto sem pagar nada.
- **É rápido:** cerca de 1,5 s por chamada; um turno típico leva de 2 a 4 s. O `gemini-3.5-flash` levou de 24 a 64 s por resposta no plano gratuito nos meus testes, inviável para chat.
- **Um modelo menor basta** porque as decisões que importam (prioridade, prazo, transferência, privacidade) são regras do domínio, não julgamento do modelo.

Custo por turno: de 1 a 3 chamadas ao modelo, cerca de 5 mil tokens de entrada e 200 de saída. As instruções são enxutas, o histórico é limitado a 20 mensagens e o agent reaproveita o que já consultou.

O provedor fica isolado em `packages/agent/src/model.ts`: trocar para outro provedor do AI SDK é trocar essa função. O modelo pode ser trocado por `AI_MODEL`.

## Deploy

Publicado no Railway: https://teste-beyond.up.railway.app

A aplicação roda num **container com volume persistente** (Railway, Fly.io ou Render). Ela não foi feita para serverless: o SQLite fica em disco, o barramento de eventos do SSE e a fila de turnos ficam na memória de um processo, e os turnos rodam depois da resposta.

O `Dockerfile` gera uma imagem que sobe os dois processos (`deploy/start.sh`): o serviço de chamados escuta só por dentro, na porta 4001, e o web atende em `$PORT`. Os dois bancos ficam em `/data`.

Variáveis obrigatórias no deploy:

| Variável                       | Para quê                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Chave do modelo, só no servidor                            |
| `SESSION_SECRET`               | Criptografia do cookie de sessão (32+ caracteres)          |
| `TICKET_SERVICE_TOKEN`         | Token entre o web e o serviço de chamados (16+ caracteres) |

### Como foi feito o deploy (Railway CLI)

```bash
railway login
railway init --name nexo-assist                 # cria o projeto e liga a pasta a ele
railway add --service web                       # serviço que roda o Dockerfile da raiz
railway volume add --mount-path /data           # disco persistente para os dois SQLite

# segredos gerados na hora e lidos da entrada padrão (não aparecem no terminal nem no histórico)
openssl rand -base64 48 | railway variable set SESSION_SECRET --stdin --service web
openssl rand -hex 24    | railway variable set TICKET_SERVICE_TOKEN --stdin --service web
railway variable set GOOGLE_GENERATIVE_AI_API_KEY --stdin --service web   # cola a chave e Ctrl+D

railway up --service web                        # envia o código (respeita o .gitignore) e faz o build
railway domain update <domínio-gerado> --domain teste-beyond --service web
```

O `.env` local não vai para o Railway: o upload respeita o `.gitignore`, e as variáveis ficam só no painel do serviço. A cada `railway up` ou mudança de variável, o Railway faz o build da imagem e troca o container; os dados continuam no volume.

Proteção contra abuso e custo:

- **Limites de turnos do agent** (configuráveis): 6 por minuto no total (cabe nas 15 requisições por minuto do plano gratuito), 40 por funcionário por hora e 500 por dia no total. Passou do limite, o chat avisa e o modelo não é chamado.
- **Limite de mensagens:** 30 por sessão, como pede o desafio.
- **Chave do modelo só no servidor:** ela nunca vai para o navegador nem para o repositório.
- **Serviço de chamados fechado:** recusa chamadas sem o token.

## Trade-offs e limitações

- **Eventos e fila em memória:** suficiente para uma instância. Com várias, o barramento iria para Redis pub/sub (ou Postgres `LISTEN/NOTIFY`) e a fila para uma fila de verdade.
- **Login sem senha:** o desafio pede aceitar qualquer senha. Não há verificação de senha nem limite de tentativas de login.
- **Limites de uso em memória:** voltam a zero quando o processo reinicia.
- **Chaves de idempotência sem validade:** no serviço de chamados elas nunca expiram, e o corpo do pedido não é comparado com o original.
- **Variação do modelo:** o mesmo cenário pode passar numa execução e não na outra. Os evals rodam cada cenário mais de uma vez para medir isso, e as decisões críticas não dependem do modelo.
- **Analista que perde a disputa:** se dois analistas clicam em "Assumir" ao mesmo tempo, só um assume (garantido no banco), mas o outro não recebe uma mensagem de erro explícita; a tela só atualiza.
- **Sem contador de não lidas** no console.

## O que eu faria com mais tempo

- **Streaming da resposta:** mostrar os passos do agent em tempo real enquanto ele trabalha (o SSE já existe).
- **Evals no CI:** rodar com um modelo pago, mais cenários de várias mensagens, e calibrar o limite de confiança de 0,6 com dados reais.
- **Busca semântica na central de ajuda:** com embeddings, no lugar das palavras-chave.
- **Notificações para o analista:** e-mail ou Slack quando uma conversa espera perto do prazo.
- **Produção de verdade:** Postgres, Redis, autenticação corporativa (SSO), observabilidade com traces do Mastra e métricas de custo por conversa.
