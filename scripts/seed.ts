import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Demo App (use same apiKey you already have)
  const app = await prisma.app.upsert({
    where: { apiKey: 'dev-secret' },
    update: {},
    create: { name: 'DemoApp', apiKey: 'dev-secret' },
  });

  // Sample Events
  await prisma.event.createMany({
    data: [
      {
        appId: app.id,
        name: 'app_open',
        data: { platform: 'ios', version: '1.0.0' },
      },
      { appId: app.id, name: 'button_click', data: { buttonId: 'signup' } },
    ],
  });

  // Sample Session
  await prisma.session.create({
    data: {
      appId: app.id,
      userId: 'user123',
      startTime: new Date(),
      endTime: null,
      duration: null,
    },
  });

  // Sample Crash
  await prisma.crash.create({
    data: {
      appId: app.id,
      userId: 'user123',
      error: 'NullReferenceException',
      stack: 'stacktrace‑here',
    },
  });

  console.log('Seed data inserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
