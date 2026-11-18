# Protótipo: referência visual

Descrição do protótipo do desafio, feita no Pencil (`nexo.pen`, que fica só na máquina local e não é publicado).
Os dados que aparecem nas telas são ilustrativos. Este documento é a referência usada para construir a interface.

## Design tokens

Extraídos das variáveis do arquivo `.pen`.

### Cores

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#FFFFFF` | Fundo das telas |
| `desk` | `#F6F7F9` | Rail do console, busca, item selecionado |
| `ink` | `#1B2431` | Texto principal, painel escuro do login |
| `ink-2` | `#3D4656` | Texto secundário |
| `ink-3` | `#5B6472` | Ícones, texto terciário |
| `rule` | `#E6E8EC` | Divisórias |
| `cta` | `#0062C4` | Badge de contagem no console |
| `primary` / `-hover` / `-soft` / `-text` | `#0285F7` / `#0071D6` / `#0285F712` / `#0069C7` | Ações, item de navegação ativo, avatar |
| `success` / `-soft` / `-text` | `#00BD6C` / `#00BD6C14` / `#00804A` | "Assistente online", resolvido |
| `warning` / `-soft` / `-text` | `#F5A500` / `#F5A50018` / `#946300` | "Aguardando atendente", prioridade média |
| `danger` / `-soft` / `-text` | `#EE343B` / `#EE343B12` / `#C4161D` | Prazo vencido, "Encerrar atendimento" |
| `violet` / `-soft` / `-text` | `#A37AFF` / `#A37AFF16` / `#6B3FE0` | Marcação de IA / agent |
| Fundo da conversa (console) | `#EEF1F5` | Área de mensagens do console |

Também existem tokens neutros alternativos (`bg`, `surface`, `card`, `fg`, `muted`, `subtle`, `border`) que não aparecem nas telas principais.

### Tipografia

- **UI:** `Schibsted Grotesk`, usada em quase todo o texto (cerca de 340 elementos).
- **Display:** `Newsreader` (serifada), usada só nos títulos de destaque (por exemplo, a headline do login).
- `Geist`, `Geist Mono` e `IBM Plex Mono` estão definidas, mas não são usadas nas telas.
- Tamanhos mais comuns: 12,5 / 13,5 / 14,5 / 15,5 px. Títulos: 20, 24, 34, 40 e 54 px.

### Raios

`radius-sm` 6 · `radius-md` 10 · `radius-lg` 14. Botões e itens de navegação usam 8, itens de lista 12, e pílulas e avatares 999.

## Telas

Todas são desktop, 1440×900.

### 1. Identificação (login)

Duas colunas:

- **Showcase** (800 px, fundo `ink`): marca "Nexo Assist · Service desk de TI da Nexo", headline *"Seu problema de TI, resolvido em uma conversa."* e um preview de conversa: o usuário diz "Meu notebook não conecta na VPN. Erro 809."; acima da resposta aparecem os chips *consultou seus chamados · criou um chamado*; depois a resposta e o card `INC-20517 · Rede e VPN · Alta · em até 4 h`. Embaixo, três métricas: **8 s** primeira resposta, **72%** resolvidos sem fila, **6** analistas online.
- **Sign In:** no topo, "Problema para entrar? Ligue no ramal 4000". No centro, o formulário (380 px) "Entrar", com os campos *E-mail corporativo* e *Senha*, os links "Esqueci minha senha" e "Manter conectado neste computador" e o botão **Entrar**. No rodapé, "© 2026 Nexo · Privacidade e uso de dados".

### Layout comum do funcionário (telas 2, 3 e 6)

- **Sidebar** (232 px): logo; navegação *Atendimento* / *Meu perfil* (o item ativo usa `primary-soft`, raio 8); no rodapé, o usuário (avatar com iniciais, nome e e-mail) e o botão **Sair**.
- **Main:** top bar de 64 px com o breadcrumb "Service desk de TI › Atendimento" e a pílula **"Assistente online"** (`success-soft`). Abaixo, uma coluna única de chat.
- **Composer:** "Escreva para o Nexo…", botão **Enviar** e o contador **"N/30 mensagens nesta sessão"**.

