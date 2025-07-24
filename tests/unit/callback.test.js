const request = require('supertest');
const app = require('../../server');

describe('Callback Handler', () => {
    test('should handle successful callback', async () => {
        const callbackData = {
            user_id: 'test-user-123',
            job_id: 'test-job-456',
            ResultCode: '0000',
            ResultText: 'Success'
        };

        const response = await request(app)
            .post('/api/callback')
            .send(callbackData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });

    test('should handle failed callback', async () => {
        const callbackData = {
            user_id: 'test-user-123',
            job_id: 'test-job-456',
            ResultCode: '1001',
            ResultText: 'Failure'
        };

        const response = await request(app)
            .post('/api/callback')
            .send(callbackData);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
});