# Game Design Document — Rota de Fuga: Marco Zero

| | |
|---|---|
| **Versão** | 2.0 — alinhada ao protótipo jogável (N2, PAC IV) |
| **Curso** | Engenharia de Software — Centro Universitário Católica de Santa Catarina |
| **Disciplina** | PAC Extensionista |
| **Game design e documentação** | Ana Beatriz Adriano da Silva |
| **Desenvolvimento** | Ruan Pablo Amaral |
| **Ano** | 2026 |

Este documento descreve o jogo **como ele está implementado nesta versão**. Itens
marcados como **[planejado]** ainda não existem no jogo. A seção 19 lista o que
mudou em relação à versão 1.0, escrita no PAC III, cujos originais estão em
[`docs/pac-iii/`](pac-iii/).

## Histórico de revisões

| Versão | Etapa | Resumo |
|---|---|---|
| 1.0 | PAC III | Concepção, mecânicas, sistemas, progressão, direção de arte, áudio e vertical slice. Autoria original: Pedro Elizeu dos Santos Junior e Ana Beatriz Adriano da Silva. |
| 2.0 | PAC IV — N2 | Revisão para refletir o protótipo implementado: valores reais de tempo, radiação e penalidades; plataforma e controles definitivos; separação entre o que está pronto e o que é planejado. |

---

## 1. High concept

Rota de Fuga: Marco Zero é um jogo 2D com visão de cima, de sobrevivência furtiva e
quebra-cabeça (escape room), ambientado nas instalações militares subterrâneas de um
mundo devastado por uma guerra nuclear. O jogador é um engenheiro civil sem
habilidades de combate, cuja única arma é o raciocínio lógico-matemático: ele precisa
descobrir as variáveis escondidas no cenário e resolver as expressões que trancam as
comportas, sob a pressão de saqueadores que se aproximam e de vazamentos de radiação.

## 2. Visão geral

| Parâmetro | Detalhe |
|---|---|
| Gênero | Aventura, sobrevivência, puzzle |
| Subgênero | Escape room, furtividade |
| Plataforma | Navegador web em computador (Windows, macOS, Linux) |
| Controle | Somente teclado |
| Tecnologia | HTML5 Canvas 2D e JavaScript, sem engine |
| Público-alvo | Estudantes do Ensino Fundamental II e Médio; jogadores de puzzle |
| Classificação indicativa | Livre |
| Modelo | Gratuito, educacional, sem fins lucrativos |
| Jogadores | Um |
| Duração de uma partida | 5 a 12 minutos |
| Status | Protótipo jogável completo, com os 5 setores |

## 3. Pilares de design

- **Matemática como linguagem de sobrevivência.** As contas não aparecem como
  exercício. São a criptografia que mantém as portas fechadas, e as variáveis chegam
  ao jogador como fragmentos da história de quem estava no bunker.
- **Tensão e urgência constantes.** Sem ataque, o jogador só tem duas respostas ao
  perigo: ser rápido ou ser silencioso. O tempo corre inclusive enquanto ele calcula.
- **Atmosfera opressiva e retrofuturista.** Escuridão recortada pela lanterna,
  concreto, ferrugem e monitores de fósforo verde.

O jogo deve **evitar** a sensação de prova escolar e o foco em combate.

## 4. Core game loop

```
Explorar o setor → Coletar as variáveis → Decodificar no terminal → Escapar pela comporta
       ↑                                                                    │
       └──────────────── próximo setor: conta mais difícil, menos tempo ────┘
```

Fluxo de um setor:

1. Briefing narrativo do setor (o cronômetro ainda não corre).
2. Exploração no escuro, desviando das poças de radiação.
3. Inspeção dos objetos com pista; cada um revela uma variável.
4. Acesso ao terminal da comporta.
5. Código correto: a comporta abre e o jogador segue para a saída.
6. Código incorreto: alarme e perda de 10 segundos.
7. Cronômetro zerado ou vida zerada: derrota.

## 5. Mecânicas

### 5.1 Movimentação

- `W` `A` `S` `D` ou setas movem o engenheiro nas quatro direções; diagonais são
  permitidas e normalizadas (mesma velocidade em qualquer direção).
- Velocidade base: 118 pixels por segundo.
- Colisão com paredes, caixotes, escombros, terminais, objetos e com a comporta
  enquanto ela estiver trancada.

### 5.2 Furtividade (cobertura)

