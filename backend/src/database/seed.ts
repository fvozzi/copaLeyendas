import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { User, UserRole } from '../auth/user.entity';
import { ContentPost, ContentSection } from '../posts/content-post.entity';
import { RegistrationAccessGrant } from '../registrations/registration-access-grant.entity';
import { ensurePaymentProofDir } from '../registrations/payment-proof-storage';
import {
  PairCategory,
  RegistrationAccessGrantStatus,
} from '../registrations/registration.enums';

async function run() {
  ensurePaymentProofDir();
  await dataSource.initialize();

  const userRepository = dataSource.getRepository(User);
  const postRepository = dataSource.getRepository(ContentPost);
  const accessGrantRepository = dataSource.getRepository(RegistrationAccessGrant);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@copaleyendas.local').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'copa123';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Administracion Copa Leyendas';

  let admin = await userRepository.findOne({ where: { email: adminEmail } });
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  if (!admin) {
    admin = userRepository.create({
      email: adminEmail,
      name: adminName,
      passwordHash,
      role: UserRole.DIRECTOR,
    });
  } else {
    admin.name = adminName;
    admin.passwordHash = passwordHash;
    admin.role = UserRole.DIRECTOR;
  }

  await userRepository.save(admin);

  const seededPosts = [
    {
      section: ContentSection.LEYENDAS,
      title: 'Legado federal de la paleta',
      slug: 'legado-federal-de-la-paleta',
      excerpt:
        'Historias de jugadoras y referentes que hicieron crecer la pelota paleta en todo el pais.',
      body:
        'Copa Leyendas nace para reconocer a quienes empujaron la pelota paleta durante anos en clubes, trinquetes y canchas abiertas. Esta seccion queda preparada para publicar perfiles, homenajes y material historico.',
      featured: true,
    },
    {
      section: ContentSection.CANCHAS,
      title: 'Nueve canchas en paralelo',
      slug: 'nueve-canchas-en-paralelo',
      excerpt:
        'La edicion de noviembre se juega en Buenos Aires con nueve sedes activas en simultaneo.',
      body:
        'La operacion del torneo necesita informacion clara de sedes, accesos, servicios y horarios. Esta publicacion semilla muestra el formato para comunicar cada cancha con contexto util para jugadoras, clubes y publico.',
      featured: true,
    },
    {
      section: ContentSection.TORNEOS,
      title: 'Circuito anual y fechas aliadas',
      slug: 'circuito-anual-y-fechas-aliadas',
      excerpt:
        'La web tambien queda lista para difundir otros torneos del calendario de pelota paleta.',
      body:
        'Ademas de la Copa Leyendas, la plataforma puede publicar torneos invitados, convocatorias y fechas previas o posteriores a noviembre para sostener la comunidad activa durante todo el ano.',
      featured: false,
    },
    {
      section: ContentSection.HISTORIAS,
      title: 'Memoria viva del deporte',
      slug: 'memoria-viva-del-deporte',
      excerpt:
        'Cronicas, entrevistas y recuerdos para contar la historia de la paleta desde una mirada federal.',
      body:
        'La seccion Historias queda pensada para notas largas, archivo y relatos de clubes, localidades y protagonistas. Tambien puede alojar coberturas posteriores a cada edicion.',
      featured: false,
    },
  ];

  for (const item of seededPosts) {
    const existing = await postRepository.findOne({ where: { slug: item.slug } });

    if (existing) {
      existing.title = item.title;
      existing.excerpt = item.excerpt;
      existing.body = item.body;
      existing.featured = item.featured;
      existing.published = true;
      existing.section = item.section;
      existing.publishedAt ??= new Date();
      await postRepository.save(existing);
      continue;
    }

    await postRepository.save(
      postRepository.create({
        ...item,
        published: true,
        publishedAt: new Date(),
      }),
    );
  }

  const sampleGrantToken = 'COPA-BA-001';
  const existingGrant = await accessGrantRepository.findOne({
    where: { token: sampleGrantToken },
  });

  if (!existingGrant) {
    await accessGrantRepository.save(
      accessGrantRepository.create({
        token: sampleGrantToken,
        category: PairCategory.DAMAS_A,
        localityName: 'Ciudad de Buenos Aires',
        provinceName: 'Buenos Aires',
        clubName: 'Club Ejemplo',
        contactName: 'Delegada Demo',
        contactEmail: 'delegada@copaleyendas.local',
        contactPhone: '1112345678',
        notes: 'Token demo para pruebas locales.',
        feeWaived: false,
        status: RegistrationAccessGrantStatus.ACTIVE,
      }),
    );
  }

  await dataSource.destroy();
  console.log(`Seed complete. Admin: ${adminEmail}`);
}

run().catch(async (error) => {
  console.error(error);
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  process.exit(1);
});
