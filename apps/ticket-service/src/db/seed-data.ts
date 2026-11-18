import type { employees, kbArticles, ticketUpdates, tickets } from "./schema.ts";

type NewEmployee = typeof employees.$inferInsert;
type NewTicket = typeof tickets.$inferInsert;
type NewTicketUpdate = typeof ticketUpdates.$inferInsert;
type NewKbArticle = typeof kbArticles.$inferInsert;

export interface SeedData {
  employees: NewEmployee[];
  tickets: NewTicket[];
  ticketUpdates: NewTicketUpdate[];
  kbArticles: NewKbArticle[];
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Datas relativas a `now`, para que as situações (vencido, reabrível...) valham em qualquer dia.
export function buildSeedData(now: Date): SeedData {
  const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR_MS);
  const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS);

  const employees: NewEmployee[] = [
    {
      id: "emp-ana",
      name: "Ana Souza",
      email: "ana.souza@nexo.com.br",
      department: "Financeiro",
      role: "funcionario",
    },
    {
      id: "emp-carla",
      name: "Carla Mendes",
      email: "carla.mendes@nexo.com.br",
      department: "Comercial",
      role: "funcionario",
    },
    {
      id: "emp-bruno",
      name: "Bruno Tavares",
      email: "bruno.tavares@nexo.com.br",
      department: "Logística",
      role: "funcionario",
    },
    {
      id: "emp-diego",
      name: "Diego Ramos",
      email: "diego.ramos@nexo.com.br",
      department: "Marketing",
      role: "funcionario",
    },
    {
      id: "emp-elisa",
      name: "Elisa Prado",
      email: "elisa.prado@nexo.com.br",
      department: "Recursos Humanos",
      role: "funcionario",
    },
    {
      id: "emp-fabio",
      name: "Fábio Nunes",
      email: "fabio.nunes@nexo.com.br",
      department: "Jurídico",
      role: "funcionario",
    },
    {
      id: "emp-rafael",
      name: "Rafael Lima",
      email: "rafael.lima@nexo.com.br",
      department: "TI",
      role: "analista",
      supportTeam: "Suporte N2",
    },
    {
      id: "emp-juliana",
      name: "Juliana Costa",
      email: "juliana.costa@nexo.com.br",
      department: "TI",
      role: "analista",
      supportTeam: "Suporte N1",
    },
  ];

  const tickets: NewTicket[] = [
    // Ana: vencido (média, 6 dias sem resposta > 3 dias úteis)
    {
      id: "INC-20311",
      type: "INC",
      title: "Notebook lento após atualização do Windows",
      description:
        "Lentidão geral desde a última atualização do Windows. Reiniciar e rodar o diagnóstico da central não resolveu.",
      category: "hardware",
      subcategory: "Notebook",
      priority: "media",
      status: "aguardando_analista",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(6),
      lastSupportUpdateAt: daysAgo(6),
    },
    {
      id: "INC-20298",
      type: "INC",
      title: "Acesso à pasta Financeiro no SharePoint",
      description:
        "Não consigo abrir a pasta Financeiro/Fechamento no SharePoint. Aparece 'acesso negado'. Consigo trabalhar com cópias enviadas por e-mail.",
      category: "acesso",
      priority: "media",
      status: "em_andamento",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(3),
      lastSupportUpdateAt: daysAgo(1),
    },
    {
      id: "REQ-10442",
      type: "REQ",
      title: "Segundo monitor para home office",
      description: "Solicito um segundo monitor para o home office.",
      category: "hardware",
      subcategory: "Periféricos",
      priority: "baixa",
      status: "aprovado",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(7),
      lastSupportUpdateAt: daysAgo(3),
    },
    // Ana: resolvido há 4 dias (pode reabrir)
    {
      id: "INC-20150",
      type: "INC",
      title: "Senha do SAP bloqueada",
      description: "A senha do SAP foi bloqueada depois de algumas tentativas.",
      category: "acesso",
      subcategory: "SAP",
      priority: "media",
      status: "resolvido",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(5),
      lastSupportUpdateAt: daysAgo(4),
      resolvedAt: daysAgo(4),
    },
    // Ana: resolvido há mais de 7 dias (não pode reabrir)
    {
      id: "INC-19877",
      type: "INC",
      title: "Outlook não sincroniza no celular",
      description: "Os e-mails pararam de chegar no aplicativo do Outlook no celular.",
      category: "email",
      priority: "media",
      status: "resolvido",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(22),
      lastSupportUpdateAt: daysAgo(20),
      resolvedAt: daysAgo(20),
    },
    {
      id: "INC-19410",
      type: "INC",
      title: "Troca de senha da rede",
      description: "A senha da rede expirou e não consigo trocá-la pelo portal.",
      category: "acesso",
      priority: "alta",
      status: "resolvido",
      affected: "somente_eu",
      requesterId: "emp-ana",
      createdAt: daysAgo(130),
      lastSupportUpdateAt: daysAgo(130),
      resolvedAt: daysAgo(130),
    },
    {
      id: "REQ-10460",
      type: "REQ",
      title: "Acesso ao módulo de vendas do SAP",
      description:
        "Preciso de acesso ao módulo SD do SAP para lançar pedidos de um cliente ainda hoje.",
      category: "acesso",
      subcategory: "SAP",
      priority: "alta",
      status: "aguardando_analista",
      affected: "somente_eu",
      requesterId: "emp-carla",
      createdAt: hoursAgo(2),
      lastSupportUpdateAt: hoursAgo(2),
    },
    // Bruno: chamado de VPN aberto, que não pode aparecer para a Ana (privacidade)
    {
      id: "INC-20335",
      type: "INC",
      title: "VPN cai a cada 10 minutos",
      description: "A VPN conecta, mas cai a cada 10 minutos. Estou em home office.",
      category: "rede_vpn",
      priority: "alta",
      status: "aguardando_analista",
      affected: "somente_eu",
      requesterId: "emp-bruno",
      createdAt: hoursAgo(3),
      lastSupportUpdateAt: hoursAgo(3),
    },
    {
      id: "INC-20330",
      type: "INC",
      title: "Impressora do 3º andar não imprime",
      description:
        "A impressora do 3º andar recebe os trabalhos, mas não imprime. Estamos usando a do 2º andar.",
      category: "hardware",
      subcategory: "Impressora",
      priority: "media",
      status: "em_andamento",
      affected: "equipe",
      requesterId: "emp-bruno",
      createdAt: daysAgo(2),
      lastSupportUpdateAt: daysAgo(1),
    },
    {
      id: "REQ-10455",
      type: "REQ",
      title: "Instalação do Figma",
      description: "Solicito a instalação do Figma para criar peças da campanha de fim de ano.",
      category: "software",
      priority: "baixa",
      status: "aguardando_analista",
      affected: "somente_eu",
      requesterId: "emp-diego",
      createdAt: daysAgo(2),
      lastSupportUpdateAt: daysAgo(2),
    },
    {
      id: "INC-20322",
      type: "INC",
      title: "Outlook não abre",
      description: "O Outlook fecha sozinho logo depois de abrir.",
      category: "email",
      priority: "alta",
      status: "resolvido",
      affected: "somente_eu",
      requesterId: "emp-elisa",
      createdAt: daysAgo(3),
      lastSupportUpdateAt: daysAgo(2),
      resolvedAt: daysAgo(2),
    },
  ];

  const ticketUpdates: NewTicketUpdate[] = [
    {
      ticketId: "INC-20298",
      at: daysAgo(1),
      author: "analista",
      message: "Pedi a liberação ao gestor da pasta. Assim que aprovar, o acesso é concedido.",
    },
    {
      ticketId: "REQ-10442",
      at: daysAgo(3),
      author: "analista",
      message: "Pedido aprovado pelo gestor. O monitor será enviado ao seu endereço.",
    },
    {
      ticketId: "INC-20150",
      at: daysAgo(4),
      author: "analista",
      message: "Senha desbloqueada. Use a senha temporária enviada por e-mail no próximo acesso.",
    },
    {
      ticketId: "INC-19877",
      at: daysAgo(20),
      author: "analista",
      message: "Conta reconfigurada no aplicativo do Outlook. Sincronização normalizada.",
    },
    {
      ticketId: "INC-19410",
      at: daysAgo(130),
      author: "analista",
      message: "Senha redefinida.",
    },
    {
      ticketId: "INC-20330",
      at: daysAgo(1),
      author: "analista",
      message: "Técnico agendado para verificar a impressora amanhã de manhã.",
    },
    {
      ticketId: "INC-20322",
      at: daysAgo(2),
      author: "analista",
      message: "Perfil do Outlook recriado. Problema resolvido.",
    },
  ];

  const kbArticles: NewKbArticle[] = [
    {
      id: "KB-001",
      title: "VPN com erro 809",
      body: "Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.",
      category: "rede_vpn",
      keywords: "vpn,809,erro 809,conexão,windows 10,home office",
    },
    {
      id: "KB-002",
      title: "Horário do service desk",
      body: "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.",
      category: "outros",
      keywords: "horário,atendimento,plantão,service desk,expediente",
    },
    {
      id: "KB-003",
      title: "Como redefinir a senha da rede",
      body: "Acesse senha.nexo.com.br, informe seu e-mail corporativo e siga o código enviado por SMS. Se não tiver acesso ao celular cadastrado, ligue no ramal 4000.",
      category: "acesso",
      keywords: "senha,rede,esqueci,expirada,redefinir,trocar senha",
    },
    {
      id: "KB-004",
      title: "Senha do SAP bloqueada",
      body: "O SAP bloqueia a senha após 3 tentativas erradas. O desbloqueio é automático depois de 30 minutos. Se precisar antes, abra um chamado.",
      category: "acesso",
      keywords: "sap,senha,bloqueada,bloqueio,tentativas",
    },
    {
      id: "KB-005",
      title: "Wi-Fi para visitantes",
      body: "Visitantes usam a rede Nexo-Visitante. A senha muda toda segunda-feira e fica com a recepção de cada andar.",
      category: "rede_vpn",
      keywords: "wi-fi,wifi,visitante,internet,rede sem fio",
    },
    {
      id: "KB-006",
      title: "Outlook não sincroniza no celular",
      body: "Remova a conta do aplicativo do Outlook e adicione de novo com seu e-mail corporativo. Aprove o login no aplicativo autenticador quando solicitado.",
      category: "email",
      keywords: "outlook,celular,sincronizar,e-mail,mobile,autenticador",
    },
    {
      id: "KB-007",
      title: "Notebook lento após atualização do Windows",
      body: "Deixe o notebook ligado na tomada por 1 hora para a atualização terminar, reinicie e rode o diagnóstico do portal de softwares. Se a lentidão continuar, abra um chamado.",
      category: "hardware",
      keywords: "notebook,lento,lentidão,atualização,windows,desempenho",
    },
    {
      id: "KB-008",
      title: "Como solicitar a instalação de um software",
      body: "Softwares homologados podem ser instalados direto pelo portal de softwares. Para os demais, abra uma requisição informando o software e o motivo; é preciso aprovação do gestor.",
      category: "software",
      keywords: "software,instalar,instalação,programa,licença,portal de softwares",
    },
    {
      id: "KB-009",
      title: "Como adicionar uma impressora de rede",
      body: "Em Configurações > Impressoras, clique em Adicionar e escolha a impressora do seu andar (ex.: IMP-3ANDAR). Se ela não aparecer, conecte-se à rede cabeada ou à VPN.",
      category: "hardware",
      keywords: "impressora,imprimir,adicionar impressora,rede",
    },
  ];

  return { employees, tickets, ticketUpdates, kbArticles };
}