- Estar ao lado de um caixote coloca o engenheiro **em cobertura**, indicado na tela.
- Em cobertura: velocidade reduzida a **50%** e passos silenciosos.
- Efeito no sistema de ameaça: o cronômetro passa a correr a **60%** do ritmo
  normal.

### 5.3 Coleta de dados ambientais

1. Objetos interativos têm contorno verde pulsante e um indicador acima.
2. Ao chegar perto, aparece o aviso "[E] inspecionar".
3. A tecla `E` mostra o texto do objeto no rodapé (ex.: um prontuário médico).
4. A variável é registrada automaticamente no diário lateral.
5. O objeto fica apagado, indicando que já foi inspecionado.

Tipos de objeto: prontuário, fita cassete, painel elétrico, armário e restos de um
técnico (crachá).

### 5.4 Descriptografia no terminal

1. Perto do terminal, aparece "[E] acessar terminal".
2. O monitor ocupa a tela e mostra: identificação da comporta, status, a expressão de
   acesso, as variáveis já reconhecidas e as que estão pendentes.
3. O jogador digita o resultado (dígitos e, opcionalmente, o sinal `-` no início) e
   confirma com `Enter`. `Backspace` apaga; `Esc` sai sem responder.
4. **Faltando variável:** o terminal avisa quais estão pendentes, sem penalidade.
5. **Resposta correta:** som de trava hidráulica; a comporta destranca.
6. **Resposta incorreta:** alarme, tela tremendo e **perda de 10 segundos**.
7. O cronômetro **continua correndo** com o terminal aberto, no ritmo de cobertura
   (60%).

### 5.5 Contaminação por radiação

| Situação | Efeito |
|---|---|
| Sobre uma poça | Barra RAD sobe 26 pontos por segundo |
| Fora das poças | Barra RAD desce 9 pontos por segundo |
| RAD acima de 40 | Tela ganha tom verde crescente |
| RAD em 100 (saturada) | Perde 9 de vida por segundo, velocidade cai para 55%, o facho da lanterna encolhe e uma faixa de interferência percorre a tela |
| Perto de poças | O contador Geiger estala mais rápido conforme a distância diminui |

A vida começa em 100 e não se recupera dentro do setor.

## 6. Sistemas

### Sistema 1 — Terminal de criptografia

- **Objetivo:** criar barreiras matemáticas com dificuldade crescente.
- **Entradas:** variáveis coletadas no setor e o número digitado.
- **Processamento:** verifica se todas as variáveis foram coletadas e compara o
  valor digitado com a resposta da expressão do setor.
- **Saídas:** comporta destrancada, ou alarme com penalidade de tempo.

### Sistema 2 — Ameaça por tempo (saqueadores)

- **Objetivo:** pressão sonora e temporal no lugar de um inimigo em combate.
- **Entradas:** tempo decorrido no setor, cobertura e erros no terminal.
- **Processamento:** máquina de estados (seção 16).
- **Saídas:** batidas nas comportas cada vez mais frequentes, trilha acelerando,
  tom vermelho na tela e, no limite, derrota.
- Os saqueadores **não aparecem na tela** nesta versão.
  **[planejado]** Saqueadores visíveis, com rota de patrulha e detecção pelo ruído.

### Sistema 3 — Radiação

Descrito na seção 5.5. Limita as rotas e obriga o jogador a contornar o mapa.

### Sistema 4 — Diário do engenheiro

Painel fixo à direita da tela com: nome do setor, variáveis coletadas, objetivo
atual (o que falta encontrar ou resolver), estado da ameaça e controles.

## 7. Progressão

Cada setor aumenta a complexidade da expressão e reduz o tempo disponível.

| Setor | Área | Conteúdo matemático | Expressão | Tempo |
|---|---|---|---|---|
| 1 | Enfermaria | Adição | `X = A + B` | 190 s |
| 2 | Alojamentos | Parênteses e regra de sinais | `X = (A * B) - 15` | 165 s |
| 3 | Sala de Máquinas | Equação de 1º grau | `2X + A = B` | 150 s |
| 4 | Centro de Comando | Potência e prioridade das operações | `X = A² - (B * 4)` | 135 s |
| 5 | Zona de Quarentena | Multiplicação, divisão e soma | `X = (A * B) / 3 + C` | 110 s |

Os setores 1 a 4 têm duas variáveis; o setor 5 tem três.

**[planejado]** Valores sorteados dentro da faixa de cada setor, para que a resposta
mude a cada partida.

## 8. Condições de vitória e derrota

- **Vitória:** atravessar a comporta do Setor 5. A tela final mostra o tempo total, os
  códigos decifrados e as tentativas incorretas.
