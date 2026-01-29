import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '@config/index.js';

export function registerOpenidConfigurationRoute(app: OpenAPIHono) {
  app.get('/.well-known/openid-configuration', async (c) => {
    try {
      const fullPoolId = `${config.AWS_COGNITO_REGION}_${config.AWS_COGNITO_USER_POOL_ID}`;
      const cognitoUrl = `https://cognito-idp.${config.AWS_COGNITO_REGION}.amazonaws.com/${fullPoolId}`;
      const configUrl = `${cognitoUrl}/.well-known/openid-configuration`;

      console.log(`Fetching OpenID configuration from: ${configUrl}`);

      const response = await fetch(configUrl);

      if (!response.ok) {
        console.error(`Cognito response status: ${response.status} ${response.statusText}`);
        const body = await response.text();
        console.error(`Cognito response body: ${body}`);
        throw new Error(`Failed to fetch OpenID configuration: ${response.statusText}`);
      }

      const configuration = await response.json();

      console.log('OpenID configuration fetched successfully');

      return c.json(configuration, 200);
    } catch (error) {
      console.error('Error fetching OpenID configuration:', error);
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to fetch OpenID configuration',
        },
        500
      );
    }
  });
}
