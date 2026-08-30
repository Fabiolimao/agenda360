# Inventário de Arquitetura e Regras de Negócio - Agenda 360

Este documento consolida o mapeamento técnico e estrutural do estado atual do projeto **Agenda 360**, servindo como documento de referência e inventário arquitetónico para a próxima fase de desenvolvimento.

---

1. Esquema do Banco de Dados PostgreSQL
O modelo relacional do sistema está estruturado em torno de entidades corporativas, operacionais e de controlo de acessos, garantindo o isolamento multi-tenant por agência. Nota arquitetural: Todo o código, estruturação de tabelas e queries devem utilizar estritamente a sintaxe e os tipos de dados nativos do PostgreSQL (ex: TIMESTAMPTZ, UUID, etc.).

| Tabela | Campos Principais | Descrição e Relacionamentos |
| --- | --- | --- |
| **clientes** | `id`, `agencia_id`, `nome_empresa`, `nif`, `nome_responsavel`, `telefone`, `email`, `observacoes` | Representa os Grupos / Sedes corporativas clientes. Relaciona-se com 1 ou mais `unidades`. |
| **unidades** | `id`, `cliente_id`, `nome_unidade`, `contato_nome`, `telefone`, `email`, `rua`, `cidade`, `latitude`, `longitude`, `exige_validacao`, `funcoes_frequentes` | Representa os locais físicos de prestação de serviços (hotéis, filiais, estaleiros). Pertence a um `cliente`. |
| **funcionarios** | `id`, `agencia_id`, `nome_completo`, `email`, `telemovel`, `nif`, `nacionalidade`, `idiomas`, `cidade`, `status`, `senha`, `funcoes_habilitadas`, `disponibilidade`, `consentimento_gps` | Registo completo dos trabalhadores temporários, incluindo matrizes de disponibilidade em formato JSON e histórico de consentimento GPS. |
| **funcoes** | `id`, `agencia_id`, `nome` | Catálogo centralizado de cargos/funções operacionais habilitadas na agência. |
| **solicitacoes** | `id`, `agencia_id`, `unidade_id`, `funcao`, `quantidade`, `alocados`, `data_pedido`, `data_inicio`, `hora_entrada`, `hora_saida`, `tem_pausa`, `minutos_pausa`, `status` | Central de pedidos B2B submetidos pelas unidades para suprir necessidades de equipa extra. |
| **escalas** | `id`, `agencia_id`, `unidade_id`, `funcionario_id`, `funcao`, `data_inicio`, `data_fim`, `hora_entrada`, `hora_saida`, `tem_pausa`, `minutos_pausa`, `status_turno`, `checkin_real`, `checkout_real`, `obs_cliente`, `solicitacao_id` | Registo de turnos, com suporte a vagas abertas (`A_DEFINIR`), controlo de pausas e registos reais de ponto (check-in/check-out). |
| **assinaturas** | `id`, `agencia_id`, `funcionario_id`, `mes`, `ano`, `status`, `carimbo_digital` | Registo de fecho mensal e validação criptográfica (assinatura digital) de folhas de ponto por trabalhador. |
| **gestores** | `id`, `agencia_id`, `unidade_id`, `nome_gestor`, `email`, `senha`, `status`, `tipo_perfil` | Controlo de acessos diferenciado entre Gestores Master (Corporativos/Operacionais) e Gestores Locais (Clientes). |

---

## 2. Mapeamento de Rotas e Endpoints Node.js

Abaixo encontram-se listados os endpoints implementados e funcionais na API:

### Autenticação e Sessão

* `GET /api/me`: Retorna os dados do utilizador autenticado, perfil e nível de GPS.
* `POST /api/logout`: Invalida a sessão ativa.
* `POST /api/gestores/mudar-senha-pessoal`: Altera a senha provisória do primeiro acesso.

### Agências e Configurações Globais

