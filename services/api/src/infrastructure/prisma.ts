import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from './config';

export const prisma = new PrismaClient({ datasources: { db: { url: resolveDatabaseUrl() } } });