### 2. Chat: novo chamado

1. O usuário escreve: "Meu notebook não conecta na VPN desde ontem. Aparece o erro 809."
2. **Chips de ação** acima da resposta: *consultou seus chamados* · *buscou na central de ajuda*.
3. Resposta: o agent informa que não há chamado aberto sobre VPN e que o artigo vale só para Windows 10, mas o dele é Windows 11. Por isso, vai abrir um chamado.
4. **Pergunta com opções rápidas numeradas:** "Quem está sendo afetado?", com as opções 1 Só eu · 2 Minha equipe · 3 Toda a empresa · 4 Não sei.
5. O usuário responde: "Só eu. Tenho reunião com um cliente às 14h…"
6. Chips: *classificou a prioridade* · *consultou o SLA* · *montou o rascunho*. Depois vem a justificativa: "Coloquei prioridade alta por causa da reunião…"
7. **Card de rascunho:** "Novo chamado · Rascunho D-381 · *Aguardando confirmação*", com título, descrição, **Categoria** Rede e VPN, **Prioridade** Alta "· resposta até 13:43" (o prazo já calculado), **Afetados** Somente você e os botões **Confirmar** (atalho ⌘↵) · Editar · Cancelar.
8. Rodapé: "18/30 mensagens nesta sessão".

### 3. Chat: consulta e transferência

1. O usuário pergunta: "Qual o status do meu chamado?"
2. Chip *consultou seus chamados*, e o agent pergunta: "Você tem 3 chamados abertos. Sobre qual deles quer saber?"
3. **Lista de seleção** de chamados, cada um com ID, título, status (badge) e data:
   - `INC-20311` Notebook lento após atualização · Aguardando analista · 16 out
   - `INC-20298` Acesso à pasta Financeiro no SharePoint · Em andamento · 14 out
   - `REQ-10442` Segundo monitor para home office · Aprovado · 09 out
4. A escolha aparece como mensagem do usuário: "INC-20311 · Notebook lento após atualização".
5. Chips *consultou o INC-20311* · *calculou o prazo*, e o **card de chamado** com título, descrição, Categoria "Hardware › Notebook" (com subcategoria), Prioridade Média, Aberto em, Última atualização "há 5 dias **· prazo vencido**" (em vermelho).
6. O agent explica o atraso (5 dias contra um prazo de 3 dias úteis) e oferece um analista, com as ações rápidas **Falar com um analista** · Adicionar informação · Não, obrigado.

### 6. Meu perfil (extra; não citada no PDF)

Nome, e-mail corporativo ("Gerenciado pela TI"), senha ("Alterada há 42 dias") e **Redefinir senha** ("Enviaremos um link de redefinição para…").

### Layout comum do console do analista (telas 4 e 5)

Quatro colunas:

- **Rail** (64 px, `desk`): logo, ícone *Conversas* com badge de contagem (`cta`) e avatar do analista com indicador online.
- **Lista de conversas** (380 px): título "Conversas" + status "Disponível"; busca "Pesquisar conversa ou chamado"; filtros **Todas · Para você (3) · Com o agent (9) · Minhas (1)**. Cada item mostra avatar, nome, hora, prévia da última mensagem, contador de não lidas e uma **linha de status**:
  - *Transferida · INC-20311*
  - *Transferida · contato em 25 min*
  - **Agent pediu ajuda · confiança 41%** (o agent sem segurança)
  - *Agent atendendo* (com "digitando…")
  - *Resolvida pelo agent*
- **Conversa** (flexível, fundo `#EEF1F5`): header com avatar, nome, "online · Financeiro · INC-20311" e uma pílula de modo. As mensagens têm três autores: cliente, **Nexo Assist** (com marcação "IA") e analista humano. Há linhas de **sistema** ("Transferida para Suporte N2 · 10:05").
- **Chamados do funcionário** (340 px): "Chamados da Ana · 3 abertos · 2 encerrados"; a seção **Desta conversa** (o chamado ligado, com status e o evento mais recente); a seção **Outros chamados** (abertos e resolvidos com data); e o botão "Ver todos os chamados".

