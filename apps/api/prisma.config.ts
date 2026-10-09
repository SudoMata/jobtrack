import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Direct connection, used only by the Prisma CLI (migrations).
    // Read with process.env rather than env(), so that `prisma generate`
    // still works where the variable is absent (CI).
    url: process.env['DIRECT_URL'],
  },
});
