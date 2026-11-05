/**
 * Dados dos 5 setores do bunker.
 *
 * Cada setor é definido por um mapa em texto (30 x 17 tiles) mais os dados do
 * puzzle. A progressão matemática segue exatamente a tabela do GDD:
 *
 *   1 Enfermaria        adição e subtração                x = A + B
 *   2 Alojamentos       parênteses e regra de sinais      x = (A * B) - 15
 *   3 Sala de Máquinas  equação de 1º grau                2x + A = B
 *   4 Centro de Comando potência e prioridade             x = A² - (B * 4)
 *   5 Zona de Quarentena álgebra + tempo agressivo        x = (A * B) / 3 + C
 *
 * LEGENDA DO MAPA
 *   #  parede de concreto        .  piso livre
 *   C  caixote (bloqueia)        ~  escombros (bloqueia)
 *   R  poça de radiação          T  terminal CRT (interativo)
 *   D  comporta blindada         P  posição inicial do jogador
 *   1..4  objeto com pista (índice em `clues`)
 */

export const MAP_W = 30;
export const MAP_H = 17;

export const LEVELS = [
  // ------------------------------------------------------------ SETOR 1
  {
    sector: 1,
    name: 'ENFERMARIA',
    brief: 'Os geradores caíram há três dias. A comporta leste ainda responde. '
         + 'Os prontuários da enfermaria guardam os códigos de turno.',
    threatTime: 190,
    map: [
      '##############################',
      '#..........#........#........#',
      '#..P.......#...1....#...CC...#',
      '#..........#........#...CC...#',
      '#...CC.....#........#........#',
      '#...CC.......................#',
      '#..........#........#........#',
      '#....................#.......#',
      '#..####....#####.....#.......#',
      '#..#.......#...#.....#..~~...#',
      '#..#..RR...#...#........~~...#',
      '#..#..RR...#...#.............#',
      '#..#.......#####.......T.....#',
      '#..#.........................D',
      '#..#....2....#####...........#',
      '#.......................CC...#',
      '##############################',
    ],
    clues: [
      { key: 'A', value: 7, prop: 'chart',
        text: 'PRONTUÁRIO 041 — "Turno A: 7 pacientes estáveis. Código de turno = A."' },
      { key: 'B', value: 5, prop: 'chart',
        text: 'PRONTUÁRIO 088 — "Leito B: 5 doses restantes. Código de leito = B."' },
    ],
    puzzle: {
      display: 'X = A + B',
      answer: 12,
      hint: 'Some os dois valores registrados nos prontuários.',
      terminalHeader: 'COMPORTA 1-E // PROTOCOLO DE TURNO',
    },
  },

  // ------------------------------------------------------------ SETOR 2
  {
    sector: 2,
    name: 'ALOJAMENTOS',
    brief: 'Beliches revirados, armários arrombados. Alguém saiu com pressa — '
         + 'e deixou o código anotado em pedaços.',
    threatTime: 165,
    map: [
      '##############################',
      '#....#........#........#.....#',
      '#.P..#...CC...#...1....#..~~.#',
      '#....#...CC...#........#..~~.#',
      '#....#........#........#.....#',
      '#............................#',
      '#....#........#........#.....#',
      '#....#..RRR...#...CC...#.....#',
      '#....#..RRR...#...CC...#..2..#',
      '#....#........#........#.....#',
      '#............................#',
      '#....#........#........#.....#',
      '#....#...~~...#........#.....#',
      '#....#...~~...#...CC...#..T..#',
      '#....#........#...CC...#.....#',
      '#....#........#........#.....D',
      '##############################',
    ],
    clues: [
      { key: 'A', value: 5, prop: 'locker',
        text: 'BILHETE NO ARMÁRIO — "Atenção esquadrão: a variável A é igual a 5."' },
      { key: 'B', value: -2, prop: 'tape',
        text: 'FITA CASSETE — sob a etiqueta B, rabiscado a caneta: "-2".' },
    ],
    puzzle: {
      display: 'X = (A * B) - 15',
      answer: -25,
      hint: 'Resolva primeiro o que está entre parênteses. Atenção à regra de sinais.',
      terminalHeader: 'COMPORTA 2-N // ALOJAMENTO OFICIAIS',
    },
  },

  // ------------------------------------------------------------ SETOR 3
  {
    sector: 3,
    name: 'SALA DE MÁQUINAS',
    brief: 'Os geradores ainda giram no vazio. O vazamento no centro da sala '
         + 'obriga a contornar pelo perímetro.',
    threatTime: 150,
    map: [
      '##############################',
      '#............................#',
      '#.P....CC..............CC....#',
      '#......CC....RRRR......CC....#',
      '#............RRRR............#',
      '#...1........RRRR........~~..#',
      '#............RRRR........~~..#',
      '#..####......RRRR......####..#',
      '#..#.........................#',
      '#..####................####..#',
      '#............RRRR............#',
      '#....~~......RRRR............#',
      '#....~~......RRRR....2.......#',
      '#............RRRR............#',
      '#......CC..............CC..T.#',
      '#......CC..............CC....D',
      '##############################',
    ],
    clues: [
      { key: 'A', value: 4, prop: 'panel',
        text: 'PAINEL ELÉTRICO — etiqueta de calibração: "A = 4 (offset da bomba)".' },
      { key: 'B', value: 18, prop: 'chart',
        text: 'ORDEM DE SERVIÇO — "Pressão nominal B = 18 bar. Não exceder."' },
    ],
    puzzle: {
      display: '2X + A = B',
      answer: 7,
      hint: 'Isole X: subtraia A dos dois lados e depois divida por 2.',
      terminalHeader: 'COMPORTA 3-S // CONTROLE DE PRESSÃO',
    },
  },

  // ------------------------------------------------------------ SETOR 4
  {
    sector: 4,
    name: 'CENTRO DE COMANDO',
    brief: 'Mapas de guerra ainda pregados na parede. As batidas na comporta '
         + 'norte estão mais próximas do que na sala anterior.',
    threatTime: 135,
    map: [
      '##############################',
      '#......#..............#......#',
      '#..P...#....CC..CC....#...1..#',
      '#......#....CC..CC....#......#',
      '#......#..............#......#',
      '#............................#',
      '#......#..............#......#',
      '#..~~..#...RR....RR...#..CC..#',
      '#..~~..#...RR....RR...#..CC..#',
      '#......#..............#......#',
      '#............................#',
      '#......#..............#......#',
      '#..2...#....CC..CC....#......#',
      '#......#....CC..CC....#..T...#',
      '#......#..............#......#',
      '#......#..............#......D',
      '##############################',
    ],
    clues: [
      { key: 'A', value: 6, prop: 'panel',
        text: 'MAPA TÁTICO — "Esquadrão A: 6 unidades no perímetro."' },
      { key: 'B', value: 5, prop: 'tape',
        text: 'GRAVAÇÃO DE COMANDO — "...repito, setor B, nível cinco. B = 5."' },
    ],
    puzzle: {
      display: 'X = A² - (B * 4)',
      answer: 16,
      hint: 'A² significa A multiplicado por ele mesmo. Resolva a potência antes da subtração.',
      terminalHeader: 'COMPORTA 4-C // CRIPTOGRAFIA MILITAR',
    },
  },

  // ------------------------------------------------------------ SETOR 5
  {
    sector: 5,
    name: 'ZONA DE QUARENTENA — MARCO ZERO',
    brief: 'Radiação extrema. Os dutos de ventilação profunda ficam depois da '
         + 'última comporta. É a saída — ou o fim da linha.',
    threatTime: 110,
    map: [
      '##############################',
      '#.....RR..............RR.....#',
      '#..P..RR....1.........RR.....#',
      '#.....RR..............RR.....#',
      '#............................#',
      '#..####..RRRR....RRRR..####..#',
      '#..#..................C...#..#',
      '#..#...2..........3.......#..#',
      '#.............................',
      '#..#......................#..#',
      '#..#...~~........~~.......#..#',
      '#..####..RRRR....RRRR..####..#',
      '#............................#',
      '#.....RR..............RR..T..#',
      '#.....RR..............RR.....#',
      '#.....RR..............RR.....D',
      '##############################',
    ],
    clues: [
      { key: 'A', value: 9, prop: 'panel',
        text: 'MEDIDOR DE CONTENÇÃO — "Nível A: 9. Evacuação obrigatória."' },
      { key: 'B', value: 4, prop: 'body',
        text: 'CRACHÁ NA MÃO DO TÉCNICO — setor B, ala 4. B = 4.' },
      { key: 'C', value: 7, prop: 'tape',
        text: 'ÚLTIMA TRANSMISSÃO — "Duto sete. Repito: duto sete. C = 7."' },
    ],
    puzzle: {
      display: 'X = (A * B) / 3 + C',
      answer: 19,
      hint: 'Multiplique, divida e só então some C.',
      terminalHeader: 'COMPORTA 5-Q // MARCO ZERO // ÚLTIMO SELO',
    },
  },
];
