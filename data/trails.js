// Dados de trilhas para o site Trekko Brasil
// Cada objeto descreve uma trilha com informações detalhadas
// para uso nas páginas de listagem e de detalhes.

window.trailsData = [
  {
    id: 'pico-bandeira',
    name: 'Trilha do Pico da Bandeira',
    state: 'MG/ES',
    city: 'Alto Caparaó',
    park: 'Parque Nacional do Caparaó',
    biome: 'Mata Atlântica',
    distance: 9, // quilómetros
    elevationGain: 1299, // metros de elevação acumulada
    duration: 8, // horas estimadas
    difficulty: 'difícil',
    waterPoints: true,
    campingPoints: true,
    requiresGuide: false,
    entryFee: 0,
    image: 'images/pico-bandeira.jpg',
    gallery: ['images/pico-bandeira.jpg'],
    longDescription:
      'Uma das travessias mais emblemáticas do país, a subida ao Pico da Bandeira conduz o trekker por florestas de araucárias, campos de altitude e cumes graníticos que parecem tocar o céu. A jornada exige planejamento e preparo físico, mas recompensa com nasceres do sol inesquecíveis e o encontro com a cultura local de Alto Caparaó.',
    description:
      'A subida ao Pico da Bandeira, o terceiro ponto mais alto do Brasil, oferece vistas panorâmicas incríveis e exige preparo físico.',
    rating: 4.8,
    campingFee: 35,
    parkingAvailable: true,
    parkingFee: 20,
    airport: {
      name: 'Aeroporto Regional da Zona da Mata',
      city: 'Goianá (MG)',
      distanceKm: 180
    },
    busStation: {
      name: 'Rodoviária de Alto Caparaó',
      city: 'Alto Caparaó (MG)',
      distanceKm: 6
    },
    coordinates: { lat: -20.4323, lng: -41.7903 },
    reviews: [
      {
        user: 'Mariana Souza',
        date: '12 de janeiro de 2025',
        rating: 5,
        text: 'Subida intensa mas totalmente recompensadora. Acampei no Terreirão e vi o nascer do sol mais bonito da minha vida!'
      },
      {
        user: 'Rafael Lima',
        date: '2 de dezembro de 2024',
        rating: 4.8,
        text: 'Estrutura do parque é simples, mas a trilha é bem sinalizada. Usei os pontos de água e estavam limpos.'
      },
      {
        user: 'Letícia Fernandes',
        date: '18 de agosto de 2024',
        rating: 4.9,
        text: 'Fiz com guia certificado e ajudou muito na logística. O frio no topo é intenso, vá preparado!'
      }
    ]
  },
  {
    id: 'pedra-bonita',
    name: 'Pedra Bonita',
    state: 'RJ',
    city: 'Rio de Janeiro',
    park: 'Parque Nacional da Tijuca',
    biome: 'Mata Atlântica',
    distance: 3,
    elevationGain: 200,
    duration: 2,
    difficulty: 'moderada',
    waterPoints: false,
    campingPoints: false,
    requiresGuide: false,
    entryFee: 0,
    image: 'images/pedra-bonita.jpg',
    gallery: ['images/pedra-bonita.jpg'],
    longDescription:
      'Ideal para quem busca uma experiência inesquecível sem grandes dificuldades técnicas, a trilha da Pedra Bonita percorre a Mata Atlântica carioca com trechos sombreados e mirantes naturais. No topo, o visual de 360° abraça o litoral do Rio e a Pedra da Gávea, tornando-se perfeito para um nascer do sol em alto estilo.',
    description:
      'Trilha curta e acessível com vista deslumbrante do Rio de Janeiro e da Pedra da Gávea.',
    rating: 4.6,
    campingFee: 0,
    parkingAvailable: true,
    parkingFee: 0,
    airport: {
      name: 'Aeroporto Santos Dumont',
      city: 'Rio de Janeiro (RJ)',
      distanceKm: 27
    },
    busStation: {
      name: 'Terminal Rodoviário Novo Rio',
      city: 'Rio de Janeiro (RJ)',
      distanceKm: 20
    },
    coordinates: { lat: -22.9997, lng: -43.2685 },
    reviews: [
      {
        user: 'Camila Duarte',
        date: '30 de novembro de 2024',
        rating: 4.7,
        text: 'Ótima opção para iniciantes. A vista é surreal e o acesso é bem sinalizado.'
      },
      {
        user: 'Thiago P.',
        date: '15 de setembro de 2024',
        rating: 4.5,
        text: 'Chegue cedo para evitar filas na rampa de voo livre. Trilha fácil e segura.'
      },
      {
        user: 'Juliana Azevedo',
        date: '3 de julho de 2024',
        rating: 4.6,
        text: 'Perfeito para levar amigos que estão começando no trekking. Leve água, pois não há pontos na trilha.'
      }
    ]
  },
  {
    id: 'cachoeira-tabuleiro',
    name: 'Cachoeira do Tabuleiro',
    state: 'MG',
    city: 'Conceição do Mato Dentro',
    park: 'Parque Natural do Tabuleiro',
    biome: 'Cerrado',
    distance: 5,
    elevationGain: 300,
    duration: 3,
    difficulty: 'moderada',
    waterPoints: true,
    campingPoints: false,
    requiresGuide: false,
    entryFee: 30,
    image: 'images/cachoeira-tabuleiro.jpg',
    gallery: ['images/cachoeira-tabuleiro.jpg'],
    longDescription:
      'Caminhada clássica do Espinhaço, a trilha do Tabuleiro combina travessia por lajedos, rios cristalinos e a visão hipnótica da maior queda d’água de Minas Gerais. O percurso é moderado e alterna subidas com trechos planos, perfeito para quem quer uma aventura completa em um único dia.',
    description:
      'A trilha leva à maior cachoeira de Minas Gerais, com 273 metros de queda d\'água e belos mirantes.',
    rating: 4.7,
    campingFee: 0,
    parkingAvailable: true,
    parkingFee: 15,
    airport: {
      name: 'Aeroporto Internacional de Confins',
      city: 'Confins (MG)',
      distanceKm: 130
    },
    busStation: {
      name: 'Rodoviária de Conceição do Mato Dentro',
      city: 'Conceição do Mato Dentro (MG)',
      distanceKm: 18
    },
    coordinates: { lat: -19.1423, lng: -43.6002 },
    reviews: [
      {
        user: 'Andréa Martins',
        date: '21 de outubro de 2024',
        rating: 4.8,
        text: 'Infraestrutura simples mas eficiente. O visual da cachoeira compensa cada passo!'
      },
      {
        user: 'João Ricardo',
        date: '28 de agosto de 2024',
        rating: 4.6,
        text: 'Trilha com pedras escorregadias próximo ao poço, vá com calçado adequado.'
      },
      {
        user: 'Paula N.',
        date: '12 de maio de 2024',
        rating: 4.7,
        text: 'Entrada paga, mas bem controlada. Recomendo contratar guia local para conhecer mirantes extras.'
      }
    ]
  },
  {
    id: 'marins-itaguare',
    name: 'Travessia Marins‑Itaguaré',
    state: 'SP/MG',
    city: 'Passa Quatro',
    park: 'Serra da Mantiqueira',
    biome: 'Mata Atlântica',
    distance: 30,
    elevationGain: 2500,
    duration: 72,
    difficulty: 'extrema',
    waterPoints: true,
    campingPoints: true,
    requiresGuide: true,
    entryFee: 0,
    image: 'images/marins-itaguare.jpg',
    gallery: ['images/marins-itaguare.jpg'],
    longDescription:
      'Uma travessia lendária entre Minas Gerais e São Paulo, a Marins-Itaguaré exige navegação precisa, travessia de lajes inclinadas e acampamentos selvagens. Ideal para montanhistas experientes que buscam desafios técnicos, paisagens de altitude e noites estreladas a mais de 2.000 metros.',
    description:
      'Travessia exigente pela Serra da Mantiqueira, recomendada para trekkers experientes, com vistas de tirar o fôlego.',
    rating: 4.9,
    campingFee: 0,
    parkingAvailable: true,
    parkingFee: 0,
    airport: {
      name: 'Aeroporto Regional de São José dos Campos',
      city: 'São José dos Campos (SP)',
      distanceKm: 130
    },
    busStation: {
      name: 'Rodoviária de Passa Quatro',
      city: 'Passa Quatro (MG)',
      distanceKm: 12
    },
    coordinates: { lat: -22.3962, lng: -45.1307 },
    reviews: [
      {
        user: 'Eduardo Siqueira',
        date: '9 de setembro de 2024',
        rating: 5,
        text: 'Travessia técnica, procure guia experiente. Visual épico e noites estreladas inesquecíveis.'
      },
      {
        user: 'Luciana Prado',
        date: '27 de junho de 2024',
        rating: 4.9,
        text: 'É fundamental planejar água e pontos de ancoragem. Experiência intensa na Mantiqueira.'
      },
      {
        user: 'Henrique Lopes',
        date: '3 de abril de 2024',
        rating: 4.8,
        text: 'Contratei guia CADASTUR pela Trekko e foi decisivo para a segurança do grupo.'
      }
    ]
  },
  {
    id: 'pico-cristal',
    name: 'Pico do Cristal',
    state: 'MG',
    city: 'Alto Caparaó',
    park: 'Parque Nacional do Caparaó',
    biome: 'Mata Atlântica',
    distance: 10,
    elevationGain: 1000,
    duration: 8,
    difficulty: 'difícil',
    waterPoints: false,
    campingPoints: true,
    requiresGuide: false,
    entryFee: 0,
    image: 'images/pico-cristal.jpg',
    gallery: ['images/pico-cristal.jpg'],
    longDescription:
      'O Pico do Cristal é a segunda montanha mais alta do Parque Nacional do Caparaó. A trilha segue pelo Vale Encantado e exige atenção nas lajes inclinadas próximas ao cume. Ideal para trekkers que já conhecem o Pico da Bandeira e buscam uma alternativa menos movimentada.',
    description:
      'Trilha que leva ao pico vizinho ao Pico da Bandeira, com paisagens deslumbrantes da Serra do Caparaó.',
    rating: 4.5,
    campingFee: 25,
    parkingAvailable: true,
    parkingFee: 20,
    airport: {
      name: 'Aeroporto Regional da Zona da Mata',
      city: 'Goianá (MG)',
      distanceKm: 185
    },
    busStation: {
      name: 'Rodoviária de Alto Caparaó',
      city: 'Alto Caparaó (MG)',
      distanceKm: 8
    },
    coordinates: { lat: -20.4416, lng: -41.8151 },
    reviews: [
      {
        user: 'Bruno Carvalho',
        date: '5 de setembro de 2024',
        rating: 4.6,
        text: 'Trilha exigente, poucas pessoas no cume. Vista espetacular do Bandeira.'
      },
      {
        user: 'Giovanna Santos',
        date: '19 de julho de 2024',
        rating: 4.4,
        text: 'Recomendo acampar no Terreirão e partir de madrugada. Não há pontos de água, leve o suficiente.'
      },
      {
        user: 'Márcio Vilar',
        date: '1 de abril de 2024',
        rating: 4.5,
        text: 'Trilha bem sinalizada, com trechos íngremes. Vale pela vista do amanhecer.'
      }
    ]
  },
  {
    id: 'pico-neblina',
    name: 'Pico da Neblina',
    state: 'AM',
    city: 'São Gabriel da Cachoeira',
    park: 'Parque Nacional do Pico da Neblina',
    biome: 'Amazônia',
    distance: 14,
    elevationGain: 3000,
    duration: 96,
    difficulty: 'extrema',
    waterPoints: true,
    campingPoints: true,
    requiresGuide: true,
    entryFee: 100,
    image: 'images/pico-neblina.jpg',
    gallery: ['images/pico-neblina.jpg'],
    longDescription:
      'Localizado no coração da Amazônia e dentro de território Yanomami, o Pico da Neblina é a montanha mais alta do Brasil e um símbolo de respeito à floresta. A expedição exige autorização oficial, guia especializado e espírito de equipe, recompensando com uma imersão profunda na cultura indígena e na biodiversidade da região.',
    description:
      'O ponto mais alto do Brasil, localizado na Amazônia, acessível somente com autorização e acompanhamento de guias especializados.',
    rating: 4.9,
    campingFee: 0,
    parkingAvailable: false,
    parkingFee: 0,
    airport: {
      name: 'Aeroporto Internacional de Manaus',
      city: 'Manaus (AM)',
      distanceKm: 880
    },
    busStation: {
      name: 'Rodoviária de São Gabriel da Cachoeira',
      city: 'São Gabriel da Cachoeira (AM)',
      distanceKm: 0
    },
    coordinates: { lat: 0.8083, lng: -66.002 },
    reviews: [
      {
        user: 'Patrícia Lopes',
        date: '11 de novembro de 2024',
        rating: 5,
        text: 'Experiência transformadora. A logística é complexa, mas a Trekko ajudou em cada etapa.'
      },
      {
        user: 'Diego Cavalcante',
        date: '24 de agosto de 2024',
        rating: 4.9,
        text: 'Fundamental respeitar as normas Yanomami. Guias locais extremamente profissionais.'
      },
      {
        user: 'Renata Guimarães',
        date: '7 de junho de 2024',
        rating: 4.8,
        text: 'Expedição longa e desafiadora, preparação física e mental são essenciais.'
      }
    ]
  }
];