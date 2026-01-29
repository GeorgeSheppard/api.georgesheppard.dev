import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '@config/index.js';

export function registerOAuthAuthorizationServerRoute(app: OpenAPIHono) {
  app.get('/.well-known/oauth-authorization-server', async (c) => {
    try {
      const fullPoolId = `${config.AWS_COGNITO_REGION}_${config.AWS_COGNITO_USER_POOL_ID}`;
      const cognitoUrl = `https://cognito-idp.${config.AWS_COGNITO_REGION}.amazonaws.com/${fullPoolId}`;
      const configUrl = `${cognitoUrl}/.well-known/openid-configuration`;

      console.log(`Fetching OAuth Authorization Server metadata from OpenID Configuration: ${configUrl}`);

      const response = await fetch(configUrl);

      if (!response.ok) {
        console.error(`Cognito response status: ${response.status} ${response.statusText}`);
        const body = await response.text();
        console.error(`Cognito response body: ${body}`);
        throw new Error(
          `Failed to fetch OpenID Configuration: ${response.statusText}`
        );
      }

      const metadata = await response.json();

      console.log('OAuth Authorization Server metadata fetched successfully');

      return c.json(metadata, 200);
    } catch (error) {
      console.error('Error fetching OAuth Authorization Server metadata:', error);
      return c.json(
        {
          error:
            error instanceof Error ? error.message : 'Failed to fetch OAuth Authorization Server metadata',
        },
        500
      );
    }
  });
}