- **Derrota por invasão:** o cronômetro do setor zera.
- **Derrota por contaminação:** a vida zera.
- Após a derrota, `Enter` recomeça a campanha do Setor 1.

**[planejado]** Checkpoint por setor e salvamento de progresso.

## 9. Personagens

### 9.1 Engenheiro sobrevivente (protagonista)

- **Papel:** personagem controlado pelo jogador; técnico civil, sem treinamento militar.
- **Habilidades:** leitura de documentos e painéis, movimentação silenciosa, lanterna
  de capacete.
- **Comportamento:** não ataca; perde vida apenas por radiação.
- **Visual:** macacão laranja-ferrugem, capacete com lanterna, cinto de ferramentas;
  mochila visível de costas.

### 9.2 Saqueadores (antagonistas)

- **Papel:** força que avança pelos setores já atravessados.
- **Presença atual:** apenas sonora e temporal (batidas, trilha, cronômetro).
- **[planejado]** Presença física, com patrulha e reação ao ruído dos passos.

## 10. Mundo e level design

O jogo acontece inteiramente no **Bunker**, uma instalação militar subterrânea
dividida em cinco setores. Cada setor é uma sala de 30 x 17 tiles (960 x 544 pixels),
com o jogador entrando pela esquerda e a comporta de saída na borda direita.

| Setor | Ambiente e desafio de navegação |
|---|---|
| 1 — Enfermaria | Alas separadas por paredes; uma poça pequena; corredores longos entre as pistas. |
| 2 — Alojamentos | Quatro colunas de beliches ligadas por dois corredores; armários e caixotes para cobertura. |
| 3 — Sala de Máquinas | Vazamento central em duas faixas que obriga a contornar pelo perímetro. |
| 4 — Centro de Comando | Três salas ligadas por corredores, com poças entre as mesas de comando. |
| 5 — Zona de Quarentena | Radiação extrema espalhada pela sala inteira; três pistas e o menor tempo. |

Regras de construção dos mapas, verificadas automaticamente pelo script
`tools/validate-levels.mjs`:

- todo mapa tem exatamente um ponto de entrada, um terminal e uma comporta;
- toda pista, o terminal e a comporta precisam ser alcançáveis a pé a partir da
  entrada;
- a resposta declarada de cada setor precisa bater com o cálculo das variáveis.

**[planejado]** Hubs com várias salas por setor e terminais sem energia que precisam
ser reativados antes de aceitar a senha.

## 11. Narrativa

- **Contexto:** o Marco Zero é a zona de impacto inicial de um conflito atômico.
  Décadas depois, os sistemas automáticos do bunker começam a falhar e trancam os
  sobreviventes que restam.
- **Conflito:** o engenheiro precisa chegar aos dutos de ventilação profunda da Zona
  de Quarentena, a última saída conhecida, enquanto saqueadores arrombam as comportas
  que ele deixa para trás.
- **Entrega da história:** um briefing curto no início de cada setor e os textos dos
  objetos inspecionados, que contam os últimos dias de quem trabalhava ali.

## 12. Interface

- **Barra superior (dentro do jogo):** setor atual, barras de HP e RAD, pistas
  encontradas e cronômetro.
- **Painel lateral (diário):** variáveis coletadas, objetivo atual, estado da ameaça
  e controles.
- **Rodapé:** texto do objeto inspecionado e avisos.
- **Terminal CRT:** tela cheia em verde-fósforo com a expressão, as variáveis e o
  campo de digitação.
- **Telas de estado:** título, briefing por setor, derrota e vitória.

## 13. Direção de arte

Pixel art desenhada em grade de 16 x 16 e exibida em 32 x 32, com iluminação por
lanterna sobre um ambiente escuro, scanlines e vinheta de monitor CRT.

| Cor | Uso | Efeito |
|---|---|---|
| `#1A1A1A` | Paredes, tetos e sombras | Claustrofobia |
| `#39FF14` | Terminais, textos de interface e radiação | Destaque imediato para puzzles e perigos |
| `#CC5500` | Ferrugem, caixotes e uniforme do engenheiro | Abandono industrial |

Toda a arte é gerada por código na inicialização do jogo; não há arquivos de imagem.

## 14. Animações