* `POST /api/agencias/toggle-whatsapp`: Alterna o estado global do botão de ofertas WhatsApp.
* `POST /api/agencias/mudar-gps`: Atualiza o nível de rigor de geolocalização da agência.
* `PUT /api/agencias/:id/senha`: Altera a senha Master da agência.

### Gestão de Funcionários

* `GET /api/funcionarios/agencia/:id`: Lista os trabalhadores afetos à agência.
* `POST /api/funcionarios`: Regista um novo funcionário (ou importação via lote).
* `PUT /api/funcionarios/:id`: Atualiza dados, disponibilidades e habilitações de um funcionário.
* `DELETE /api/funcionarios/:id`: Remove o registo de um funcionário.
* `POST /api/funcionarios/status`: Altera o estado (ativo/inativo) do trabalhador.
* `GET /api/assinaturas/funcionario/:id`: Consulta folhas assinadas por trabalhador.

### Clientes e Unidades

* `GET /api/clientes/agencia/:id` / `POST /api/clientes` / `PUT /api/clientes/:id` / `DELETE /api/clientes/:id`: Gestão de Grupos/Sedes.
* `GET /api/unidades/agencia/:id` / `POST /api/unidades` / `PUT /api/unidades/:id` / `DELETE /api/unidades/:id`: Gestão de Unidades/Hotéis.

### Funções Operacionais

* `GET /api/funcoes/agencia/:id`: Lista o catálogo de funções.
* `POST /api/funcoes`: Regista uma nova função na base de dados.

### Solicitações B2B (Extras)

* `GET /api/solicitacoes/agencia/:id`: Lista os pedidos de extras.
* `POST /api/solicitacoes`: Submete novos pedidos de equipa.
* `DELETE /api/solicitacoes/:id`: Cancela/apaga um pedido.
* `GET /api/solicitacoes/:id/trabalhadores`: Lista a equipa alocada a um pedido específico.
* `PUT /api/solicitacoes/:id/status`: Atualiza o estado de atendimento da solicitação.

### Escalas e Controlo de Ponto

* `GET /api/escalas/agencia/:id`: Lista todas as escalas/turnos.
* `POST /api/escalas`: Cria turnos individuais, múltiplos ou vagas abertas (`A_DEFINIR`).
* `PUT /api/escalas/:id`: Executa acertos manuais de turnos, estados ou registos de ponto.
* `DELETE /api/escalas/:id`: Remove um turno não iniciado.
* `PUT /api/escalas/:id/validar-cliente`: Valida o turno sob perspetiva do cliente local.

### Relatórios e Assinaturas Digitais

* `GET /api/relatorios/agencia/:id`: Extração avançada de dados relacionais de assiduidade e horas.
* `GET /api/assinaturas/agencia/:id`: Lista o estado das assinaturas digitais mensais.
* `POST /api/assinaturas/solicitar`: Solicita validação de fecho de mês ao trabalhador.
* `DELETE /api/assinaturas/:id`: Anula um pedido de assinatura.

---

## 3. Regras de Negócio Inflexíveis

O sistema obedece estritamente aos seguintes parâmetros arquitetónicos e normativos:

> * **Independência Operacional de Métricas:** O cálculo de métricas operacionais deve avaliar o tempo individual e a quantidade de saída de cada operador de forma estritamente independente, sendo proibida a divisão proporcional de totais combinados.
> * **Lógica Cumulativa de Erros:** A lógica cumulativa dos dashboards deve tratar a subcategoria crítica de rastreio de erros exclusivamente como um subconjunto derivado, nunca como um valor aditivo separado.
> * **Padronização de Nomenclaturas:** Utilização estrita de nomenclaturas padronizadas, adotando 'unidades' e 'clientes' em vez de terminologias setorizadas.
> * **Conformidade Legal e Autenticação por Local de Trabalho:** Garantir que registos e folhas de ponto sejam separados e autenticados por local de trabalho individual (unidade/cliente), assegurando o alinhamento rigoroso com as obrigações laborais.
> 
>