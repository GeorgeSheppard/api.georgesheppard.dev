import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { config } from "@config/index.js";

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
    await migrate(db, {
      migrationsFolder: config.DATABASE_MIGRATIONS_PATH,
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