| Animação | Elemento | Descrição | Status |
|---|---|---|---|
| Eng_Idle | Engenheiro | Parado, com a lanterna acesa | Implementado |
| Eng_Walk | Engenheiro | Ciclo de dois quadros nas quatro direções | Implementado |
| Eng_Hack | Engenheiro | Inclinado, com os braços à frente, enquanto usa o terminal | Implementado |
| Rad_Glow | Poça de radiação | Pulsação de dois quadros | Implementado |
| Door_Open | Comporta | Troca de visual de trancada (vermelha) para aberta (verde) | Implementado sem transição |
| Pista ativa | Objetos | Contorno verde pulsante | Implementado |

## 15. Áudio

Todo o áudio é sintetizado em tempo real pelo navegador; não há arquivos de som.

| Som | Quando toca |
|---|---|
| Ambientação (drone industrial) | Sempre; fica mais presente conforme a ameaça cresce |
| Pulso de tensão | No estado APROXIMANDO, acelerando de 70 até 140 batidas por minuto |
| Contador Geiger | Perto das poças; mais rápido quanto mais perto |
| Passos | A cada passo fora de cobertura |
| Clique de teclado | Ao abrir o terminal e confirmar um código |
| Coleta | Ao inspecionar uma pista |
| Alarme de erro | Código incorreto ou variáveis faltando |
| Trava hidráulica | Comporta destrancada e passagem de setor |
| Batidas nas comportas | Periódicas, cada vez mais frequentes |
| Invasão | No momento da derrota por tempo |
| Vitória | Na tela final |

## 16. Inteligência artificial — máquina de estados da ameaça

| Estado | Condição | Comportamento |
|---|---|---|
| DISTANTE | Mais de 35% do tempo restante | Batidas espaçadas; trilha calma |
| APROXIMANDO | 35% ou menos do tempo | Tela com tom vermelho pulsante; pulso de tensão acelerando; cronômetro em vermelho |
| INVASÃO | Tempo zerado | Som de invasão e derrota |

Modificadores: cobertura e terminal aberto fazem o tempo correr a 60%; cada código
incorreto retira 10 segundos.

## 17. Exemplo de jogabilidade — Setor 2, Alojamentos

O jogador entra pelo lado esquerdo, entre beliches revirados. O briefing avisa que
alguém fugiu com pressa e deixou o código anotado em pedaços. No armário de um
oficial, um bilhete: "Atenção esquadrão: a variável A é igual a 5". O diário registra
`A = 5`. Batidas ecoam de uma comporta atrás dele.

Ele segue pelo corredor colado aos caixotes — mais devagar, mas sem fazer barulho —
até uma fita cassete com "-2" rabiscado sob a etiqueta B. No terminal, a expressão é
`X = (A * B) - 15`. O cronômetro entra no vermelho. Ele calcula: 5 vezes -2 dá -10;
menos 15, -25. Digita `-25`, a trava hidráulica cede, e ele cruza a comporta para a
Sala de Máquinas.

## 18. Tema e aspecto sério

- **Tema:** matemática aplicada — expressões numéricas, ordem das operações, regra de
  sinais, potência e equação de 1º grau.
- **Integração com a mecânica:** a conta é a única forma de avançar; errar tem
  consequência direta no jogo (perder tempo), e não uma nota.
- **Aprendizagem pela experiência:** o jogador aprende a respeitar a ordem das
  operações e a regra de sinais porque errar o deixa mais perto de ser alcançado.
- **[planejado]** Dicas progressivas após erros sucessivos e um relatório final por
  tipo de erro, para que o professor saiba quais operações a turma domina menos.

## 19. O que mudou em relação à versão 1.0 (PAC III)

| Tema | Versão 1.0 | Versão 2.0 (implementado) |
|---|---|---|
| Plataforma | PC / Web, teclado e mouse | Web em computador, somente teclado |
| Erro no terminal | Alerta os saqueadores | Alarme e perda de 10 segundos |
| Cobertura | Velocidade -50% e ruído zero | Velocidade -50%; o cronômetro corre a 60% |
| Radiação saturada | Velocidade pela metade e visão distorcida | Velocidade a 55%, perda de 9 de vida por segundo, lanterna menor e interferência na tela |
| Equação do Setor 3 | Exemplo `3x + 6 = B * 5` | `2X + A = B`, conforme a tabela de progressão |
| Saqueadores | Movem-se por rotas de som | Apenas cronômetro e som; presença física planejada |
| Diário | Notas na parte inferior do visor | Painel lateral fixo |
| Arte e áudio | Assets externos, com fontes a definir | Arte e áudio gerados por código, sem dependência de terceiros |
| Tempo por setor | "Tempo limite suave" | Valores definidos: 190, 165, 150, 135 e 110 segundos |
| Terminais sem energia | Previstos no one page | Não implementados |
