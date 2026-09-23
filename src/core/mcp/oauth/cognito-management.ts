import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '@config/index.js';

const client = new CognitoIdentityProviderClient({
  region: config.COGNITO_REGION,
  credentials: {
    accessKeyId: config.COGNITO_MANAGEMENT_ACCESS_KEY_ID,
    secretAccessKey: config.COGNITO_MANAGEMENT_SECRET_ACCESS_KEY,
  },
});

export interface CognitoAppClient {
  clientId: string;
}

/**
 * Provisions a public Cognito App Client (no secret) backed by our existing
 * User Pool, for a single MCP client. Security comes from PKCE rather than a
 * client secret, since the server-side /mcp/callback step has no way to
 * retain a secret without persisting per-client state. The callback URL
 * always points back at our own /mcp/callback - Cognito never talks to the
 * MCP client's redirect_uri directly, we proxy the final redirect ourselves.
 */
export async function createCognitoAppClientForMcp(clientName: string): Promise<CognitoAppClient> {
  const result = await client.send(
    new CreateUserPoolClientCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID,
      ClientName: clientName,
      GenerateSecret: false,
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      AllowedOAuthFlowsUserPoolClient: true,
      SupportedIdentityProviders: ['COGNITO'],
      CallbackURLs: [`${config.BACKEND_URL}/mcp/callback`],
      ExplicitAuthFlows: ['ALLOW_REFRESH_TOKEN_AUTH'],
    })
  );

  const userPoolClient = result.UserPoolClient;
  if (!userPoolClient?.ClientId) {
    throw new Error('Cognito did not return a client id for the new App Client');
  }

  return {
    clientId: userPoolClient.ClientId,
  };
}
