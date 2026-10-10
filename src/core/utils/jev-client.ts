import { config } from '@config/index.js';

const JEV_URL = 'https://api.typesafe.ai/v1/systemone';

export type JevQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string; criteria?: { true: string; false: string } };

export interface JevAnswer {
  choice?: string;
  noul?: number;
}

export async function askJev(
  state: string,
  questions: Record<string, JevQuestion>
): Promise<Record<string, JevAnswer | undefined>> {
  const response = await fetch(JEV_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.TYPESAFE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'jev-latest', state, questions }),
  });

  if (!response.ok) {
    throw new Error(`Jev request failed: ${response.status}`);
  }

  const { answers } = (await response.json()) as {
    answers: Record<string, JevAnswer | undefined>;
  };
  return answers;
}
