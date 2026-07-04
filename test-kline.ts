import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Insert a test row using Prisma
    const result = await prisma.klineDaily.create({
      data: {
        code: '513130',
        tradeDate: new Date('2025-07-01'),
        open: new Prisma.Decimal('0.50'),
        high: new Prisma.Decimal('0.60'),
        low: new Prisma.Decimal('0.40'),
        close: new Prisma.Decimal('0.55'),
        volume: new Prisma.Decimal('1000000'),
      }
    });
    console.log('Inserted:', JSON.stringify(result));

    // Now try to read it
    const rows = await prisma.klineDaily.findMany({ take: 1 });
    console.log('Read back:', JSON.stringify(rows[0], null, 2));
  } catch (e: any) {
    console.log('Error:', e.message);
    console.log('Code:', e.code);
  }
}

main().finally(() => prisma.$disconnect());
