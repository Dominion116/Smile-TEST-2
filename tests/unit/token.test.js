const request = require('supertest');
const app = require('../../server');

describe('Token Generation', () => {
    test('should generate token successfully', async () => {
        const response = await request(app)
            .post('/api/token/generate')
            .send({
                userId: 'test-user-123',
                product: 'biometric_kyc'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.jobId).toBeDefined();
    });

    test('should return available products', async () => {
        const response = await request(app)
            .get('/api/token/products');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.products)).toBe(true);
    });
});