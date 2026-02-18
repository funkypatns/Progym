const test = require('node:test');
const assert = require('node:assert/strict');

const appointmentsRouter = require('../routes/appointments');

function getRouteMiddlewares(router, method, path) {
    const layer = router.stack.find((entry) => entry.route && entry.route.path === path && entry.route.methods[method]);
    if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    return layer.route.stack.map((stackItem) => stackItem.handle);
}

function createMockRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

test('GET /appointments requires appointments.view for non-admin users', async () => {
    const middlewares = getRouteMiddlewares(appointmentsRouter, 'get', '/');
    const permissionMiddleware = middlewares[1];
    const req = {
        user: {
            id: 10,
            role: 'staff',
            permissions: []
        }
    };
    const res = createMockRes();

    await permissionMiddleware(req, res, () => {
        throw new Error('Permission middleware should block this request');
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
    assert.equal(res.body.requiredPermission, 'appointments.view');
});

test('POST /appointments requires appointments.manage for non-admin users', async () => {
    const middlewares = getRouteMiddlewares(appointmentsRouter, 'post', '/');
    const permissionMiddleware = middlewares[1];
    const req = {
        user: {
            id: 10,
            role: 'staff',
            permissions: ['appointments.view']
        }
    };
    const res = createMockRes();

    await permissionMiddleware(req, res, () => {
        throw new Error('Permission middleware should block this request');
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
    assert.equal(res.body.requiredPermission, 'appointments.manage');
});

test('GET /appointments/meta requires appointments.view for non-admin users', async () => {
    const middlewares = getRouteMiddlewares(appointmentsRouter, 'get', '/meta');
    const permissionMiddleware = middlewares[1];
    const req = {
        user: {
            id: 12,
            role: 'staff',
            permissions: []
        }
    };
    const res = createMockRes();

    await permissionMiddleware(req, res, () => {
        throw new Error('Permission middleware should block this request');
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'PERMISSION_DENIED');
    assert.equal(res.body.requiredPermission, 'appointments.view');
});

test('GET /appointments/meta allows access when appointments.view is granted', async () => {
    const middlewares = getRouteMiddlewares(appointmentsRouter, 'get', '/meta');
    const permissionMiddleware = middlewares[1];
    const req = {
        user: {
            id: 12,
            role: 'staff',
            permissions: ['appointments.view']
        }
    };
    const res = createMockRes();
    let nextCalled = false;

    await permissionMiddleware(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
});
