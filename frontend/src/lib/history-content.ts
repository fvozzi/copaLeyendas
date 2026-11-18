export interface HistoryImage {
  src: string;
  alt: string;
  caption: string;
  portrait?: boolean;
}

export interface HistoryChapter {
  period: string;
  title: string;
  paragraphs: string[];
  images: HistoryImage[];
}

export const pelotaPaletaHistory: {
  title: string;
  introduction: string;
  chapters: HistoryChapter[];
} = {
  title: 'Cronología de la Pelota Vasca y nacimiento de la Pelota a Paleta',
  introduction: 'De los primeros frontones del Río de la Plata a la creación de una herramienta argentina que transformó el deporte y atravesó generaciones.',
  chapters: [
    {
      period: 'Hacia 1800',
      title: 'La Pelota Vasca en el Río de la Plata',
      paragraphs: [
        'El juego de Pelota Vasca se introdujo en el Río de la Plata por inmigrantes de esa colectividad, desde antes de la Independencia. Primitivamente, se jugaba a mano limpia y los escenarios eran frontones rectangulares, sin paredes y con piso mejorado para cuidar el pique de la pelota de cuero retobada.',
        'El deporte alcanzó muchísima popularidad en la segunda mitad del siglo XIX, y fue entonces cuando se construyeron frontones por todo el territorio, en general, pero particularmente en la provincia de Buenos Aires. Cada pueblo tenía su frontón, donde todas las tardes se reunían comerciantes, empleados y gente de campo para disputar reñidos partidos por algún peso. En los almacenes de campo también era muy popular esta práctica deportiva.',
        'El tipo y diseño de las canchas era variado, dependiendo de las circunstancias y posibilidades de cada lugar.',
        'Hacia finales del siglo XIX y principios del siglo XX, se jugaban distintas modalidades de la Pelota Vasca: Mano, Guante, Cesta, Pala y Sare.',
      ],
      images: [
        {
          src: '/historias/origenes-paleta/fronton-buenos-aires-1901.webp',
          alt: 'Jugadores y espectadores en un antiguo frontón de campo',
          caption: 'Antiguo frontón de campo en la provincia de Buenos Aires, circa 1901.',
        },
      ],
    },
    {
      period: '1905',
      title: 'El hueso de vaca: nace la paleta',
      paragraphs: [
        'El vasco Gabriel “Sardina” Martiren, nacido el 8 de agosto de 1866 en Baigorry, Francia, se había instalado en Argentina y tenía un tambo en la zona de Burzaco, Almirante Brown. Había traído consigo el juego de pelota y lo practicaba contra una pared que había en su tambo, en el campo. Organizaba partidos con los peones y los vecinos del lugar.',
        'En un principio, lo hacía con las manos, hasta que se le ocurrió utilizar una paleta vacuna y darle forma para poder golpear mejor la pelota. Inspirado en esa rudimentaria paleta de hueso, utilizó la madera de los cajones en los que venía embalado el kerosene para moldear una mejor paleta, puliendo la parte interna de la empuñadura para no lastimarse la mano.',
        'Luego hizo fabricar las primeras paletas de madera con un carpintero amigo. Cuando estuvieron listas, Martiren organizó un partido de cuatro jugadores en la cancha de Burzaco “La República Gaucha”, allá por el año 1905, dando inicio a nuestro deporte.',
      ],
      images: [
        {
          src: '/historias/origenes-paleta/paleta-hueso.webp',
          alt: 'Paletas vacunas y pelota utilizadas antes de la paleta de madera',
          caption: 'La paleta vacuna que inspiró la primera herramienta del nuevo juego.',
        },
        {
          src: '/historias/origenes-paleta/cajon-kerosene.webp',
          alt: 'Antiguo cajón de madera utilizado para transportar kerosene',
          caption: 'Los cajones de kerosene aportaron la madera para las primeras paletas.',
        },
        {
          src: '/historias/origenes-paleta/republica-gaucha-interior.webp',
          alt: 'Vista interior del trinquete La República Gaucha',
          caption: 'Interior del trinquete La República Gaucha, en Burzaco.',
        },
      ],
    },
    {
      period: 'Desde 1909',
      title: 'De Burzaco al mundo',
      paragraphs: [
        'Hacia 1909, aproximadamente, Martiren se mudó con su familia y se radicó en Diego de Alvear, en la provincia de Santa Fe, donde continuó con su pasión hasta cerca de los 70 años. Falleció el 5 de julio de 1939, a la edad de 72 años.',
        'Aquel primer modelo de paleta de Martiren fue el puntapié inicial que multiplicó el entusiasmo por esta nueva herramienta. La paleta comenzó a sumar adeptos en distintos clubes y su industrialización, en 1915, permitió que el deporte se expandiera rápidamente por el territorio argentino, donde no paraban de construirse nuevas canchas.',
        'La “Paleta Argentina” logró tal aceptación que, en 1952, cuando ingresó competitivamente al Primer Campeonato Mundial de Pelota Vasca, lo hizo con ese nombre. Con el correr de las décadas, surgieron numerosos jugadores a nivel nacional que alcanzaron renombre en el plano internacional, obtuvieron una extensa cantidad de medallas y llevaron nuestro deporte a lo más alto del podio.',
        'Aquella paleta de Martiren, creada en un tambo de Burzaco hace más de 100 años, tuvo tanto éxito que se exportó al mundo y logró atravesar varias generaciones bajo una misma pasión.',
      ],
      images: [
        {
          src: '/historias/origenes-paleta/gabriel-martiren.webp',
          alt: 'Gabriel Martiren sostiene una paleta de madera',
          caption: 'Gabriel Martiren en su casa de Diego de Alvear, durante la década de 1930.',
          portrait: true,
        },
      ],
    },
  ],
};
