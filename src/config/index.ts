import 'dotenv/config';
import { validateEnv } from './env.js';

export const config = await validateEnv();
