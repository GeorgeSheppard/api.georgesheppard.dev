import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/postgres-js/migrator";

export interface DatabaseClient {
  db: ReturnType<typeof drizzle>;
  close: () => Promise<void>;
}

export async function createDatabaseClient(url: string): Promise<DatabaseClient> {
  const queryClient = postgres(url, {
    max: 10, // Connection pool size
  });

  const db = drizzle(queryClient, { schema });

  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const migrationsFolder = join(currentDir, 'migrations');

    await migrate(db, {
      migrationsFolder,
    });
    console.log('✅ Database migrations completed');
  } catch (error) {
    console.warn('⚠️ Migration error, check that the DB is running:', error);
  }

  return {
    db,
    close: async () => {
      await queryClient.end();
    },
  };
}