### 4. Console: conversa transferida

- A pílula de modo diz **"Aguardando atendente"** (`warning-soft`).
- No fim do histórico: "Transferida para Suporte N2 · 10:05".
- Barra de takeover: "Ana espera um atendente · **Agent pausado · até 12:05**", com os botões **Devolver ao agent** e **Assumir atendimento**. O composer fica **bloqueado** ("Assuma o atendimento para responder").

### 5. Console: analista atendendo

- No header: **Devolver ao agent** e **Encerrar atendimento** (`danger-soft`).
- Linha de sistema: "Rafael Lima assumiu · agent pausado · 10:12".
- Mensagens do analista identificadas pelo nome e pela equipe ("Rafael Lima · Suporte N2").
- O composer fica liberado.
- No painel da direita, o chamado muda para **"Em atendimento · Assumido por Rafael Lima"**.

## Responsividade

O protótipo só tem telas desktop de 1440×900. A implementação vai ser **responsiva**, com os pontos de quebra padrão do Tailwind (`md` = 768 px, `lg` = 1024 px, `xl` = 1280 px) e **mobile first**: o estilo base é o do celular, e as colunas vão aparecendo conforme a tela cresce. No celular, a margem lateral é de 16 px e não pode haver rolagem horizontal.

| Tela | Celular (< 768) | Tablet (768–1279) | Desktop (≥ 1280) |
|---|---|---|---|
| **Login** | Só o formulário. O showcase vira uma faixa curta acima, com a marca e a headline, sem o preview e sem as métricas | Só o formulário, com o showcase reduzido no topo | Duas colunas, como no protótipo |
| **Chat do funcionário** | A sidebar vira um menu (ícone ☰ abrindo um *drawer*). O chat ocupa a tela inteira e o composer fica fixo no rodapé. Os cards e o rascunho ocupam 100% da largura | Sidebar recolhida, só com ícones (64 px) | Sidebar de 232 px |
| **Detalhe das decisões** | Abre como *bottom sheet* | Abre como *drawer* lateral | Painel lateral ou expansão inline |
| **Console do analista** | Navegação em pilha: lista → conversa → chamados (botão "voltar"); os chamados abrem como *sheet* | Lista + conversa; o painel de chamados abre como *drawer* | Quatro colunas, como no protótipo |

Outras regras:
- **Alvos de toque** de no mínimo 44 px no celular (opções rápidas, botões do rascunho).
- **Opções rápidas** quebram linha (`flex-wrap`); nunca rolam na horizontal.
- O atalho **⌘↵ / Ctrl+Enter** do rascunho só aparece onde há teclado físico, ou seja, a partir de `lg`.
- Em telas maiores que 1440 px, o conteúdo do chat fica com largura máxima e centralizado.

## Observações para a implementação

- **Detalhe das decisões:** o protótipo mostra só os chips de ação. O detalhe (o que o agent entendeu, a ação, a confiança e o porquê), que o PDF chama de "a parte mais importante", fica por nossa conta: chips expansíveis e/ou um painel lateral.
- **Confiança** é um dado de primeira classe: aparece no console ("confiança 41%") e é um motivo de transferência.
- **Prazos com horário real** ("resposta até 13:43", "até 2 h úteis", "Agent pausado · até 12:05"): o cálculo de horas úteis fica no pacote `domain`.
- **Subcategoria** ("Hardware › Notebook") não está no Anexo A. Ela entra como campo opcional.
- **Status de chamado** que aparecem nas telas: Aguardando analista, Em andamento, Aprovado, Em atendimento, Resolvido.
- **Status de conversa** no console: com o agent, aguardando atendente (transferida), agent pediu ajuda, com analista, resolvida pelo agent, encerrada.
