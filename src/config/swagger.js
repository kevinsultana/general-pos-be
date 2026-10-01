import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'POS SaaS Multi-Tenant API',
      version: '1.0.0',
      description:
        'Dokumentasi RESTful API untuk platform SaaS Point of Sale (POS) Multi-Tenant berbasis Express.js dan Prisma ORM.',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan JWT token dalam format: Bearer <token>',
        },
      },
    },
  },
  apis: ['./src/routes/**/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI middleware pada endpoint /api-docs
 * @param {import('express').Application} app
 */
export const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};

export default setupSwagger;
